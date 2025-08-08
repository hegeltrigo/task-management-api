# Solution Documentation

## Part 1: Performance Issues Fixed

### [Issue fixed]


**Problem Identified:**

/tasks
n+1 querys 

First, you fetch all the tasks (this.prisma.task.findMany()).
Then, for each task, you make separate queries to fetch:
the assignee, the project, the tags
This results in 1 initial query + N additional queries (where N is the number of tasks).

**Solution Implemented:**
/tasks
Optimize queries with includes for relations.

**Performance Impact:**
/tasks
Actual (N+1)	    ~500ms	~5000ms
Optimized (join)	~50ms	~200ms
actual ![alt text](image.png)
optimez ![alt text](image-1.png)

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
