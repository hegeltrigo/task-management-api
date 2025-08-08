import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task, Prisma } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class TasksService {
  // Time of caché (1 minuto en ms)
  private readonly CACHE_TTL = 60 * 1000; 

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    @Inject(CACHE_MANAGER) private cache: Cache
  ) {}

    async findAll(params: {
    status?: string;
    priority?: string;
    assigneeId?: string;
    projectId?: string;
    search?: string;
  }): Promise<Task[]> {
    const cacheKey = this.generateCacheKey(params);
    
    try {
      // Intenta obtener de Redis
      const cached = await this.cache.get<Task[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.error('Error al acceder a Redis', error);
      // Continúa con la consulta a DB si Redis falla
    }

    // Consulta a la base de datos
    const result = await this.findFromDB(params);

    try {
      // Almacena en Redis (con manejo de error silencioso)
      await this.cache.set(cacheKey, result, this.CACHE_TTL).catch(console.error);
    } catch (error) {
      console.error('Error al guardar en Redis', error);
    }

    return result;
  }

  private async findFromDB(params: any): Promise<Task[]> {
    const where = this.buildWhereConditions(params);
    
    return this.prisma.task.findMany({
      where,
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Límite por defecto
    });
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

  private generateCacheKey(params: any): string {
    const { status, priority, assigneeId, projectId, search } = params;
    return `tasks:${status}:${priority}:${assigneeId}:${projectId}:${search}`;
  }

  async clearCache(): Promise<void> {
    // Limpia todas las claves que comienzan con 'tasks:'
    const keys = await this.cache.store.keys?.('tasks:*') || [];
    await Promise.all(keys.map(key => this.cache.del(key)));
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

    // PERFORMANCE ISSUE: Synchronous email notification blocking response
    if (task.assignee) {
      await this.emailService.sendTaskAssignmentNotification(
        task.assignee.email,
        task.title
      );
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

    // PERFORMANCE ISSUE: Synchronous email notification blocking response
    if (updateTaskDto.assigneeId && updateTaskDto.assigneeId !== existingTask.assigneeId) {
      await this.emailService.sendTaskAssignmentNotification(
        task.assignee!.email,
        task.title
      );
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
