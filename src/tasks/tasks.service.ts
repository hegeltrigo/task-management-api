import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task, Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { PaginationService } from './pagination.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class TasksService {

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private readonly paginationService: PaginationService,
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
  
  async create(createTaskDto: CreateTaskDto) {
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

    if (task.assignee) {
      await this.notificationsQueue.add('task-assigned', {
        assigneeEmail: task.assignee.email,
        taskTitle: task.title,
      }, {
        attempts: 3, // 3 reintentos
        backoff: 5000, // 5 segundos entre intentos
      });
    }

    return task;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto) {
    const existingTask = await this.findOne(id);
    
    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: updateTaskDto.title,
        description: updateTaskDto.description,
        status: updateTaskDto.status,
        priority: updateTaskDto.priority,
        dueDate: updateTaskDto.dueDate,
        assignee: updateTaskDto.assigneeId !== undefined
          ? updateTaskDto.assigneeId 
            ? { connect: { id: updateTaskDto.assigneeId } }
            : { disconnect: true }
          : undefined,
        tags: updateTaskDto.tagIds
          ? { set: updateTaskDto.tagIds.map(id => ({ id })) }
          : undefined,
      },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    // verify if assignee was changed and send notification
    const assigneeChanged = updateTaskDto.assigneeId !== undefined && 
                          updateTaskDto.assigneeId !== existingTask.assigneeId;
    
    if (assigneeChanged && task.assignee) {
      await this.notificationsQueue.add('task-assigned', {
        assigneeEmail: task.assignee.email,
        taskTitle: task.title,
      }, {
        attempts: 3, // 3 tries
        backoff: 5000, // 5 seconds between tries
      });
    }

    return task;
  }

  async remove(id: string) {
    await this.findOne(id);
    
    await this.prisma.task.delete({
      where: { id },
    });

    return { message: 'Task deleted successfully' };
  }
}
