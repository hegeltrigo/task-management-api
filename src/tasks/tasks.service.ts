import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task, Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { PaginationService } from './pagination.service';


@Injectable()
export class TasksService {

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private readonly paginationService: PaginationService
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

    return this.paginationService.paginate<Task>('task', {
      where,
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
      orderBy: { createdAt: 'desc' },
      page: params.page,
      limit: params.limit,
      cacheKeyPrefix: 'tasks',
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
