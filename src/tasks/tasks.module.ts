import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { EmailModule } from '../email/email.module';
import { PaginationService } from './pagination.service';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [
    EmailModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST'),  // Ex: 'localhost'
          port: configService.get('REDIS_PORT'),  // Ex: 6379
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    PaginationService,
    NotificationsProcessor,
  ],
})
export class TasksModule {}