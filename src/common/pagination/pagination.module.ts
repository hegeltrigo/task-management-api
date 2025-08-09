import { Module } from '@nestjs/common';
import { PaginationService } from './pagination.service';

@Module({
  providers: [PaginationService],
  exports: [PaginationService], // Exportamos el servicio para que otros módulos lo usen
})
export class PaginationModule {}