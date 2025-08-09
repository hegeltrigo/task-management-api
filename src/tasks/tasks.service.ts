import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { Task, TaskPriority, TaskStatus } from '@prisma/client';
import { PaginationService } from '../common/pagination/pagination.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ActivitiesService } from './activities/activities.service';
import { ActivityAction } from './activities/constants';

@Injectable()
export class TasksService {

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private readonly paginationService: PaginationService,
    private readonly activitiesService: ActivitiesService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async findAll(params: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const where = this.buildWhereConditions(params);

    const paginationResult = await this.paginationService.paginate<Task>('task', {
      where,
      include: {
        assignee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        project: {
          select: {
            id: true,
            name: true
          }
        },
        tags: {
          select: {
            id: true,
            name: true
          }
        },
      },
      orderBy: { createdAt: 'desc' },
      page: params.page,
      limit: params.limit,
      cacheKeyPrefix: 'tasks',
    });

    return paginationResult;
  }

  private buildWhereConditions(params: any) {
    const where: any = {};

    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.assigneeId) where.assigneeId = params.assigneeId;
    if (params.projectId) where.projectId = params.projectId;

    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: 'insensitive' } },
        { description: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }
  
  private async getSystemUser() {
    const user = await this.prisma.user.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    });

    if (!user) {
      throw new Error('No users found in database');
    }

    return user;
  }

  private async logTaskActivity(
    taskId: string,
    userId: string,
    action: ActivityAction,
    changes: Record<string, { old?: any; new?: any }>,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { title: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!task) throw new NotFoundException(`Task with ID ${taskId} not found`);
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    // La actividad se guardará exactamente con el formato especificado
    await this.activitiesService.logActivity({
      taskId,
      taskTitle: task.title,
      userId,
      userName: user.name,
      action,
      changes,
    });
  }

  async create(createTaskDto: CreateTaskDto, userId?: string) {
    const effectiveUser = userId 
      ? await this.prisma.user.findUnique({ 
          where: { id: userId }, 
          select: { id: true, name: true } 
        })
      : await this.getSystemUser();

    if (!effectiveUser) {
      throw new NotFoundException('User not found');
    }

    // 1. Validar que el proyecto existe
    const projectExists = await this.prisma.project.findUnique({
      where: { id: createTaskDto.projectId },
      select: { id: true }
    });

    if (!projectExists) {
      throw new NotFoundException(`Project with ID ${createTaskDto.projectId} not found`);
    }

    // 2. Validar que el asignado existe (si se especificó)
    if (createTaskDto.assigneeId) {
      const assigneeExists = await this.prisma.user.findUnique({
        where: { id: createTaskDto.assigneeId },
        select: { id: true }
      });

      if (!assigneeExists) {
        throw new NotFoundException(`User with ID ${createTaskDto.assigneeId} not found`);
      }
    }

    // 3. Validar que los tags existen (si se especificaron)
    if (createTaskDto.tagIds && createTaskDto.tagIds.length > 0) {
      const existingTags = await this.prisma.tag.findMany({
        where: { id: { in: createTaskDto.tagIds } },
        select: { id: true }
      });

      if (existingTags.length !== createTaskDto.tagIds.length) {
        const existingTagIds = existingTags.map(tag => tag.id);
        const missingTags = createTaskDto.tagIds.filter(id => !existingTagIds.includes(id));
        throw new NotFoundException(`Tags with IDs ${missingTags.join(', ')} not found`);
      }
    }

    // Crear la tarea después de validar todo
    const task = await this.prisma.task.create({
      data: {
        title: createTaskDto.title,
        description: createTaskDto.description,
        status: createTaskDto.status,
        priority: createTaskDto.priority,
        dueDate: createTaskDto.dueDate,
        project: { connect: { id: createTaskDto.projectId } },
        assignee: createTaskDto.assigneeId
          ? { connect: { id: createTaskDto.assigneeId } }
          : undefined,
        tags: createTaskDto.tagIds
          ? { connect: createTaskDto.tagIds.map(id => ({ id })) }
          : undefined,
      },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    // Registrar actividad
    await this.logTaskActivity(
      task.id,
      effectiveUser.id,
      ActivityAction.CREATED,
      {
        title: { new: task.title },
        description: { new: task.description },
        status: { new: task.status },
        priority: { new: task.priority },
        dueDate: { new: task.dueDate?.toISOString() },
        projectId: { new: task.projectId },
        assigneeId: { new: task.assigneeId },
        tagIds: { new: task.tags.map(tag => tag.id) },
      }
    );

    // Enviar notificación si tiene asignado
    if (task.assignee) {
      await this.notificationsQueue.add(
        'task-assigned',
        {
          assigneeEmail: task.assignee.email,
          taskTitle: task.title,
        },
        {
          attempts: 3,
          backoff: 5000,
        }
      );
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId?: string) {
    // 1. Obtener usuario efectivo (el que realiza la acción)
    const effectiveUser = userId 
      ? await this.prisma.user.findUnique({ 
          where: { id: userId }, 
          select: { id: true, name: true } 
        })
      : await this.getSystemUser();

    if (!effectiveUser) {
      throw new NotFoundException('User not found');
    }

    // 2. Obtener tarea existente con sus relaciones
    const existingTask = await this.prisma.task.findUnique({
      where: { id },
      include: { 
        assignee: true, 
        tags: true,
        project: true 
      },
    });

    if (!existingTask) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    // 3. Validaciones de relaciones antes de actualizar
    // Validar proyecto si se está cambiando
    if (updateTaskDto.projectId && updateTaskDto.projectId !== existingTask.projectId) {
      const projectExists = await this.prisma.project.findUnique({
        where: { id: updateTaskDto.projectId },
        select: { id: true }
      });
      if (!projectExists) {
        throw new NotFoundException(`Project with ID ${updateTaskDto.projectId} not found`);
      }
    }

    // Validar asignado si se está cambiando
    if (updateTaskDto.assigneeId !== undefined && updateTaskDto.assigneeId !== existingTask.assigneeId) {
      if (updateTaskDto.assigneeId) {
        const assigneeExists = await this.prisma.user.findUnique({
          where: { id: updateTaskDto.assigneeId },
          select: { id: true, email: true }
        });
        if (!assigneeExists) {
          throw new NotFoundException(`User with ID ${updateTaskDto.assigneeId} not found`);
        }
      }
    }

    // Validar tags si se están cambiando
    if (updateTaskDto.tagIds !== undefined) {
      const existingTags = await this.prisma.tag.findMany({
        where: { id: { in: updateTaskDto.tagIds || [] } },
        select: { id: true }
      });
      
      if (updateTaskDto.tagIds && updateTaskDto.tagIds.length > 0) {
        const existingTagIds = existingTags.map(tag => tag.id);
        const missingTags = updateTaskDto.tagIds.filter(id => !existingTagIds.includes(id));
        if (missingTags.length > 0) {
          throw new NotFoundException(`Tags with IDs ${missingTags.join(', ')} not found`);
        }
      }
    }

    // 4. Preparar cambios para el registro de actividad
    const changes: Record<string, { old?: any; new?: any }> = {};

    if (updateTaskDto.title !== undefined && updateTaskDto.title !== existingTask.title) {
      changes.title = {
        old: existingTask.title,
        new: updateTaskDto.title,
      };
    }

    if (updateTaskDto.description !== undefined && updateTaskDto.description !== existingTask.description) {
      changes.description = {
        old: existingTask.description,
        new: updateTaskDto.description,
      };
    }

    if (updateTaskDto.status !== undefined && updateTaskDto.status !== existingTask.status) {
      changes.status = {
        old: existingTask.status,
        new: updateTaskDto.status,
      };
    }

    if (updateTaskDto.priority !== undefined && updateTaskDto.priority !== existingTask.priority) {
      changes.priority = {
        old: existingTask.priority,
        new: updateTaskDto.priority,
      };
    }

    if (updateTaskDto.dueDate !== undefined && updateTaskDto.dueDate?.toString() !== existingTask.dueDate?.toISOString()) {
      changes.dueDate = {
        old: existingTask.dueDate?.toISOString(),
        new: updateTaskDto.dueDate?.toString(),
      };
    }

    if (updateTaskDto.assigneeId !== undefined && updateTaskDto.assigneeId !== existingTask.assigneeId) {
      changes.assigneeId = {
        old: existingTask.assigneeId,
        new: updateTaskDto.assigneeId,
      };
    }

    if (updateTaskDto.tagIds !== undefined) {
      const oldTagIds = existingTask.tags.map(tag => tag.id);
      const newTagIds = updateTaskDto.tagIds || [];
      
      if (JSON.stringify(oldTagIds.sort()) !== JSON.stringify(newTagIds.sort())) {
        changes.tagIds = {
          old: oldTagIds,
          new: newTagIds,
        };
      }
    }

    // 5. Actualizar la tarea
    const updatedTask = await this.prisma.task.update({
      where: { id },
      data: {
        title: updateTaskDto.title,
        description: updateTaskDto.description,
        status: updateTaskDto.status,
        priority: updateTaskDto.priority,
        dueDate: updateTaskDto.dueDate,
        project: updateTaskDto.projectId 
          ? { connect: { id: updateTaskDto.projectId } }
          : undefined,
        assignee: updateTaskDto.assigneeId !== undefined
          ? updateTaskDto.assigneeId
            ? { connect: { id: updateTaskDto.assigneeId } }
            : { disconnect: true }
          : undefined,
        tags: updateTaskDto.tagIds !== undefined
          ? { set: (updateTaskDto.tagIds || []).map(id => ({ id })) }
          : undefined,
      },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    // 6. Registrar actividad si hubo cambios
    if (Object.keys(changes).length > 0) {
      await this.logTaskActivity(
        updatedTask.id,
        effectiveUser.id,
        ActivityAction.UPDATED,
        changes
      );
    }

    // 7. Notificar si cambió el asignado
    if (changes.assigneeId && updatedTask.assignee) {
      await this.notificationsQueue.add(
        'task-assigned',
        {
          assigneeEmail: updatedTask.assignee.email,
          taskTitle: updatedTask.title,
        },
        {
          attempts: 3,
          backoff: 5000,
        }
      );
    }

    return updatedTask;
  }

  async remove(id: string, userId?: string) {
    const effectiveUser = userId 
      ? await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
      : await this.getSystemUser();

    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { assignee: true, tags: true },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    await this.prisma.task.delete({ where: { id } });

    // Registrar actividad de eliminación
    await this.logTaskActivity(
      id,
      effectiveUser.id,
      ActivityAction.DELETED,
      {
        title: { old: task.title },
        description: { old: task.description },
        status: { old: task.status },
        priority: { old: task.priority },
        dueDate: { old: task.dueDate?.toISOString() },
        projectId: { old: task.projectId },
        assigneeId: { old: task.assigneeId },
        tagIds: { old: task.tags.map(tag => tag.id) },
      }
    );

    return { message: 'Task deleted successfully' };
  }
}