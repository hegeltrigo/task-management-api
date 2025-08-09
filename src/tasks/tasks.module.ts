import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { EmailModule } from '../email/email.module';
import { NotificationsProcessor } from './notifications.processor';
import { ActivitiesModule } from './activities/activities.module';
import { PaginationModule } from '../common/pagination/pagination.module'; // Importamos directamente

@Module({
  imports: [
    EmailModule,
    PaginationModule, 
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
    ActivitiesModule
  ],
  controllers: [TasksController],
  providers: [
    TasksService,
    NotificationsProcessor,
  ],
})
export class TasksModule {}