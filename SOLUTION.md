# Solution Documentation

## Part 1: Performance Issues Fixed

### [Issue fixed]


**Problem Identified:**

1. **API Response Times**
n+1 querys in /tasks
First, you fetch all the tasks (this.prisma.task.findMany()).
Then, for each task, you make separate queries to fetch:
the assignee, the project, the tags
This results in 1 initial query + N additional queries (where N is the number of tasks).

2. **Database Load**
Each query without indexes consumes more resources from the PostgreSQL server.
The /tasks endpoint forces the DB to manually process filtering.

4. **Search Performance**
Multi-filter searches (status, priority, assigneeId, projectId, search) were slow due to missing database indexes.

Text searches (title, description) with OR conditions triggered full table scans in PostgreSQL.

Inefficient pagination (LIMIT/OFFSET performed poorly on large datasets).

Redis caching was not utilized for frequent queries.

**Solution Implemented:**
1. **API Response Times**
Optimize queries with includes for relations in /tasks.
2. **Database Load**
Added indexes for foreign keys and other frequently queried columns.
4. **Search Performance**
Database Optimization (Prisma/PostgreSQL): 
 - Composite indexes for common queries 
 - Optimized Pagination with replaced OFFSET with limit-based pagination (LIMIT 25) to   reduce load on large datasets
 - Added totalPages for efficient frontend navigation
Cache Layer (Redis): 
 - Parameter-Based Caching
 - Automatic Cache Invalidation
Query Optimization:
  - Case-Insensitive Text Search
  - Costly Query Protection with maximum limit of 100 items per request (MAX_LIMIT = 100)
**Performance Impact:**

1. **API Response Times**
for tasks
Actual (N+1)	    ~500ms	~5000ms
Optimized (join)	~50ms	~200ms
actual ![alt text](image.png)
optimized ![alt text](image-1.png)
2. **Database Load**
optimized after indexes ![alt text](image-2.png)
4. **Search Performance**
![alt text](image-3.png)

## Part 2: Activity Log Feature

### Implementation Approach

[Describe your overall approach to implementing the activity log]

### Database Schema Design

[Explain your schema choices]

### API Design Decisions

[Explain your API design choices]

### Performance Considerations

[Describe any performance optimizations you implemented]

### Trade-offs and Assumptions

[List any trade-offs you made or assumptions about requirements]

## Future Improvements

[Suggest potential improvements that could be made with more time]

## Time Spent

[Document how long you spent on each part]
