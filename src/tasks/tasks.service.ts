import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task, Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class TasksService {
  private readonly DEFAULT_LIMIT = 25;
  private readonly MAX_LIMIT = 100;
  // Time of caché (1 minuto en ms)
  private readonly CACHE_TTL = 60 * 1000; 

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    @Inject(CACHE_MANAGER) private cache: Cache
  ) {}

  async findAll(params: {
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string;
    projectId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Task[]; total: number; page: number; totalPages: number }> {
    // Calculate real limit
    const take = Math.min(params.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);
    const page = params.page || 1;
    const skip = (page - 1) * take;

    // Generate unique cache key
    const cacheKey = this.generateCacheKey(params, take, page);

    try {
      const cached = await this.cache.get<{
        data: Task[];
        total: number;
      }>(cacheKey);
      if (cached) {
        return {
          ...cached,
          page,
          totalPages: Math.ceil(cached.total / take),
        };
      }
    } catch (error) {
      console.error('Redis error:', error);
    }

    const where = this.buildWhereConditions(params);

    // execute query and counter in parallel
    const [data, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        take,
        skip,
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.task.count({ where }),
    ]);

    const totalPages = Math.ceil(total / take);

    // save in cache
    try {
      await this.cache.set(
        cacheKey,
        { data, total },
        this.CACHE_TTL
      );
    } catch (error) {
      console.error('Redis save error:', error);
    }

    return { data, total, page, totalPages };
  }

  private buildWhereConditions(params: any): any {
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

  private generateCacheKey(params: any, limit: number, page: number): string {
    return [
      'tasks',
      params.status,
      params.priority,
      params.assigneeId,
      params.projectId,
      params.search,
      `limit=${limit}`,
      `page=${page}`,
    ].join(':');
  }

  async clearCache(): Promise<void> {
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
