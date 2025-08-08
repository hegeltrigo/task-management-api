import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { EmailModule } from '../email/email.module';
import { PaginationService } from './pagination.service';


@Module({
  imports: [EmailModule],
  controllers: [TasksController],
  providers: [TasksService, PaginationService],
})
export class TasksModule {}
