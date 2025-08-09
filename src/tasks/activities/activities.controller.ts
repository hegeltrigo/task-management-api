import { Controller, Get, Param, Query } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivityFilterDto } from './dto/activity-filter.dto';

@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get('task/:taskId')
  async getTaskActivities(
    @Param('taskId') taskId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.activitiesService.getTaskActivities(taskId, page, limit);
  }

  @Get()
  async getAllActivities(
    @Query() filter: ActivityFilterDto,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.activitiesService.getAllActivities(filter, page, limit);
  }
}