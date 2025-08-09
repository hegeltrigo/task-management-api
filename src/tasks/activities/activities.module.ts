import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { ActivitiesController } from './activities.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { PaginationModule } from '../../common/pagination/pagination.module'; // También lo importamos aquí


@Module({
  imports: [PrismaModule, PaginationModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}