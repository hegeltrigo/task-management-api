# Task Management API

## Quick Start

1. Ensure you have Docker and Docker Compose installed
2. Clone the repository
3. Run `docker-compose up -d` to start PostgreSQL and Redis
4. Run `npm install`
5. Run `npm run prisma:generate`  to run the data model generation
6. Run `npm run prisma:migrate` to set up the database
7. Run `npm run seed` to populate sample data
8. Run `npm run start:dev` to start the application

The API will be available at `http://localhost:3000`

## Available Endpoints

- GET /tasks - List all tasks with filters
- GET /tasks/:id - Get a single task
- POST /tasks - Create a new task
- PUT /tasks/:id - Update a task
- DELETE /tasks/:id - Delete a task
- GET /projects - List all projects
- GET /users - List all users

## Task Filters

The GET /tasks endpoint supports the following query parameters:
- status: TODO, IN_PROGRESS, COMPLETED, CANCELLED
- priority: LOW, MEDIUM, HIGH, URGENT
- assigneeId: UUID of the assignee
- projectId: UUID of the project
- dueDateFrom: ISO date string
- dueDateTo: ISO date string
