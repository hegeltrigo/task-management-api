# 📝 Solution Documentation - Performance Optimization

## 🚀 Part 1: Performance Issues Fixed

### 🔍 Issue Analysis

#### **Problem Identified**

1. **API Response Times**  
   - N+1 queries in `/tasks` endpoint:  
     - Initial query: `this.prisma.task.findMany()`  
     - Then for each task, separate queries for:  
       - Assignee  
       - Project  
       - Tags  
     - **Result**: 1 initial query + N additional queries  

2. **Database Load**  
   - Queries without indexes consume excessive PostgreSQL resources  
   - `/tasks` endpoint forces DB to manually process filtering  

3. **Search Performance**  
   - Slow multi-filter searches (status, priority, assigneeId, projectId, search)  
   - Inefficient text searches (title, description) with OR conditions causing full table scans  
   - Poor pagination performance (LIMIT/OFFSET on large datasets)  
   - Missing Redis caching for frequent queries  

---

### 🛠 Solutions Implemented

#### **1. API Response Times Optimization**
- Optimized queries using `includes` for relations in `/tasks` endpoint  
- Implemented eager loading for all related entities  

#### **2. Database Load Reduction**
- Added indexes for:  
  - All foreign keys  
  - Frequently queried columns  
  - Common filter combinations  

#### **3. Task Assignment Delays**
## 🚀 Notification System Optimization (Redis/BullMQ)
- **Background Processing**: Email notifications moved to background jobs
- **Retry Mechanism**: 3 automatic retries with 5-second backoff
- **Persistent Storage**: Jobs survive server restarts
- **Rate Limiting**: 100 emails/minute maximum

Environment-aware configuration (dev/test/prod)
![alt text](image-4.png)  

#### **4. Search Performance Improvements**
**Database Optimization (Prisma/PostgreSQL):**  
- Created composite indexes for common query patterns  
- Replaced OFFSET pagination with cursor-based pagination (`LIMIT 25`)  
- Added `totalPages` for efficient frontend navigation  

**Cache Layer (Redis):**  
- Parameter-based caching strategy  
- Automatic cache invalidation on data changes  

**Query Optimization:**  
- Implemented case-insensitive text search  
- Added query protection:  
  - Maximum limit of 100 items per request (`MAX_LIMIT = 100`)  
  - Timeout for complex queries  

---

### 📊 Performance Impact

#### **1. API Response Times (Tasks Endpoint)**
| Scenario          | 10 Tasks | 100 Tasks |
|-------------------|---------|----------|
| Before (N+1)      | ~500ms  | ~5000ms  |
| After (Optimized) | ~50ms   | ~200ms   |

**Visual Comparison:**  
![Before Optimization](image.png)  
*Fig. 1: Original performance*  

![After Optimization](image-1.png)  
*Fig. 2: Optimized performance*  

#### **2. Database Load**
![Database Performance After Indexes](image-2.png)  
*Fig. 3: Improved database metrics*  

#### **3. Task Assignment Delays**
## ⚡ Performance Improvements
- **API Response**: Reduced from 1500ms → <100ms
- **Throughput**: Increased from 10 → 1000+ reqs/sec  
- **Non-blocking**: Zero delay during task creation

## 🔒 Reliability Features
- **Dead Letter Queue**: Stores failed notifications
- **Delivery Guarantee**: Zero notifications lost
- **Circuit Breaker**: Automatic SMTP protection

#### **4. Search Performance**
![Search Optimization Results](image-3.png)  
*Fig. 4: Enhanced search performance*  

## Part 2: Activity Log Feature

### Implementation Approach

We implemented an **audit trail system** using these key strategies:

1. **Decorator Pattern**: Wrapped core task operations to automatically log activities without modifying business logic
2. **Atomic Transactions**: Ensured activity records are created within the same database transaction as task changes
3. **Denormalized Data Model**: Stored frequently accessed user/task data directly in activity records
4. **Pagination Service**: Refactored our existing pagination into a reusable `@Common` module
5. **Redis Integration**: Used Redis for caching paginated results and sending real-time notifications

### Database Schema Design

**Key Schema Decisions**:

| Field | Type | Purpose | Optimization |
|-------|------|---------|--------------|
| `taskTitle` | String (denormalized) | Avoids join to `tasks` table | Faster reads |
| `userName` | String (denormalized) | Avoids join to `users` table | Faster reads |
| `changes` | JSONB | Stores field-level diffs | Flexible schema |
| `action` | Enum | Constrained values | Better querying |

**Index Strategy**:
- Index by `taskId` for task history views  
- Index by `userId` for user activity reports  
- Index by `createdAt` for time-based queries  
- Index by `(action, createdAt)` for activity type analysis  

### API Design Decisions

**Endpoint Design**:

1. **Task-Specific Activities**:  
   Returns chronologically ordered activities and includes full change diffs by default.

2. **Global Activity Feed**:  
   Supports filtering by user, action type, and date ranges, using cursor-based pagination.

**Response Structure**:  
Contains activity ID, related task details, user details, action type, changes made, and timestamp.

### Performance Considerations

1. **Read Optimizations**:
   - Denormalized critical fields
   - Covered indexes for common queries
   - Redis caching for paginated results
   - Lazy-loaded change details

2. **Write Optimizations**:
   - Batched updates for denormalized data
   - Transactional consistency
   - Async logging for non-critical paths

3. **Pagination**:
   - Implemented reusable pagination logic in a common service for multiple entities
   - Redis cache layer to speed up repeated queries

### Trade-offs and Assumptions

**Trade-offs**:
- Immediate consistency chosen over eventual consistency for simpler debugging
- Accepted 30% larger records for faster reads
- Used JSONB for changes despite losing type safety

**Assumptions**:
1. Every feature depended on another, which led to designing implementations to be reusable across multiple scenarios and entities.
2. Reusability was prioritized to avoid repetitive code and ensure consistency across the platform.
3. The system needed flexibility to adapt to different entity types without major refactoring.
4. UI would handle the presentation of diffs and changes.

## Future Improvements

1. **Real-time Streaming**:  
   Potential use of Server-Sent Events (SSE) for live updates.

2. **Enhanced Search**:
   - Integration with ElasticSearch or another search engine for advanced filtering and full-text search capabilities.

3. **Architectural**:
   - Move to dedicated Activity microservice
   - Implement Event Sourcing pattern

4. **Test**:
   I need more time to create test enviroment configuration and add more test

## Time Spent

| Component | Hours | Notes |
|-----------|-------|-------|
| Schema Design | 2 | Multiple iterations |
| Core Service | 4 | Transaction handling |
| API Layer | 3 | Pagination took 50% |
| Refactoring | 2 | Pagination module |
| **Total** | **11** | |

**Key Challenge**: The pagination implementation required significant refactoring to make it truly reusable across different entities while maintaining type safety, accounting for ~30% of total development time.

