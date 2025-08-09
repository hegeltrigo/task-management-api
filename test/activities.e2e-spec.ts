import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ActivitiesService } from '../src/tasks/activities/activities.service';
import { ActivityFilterDto } from '../src/tasks/activities/dto/activity-filter.dto';

describe('ActivitiesController (e2e)', () => {
  let app: INestApplication;
  let activitiesService: ActivitiesService;
  let createdTaskId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
    }));
    await app.init();

    activitiesService = moduleFixture.get<ActivitiesService>(ActivitiesService);

    // Crear una tarea de prueba
    const taskResponse = await request(app.getHttpServer())
      .post('/tasks')
      .send({
        title: 'Test Task for Activities',
        description: 'This task will be used to test activities',
        projectId: 'valid-project-id',
        assigneeId: 'valid-user-id',
      });
    
    createdTaskId = taskResponse.body.id;

    // Crear algunas actividades de prueba
    await activitiesService.create({
      taskId: createdTaskId,
      type: 'COMMENT',
      content: 'First test comment',
      userId: 'valid-user-id'
    });

    await activitiesService.create({
      taskId: createdTaskId,
      type: 'STATUS_CHANGE',
      content: 'Status changed to IN_PROGRESS',
      userId: 'valid-user-id'
    });

    await activitiesService.create({
      taskId: 'another-task-id', // Otra tarea para probar filtros
      type: 'COMMENT',
      content: 'Comment on another task',
      userId: 'another-user-id'
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /activities/task/:taskId', () => {
    it('should return activities for a specific task with pagination', async () => {
      const response = await request(app.getHttpServer())
        .get(`/activities/task/${createdTaskId}`)
        .query({ page: 1, limit: 1 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.total).toBe(2); // 2 actividades para esta tarea
      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(1);
      
      // Verificar que todas las actividades pertenecen a la tarea correcta
      response.body.data.forEach(activity => {
        expect(activity.taskId).toBe(createdTaskId);
      });
    });

    it('should return 404 for non-existent task', async () => {
      await request(app.getHttpServer())
        .get('/activities/task/non-existent-task-id')
        .expect(404);
    });

    it('should validate pagination parameters', async () => {
      const response = await request(app.getHttpServer())
        .get(`/activities/task/${createdTaskId}`)
        .query({ page: 'invalid', limit: 'invalid' })
        .expect(400);

      expect(response.body.message).toContain('page must be a number');
      expect(response.body.message).toContain('limit must be a number');
    });
  });

  describe('GET /activities', () => {
    it('should return all activities with pagination and filtering', async () => {
      const filter: ActivityFilterDto = {
        type: 'COMMENT',
        userId: 'valid-user-id'
      };

      const response = await request(app.getHttpServer())
        .get('/activities')
        .query({ ...filter, page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      
      // Verificar que se aplicaron los filtros
      response.body.data.forEach(activity => {
        expect(activity.type).toBe('COMMENT');
        expect(activity.userId).toBe('valid-user-id');
      });
    });

    it('should return empty array when no activities match filters', async () => {
      const filter: ActivityFilterDto = {
        type: 'NON_EXISTENT_TYPE',
      };

      const response = await request(app.getHttpServer())
        .get('/activities')
        .query(filter)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(0);
    });

    it('should validate filter parameters', async () => {
      const response = await request(app.getHttpServer())
        .get('/activities')
        .query({ type: 'INVALID_TYPE' })
        .expect(400);

      expect(response.body.message).toContain('type must be one of the following values');
    });

    it('should return default pagination when not specified', async () => {
      const response = await request(app.getHttpServer())
        .get('/activities')
        .expect(200);

      expect(response.body.page).toBe(1);
      expect(response.body.limit).toBe(10);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
    });
  });
});