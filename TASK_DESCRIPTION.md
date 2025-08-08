## Overview

You are provided with a REST API for a task management system built with NestJS, TypeScript, Prisma, and Redis. The application is functional but has several performance issues that need to be addressed. Additionally, you need to implement a new feature.

## Setup Instructions

1. Ensure you have Docker and Docker Compose installed
2. Clone the repository
3. Run `docker-compose up -d` to start PostgreSQL and Redis
4. Run `npm install`
5. Run `npm run prisma:generate`  to run the data model generation
6. Run `npm run prisma:migrate` to set up the database
7. Run `npm run seed` to populate sample data
8. Run `npm run start:dev` to start the application

The API will be available at `http://localhost:3000`

## Current API Endpoints

- `GET /tasks` - List all tasks with filters
- `GET /tasks/:id` - Get a single task
- `POST /tasks` - Create a new task
- `PUT /tasks/:id` - Update a task
- `DELETE /tasks/:id` - Delete a task
- `GET /projects` - List all projects
- `GET /users` - List all users

## Part 1: Performance Optimization

Users have reported that the API becomes noticeably slow as the amount of data grows. The application works correctly with small datasets but exhibits performance degradation with larger volumes of data.

### Reported Issues:

1. **API Response Times**: The `/tasks` endpoint response time increases significantly with the number of tasks in the system. Some users report response times over 5 seconds with just a few hundred tasks.
2. **Database Load**: The database server shows unusually high activity during normal operations, particularly when fetching task lists.
3. **Task Assignment Delays**: Creating or updating tasks with assignees takes longer than expected, sometimes causing timeouts in client applications.
4. **Search Performance**: Filtering tasks by various criteria (status, dates, assignee, etc.) becomes progressively slower as the dataset grows.

### Your Task:

Investigate the codebase to identify and fix performance bottlenecks. The application should be able to handle thousands of tasks efficiently. Consider:

- Database query efficiency
- Application architecture patterns
- Asynchronous vs synchronous operations
- Database optimization techniques

Document all performance issues you find and the solutions you implement in your `SOLUTION.md` file.

## Part 2: Implement New Feature

### Feature: Task Activity Log

Implement a comprehensive activity logging system that tracks all changes made to tasks.

### Requirements:

1. **Track all changes** to tasks including:
    - Field updates (title, description, status, priority, due date, assignee)
    - Task creation and deletion
    - Tag additions/removals
2. **API Endpoints** to implement:
    - `GET /tasks/:id/activities` - Get all activities for a specific task
        - Should return who made the change, when, and what changed
        - Support pagination
    - `GET /activities` - Get all activities across all tasks
        - Support filtering by user, date range, and action type
        - Support pagination
3. **Activity Log Format**:
Each activity should include:
    - User who made the change
    - Timestamp
    - Action type (created, updated, deleted)
    - Changed fields with old and new values
    - Task ID and title

### Example Response:

```json
{
  "data": [
    {
      "id": "uuid",
      "taskId": "task-uuid",
      "taskTitle": "Implement authentication",
      "userId": "user-uuid",
      "userName": "John Doe",
      "action": "updated",
      "changes": {
        "status": {
          "old": "in_progress",
          "new": "completed"
        },
        "assigneeId": {
          "old": "user-uuid-1",
          "new": "user-uuid-2"
        }
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "perPage": 20
  }
}

```

## API Testing Collections

To help you test the API endpoints, we've included a Postman collection in the `api-collections/` directory:

- **Postman Collection**: `api-collections/task-management-api.postman_collection.json`

This collection includes:

- All existing endpoints organized by category
- Pre-configured environment variables for easy testing
- Example request bodies with all required/optional fields
- Detailed descriptions for each endpoint
- Performance testing requests to help identify issues
- Placeholder requests for the activity log endpoints you'll implement

## Evaluation Criteria

### Code Quality

- Clean, readable, and maintainable code
- Proper error handling
- Following NestJS best practices
- TypeScript usage

### Performance

- Efficiency of database queries
- Proper use of indexes
- Caching strategy where appropriate
- Scalability considerations

### Feature Completeness

- All requirements implemented
- Edge cases handled

### Testing

- Unit tests for new features
- Integration tests for API endpoints

## Submission Guidelines

1. Fix all performance issues identified in Part 1
2. Implement the new feature as specified in Part 2
3. Include a `SOLUTION.md` file explaining:
    - Your approach to fixing each performance issue
    - Your implementation strategy for the activity log
    - Any trade-offs or assumptions made
    - Potential future improvements
4. Ensure all tests pass and the application runs correctly

## Notes

- Focus on backend performance and code quality
- You may install additional npm packages if needed
- Feel free to refactor existing code structure if it improves the solution
- Redis is available if you choose to use it
- The email service is mocked