import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('TasksController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
    }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/tasks (GET) - should demonstrate N+1 query problem', async () => {
    // This test will show multiple queries being executed
    const response = await request(app.getHttpServer())
      .get('/tasks')
      .expect(200);

    // Check console output to see the number of queries executed
    expect(response.body).toBeInstanceOf(Array);
    expect(response.body.length).toBeGreaterThan(0);
    
    // Each task should have assignee, project, and tags
    response.body.forEach(task => {
      expect(task).toHaveProperty('assignee');
      expect(task).toHaveProperty('project');
      expect(task).toHaveProperty('tags');
    });
  });

  it('/tasks (GET) - should demonstrate inefficient filtering', async () => {
    // This test shows that filtering happens in memory
    const startTime = Date.now();
    
    const response = await request(app.getHttpServer())
      .get('/tasks?status=TODO&priority=HIGH')
      .expect(200);

    const endTime = Date.now();
    
    // With in-memory filtering, this takes longer than necessary
    console.log(`Filtering took ${endTime - startTime}ms`);
    
    expect(response.body).toBeInstanceOf(Array);
    response.body.forEach(task => {
      expect(task.status).toBe('TODO');
      expect(task.priority).toBe('HIGH');
    });
  });

  it('/tasks (POST) - should demonstrate blocking email notification', async () => {
    const startTime = Date.now();
    
    const response = await request(app.getHttpServer())
      .post('/tasks')
      .send({
        title: 'Test Task',
        description: 'Test Description',
        projectId: 'valid-project-id', // Use actual ID from seed
        assigneeId: 'valid-user-id', // Use actual ID from seed
      })
      .expect(201);

    const endTime = Date.now();
    
    // This should take 2+ seconds due to synchronous email
    console.log(`Task creation took ${endTime - startTime}ms`);
    expect(endTime - startTime).toBeGreaterThan(2000);
  });
});
