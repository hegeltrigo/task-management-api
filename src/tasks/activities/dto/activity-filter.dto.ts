import { IsOptional, IsDateString, IsEnum } from 'class-validator';
import { ActivityAction } from '../constants';

export class ActivityFilterDto {
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @IsEnum(ActivityAction)
  action?: ActivityAction;

  @IsOptional()
  userId?: string;
}