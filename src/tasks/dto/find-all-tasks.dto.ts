import {
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { TaskStatus, TaskPriority } from '@prisma/client';

export class FindAllTasksDto {
  @IsOptional()
  @IsString()
  @IsIn(Object.values(TaskStatus))
  status?: TaskStatus;

  @IsOptional()
  @IsString()
  @IsIn(Object.values(TaskPriority))
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Transform(({ value }) => parseInt(value, 10))
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value, 10))
  limit?: number = 25;
}