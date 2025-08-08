import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task, Prisma } from '@prisma/client';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  async findAll(filterDto: TaskFilterDto) {
    return this.prisma.task.findMany({
      where: { // Filtra DIRECTAMENTE en la base de datos
        status: filterDto.status,
        priority: filterDto.priority,
        assigneeId: filterDto.assigneeId,
        projectId: filterDto.projectId,
        dueDate: {
          gte: filterDto.dueDateFrom ? new Date(filterDto.dueDateFrom) : undefined,
          lte: filterDto.dueDateTo ? new Date(filterDto.dueDateTo) : undefined,
        },
      },
      include: { // Trae las relaciones en UNA sola consulta
        assignee: true,
        project: true,
        tags: true,
      },
    });
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
