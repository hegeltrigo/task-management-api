import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityAction } from './constants';
import { PaginationService } from '../../common/pagination/pagination.service';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paginationService: PaginationService
  ) {}

  async logActivity(params: {
    taskId: string;
    userId: string;
    action: ActivityAction;
    changes: Record<string, { old?: any; new?: any }>;
    taskTitle?: string;
    userName?: string;
  }): Promise<any> {
    const { taskId, userId, action, changes, taskTitle, userName } = params;

    // Buscar información adicional si no se proporciona
    const [task, user] = await Promise.all([
      taskTitle 
        ? Promise.resolve({ title: taskTitle }) 
        : this.prisma.task.findUnique({
            where: { id: taskId },
            select: { title: true },
          }),
      userName
        ? Promise.resolve({ name: userName })
        : this.prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
          }),
    ]);

    if (!task) throw new NotFoundException(`Task with ID ${taskId} not found`);
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    const activity = await this.prisma.activity.create({
      data: {
        taskId,
        userId,
        action,
        changes,
        taskTitle: task.title,
        userName: user.name,
      },
    });

    return this.formatActivity(activity);
  }

  async getTaskActivities(taskId: string, page: number, limit: number) {
    const result = await this.paginationService.paginate<any>('activity', {
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      page,
      limit,
    });

    return {
      ...result,
      data: result.data.map(activity => this.formatActivity(activity)),
    };
  }

  async getAllActivities(
    filters: {
      userId?: string;
      action?: ActivityAction;
      startDate?: Date;
      endDate?: Date;
      taskId?: string;
    },
    page: number = 1,
    limit: number = 20,
  ) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = filters.action;
    if (filters.taskId) where.taskId = filters.taskId;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate && { gte: new Date(filters.startDate) }),
        ...(filters.endDate && { lte: new Date(filters.endDate) }),
      };
    }

    const result = await this.paginationService.paginate<any>('activity', {
      where,
      orderBy: { createdAt: 'desc' },
      page,
      limit,
    });

    return {
      ...result,
      data: result.data.map(activity => this.formatActivity(activity)),
    };
  }

  private formatActivity(activity: any) {
    return {
      id: activity.id,
      taskId: activity.taskId,
      taskTitle: activity.taskTitle,
      userId: activity.userId,
      userName: activity.userName,
      action: activity.action,
      changes: activity.changes,
      createdAt: activity.createdAt,
    };
  }

  async updateDenormalizedFields(
    taskId?: string,
    newTitle?: string,
    userId?: string,
    newUserName?: string,
  ) {
    const updateData: any = {};
    
    if (taskId && newTitle) updateData.taskTitle = newTitle;
    if (userId && newUserName) updateData.userName = newUserName;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.activity.updateMany({
        where: {
          ...(taskId && { taskId }),
          ...(userId && { userId }),
        },
        data: updateData,
      });
    }
  }
}