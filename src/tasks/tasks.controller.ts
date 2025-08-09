import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FindAllTasksDto } from './dto/find-all-tasks.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/user.decorator';
import { UserPayload } from '../auth/interfaces/user-payload.interface';

@Controller('tasks')
@UseGuards(JwtAuthGuard) // Protege todas las rutas
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // GET públicos (no requieren userId)
  @Get()
  async findAll(@Query() params: FindAllTasksDto) {
    return this.tasksService.findAll(params);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  // Operaciones que modifican datos (requieren userId)
  @Post()
  create(
    @Body() createTaskDto: CreateTaskDto,
    @CurrentUser() user: UserPayload
  ) {
    return this.tasksService.create(createTaskDto, user.userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateTaskDto: UpdateTaskDto,
    @CurrentUser() user: UserPayload
  ) {
    return this.tasksService.update(id, updateTaskDto, user.userId);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: UserPayload
  ) {
    return this.tasksService.remove(id, user.userId);
  }
}