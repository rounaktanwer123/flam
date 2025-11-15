# queuectl Architecture

This document describes the internal architecture and design decisions of queuectl.

## Overview

queuectl is a job queue management system built with Node.js that provides:
- Persistent job storage using SQLite
- Multiple concurrent workers for job processing
- Automatic retry mechanism with exponential backoff
- Dead Letter Queue (DLQ) for failed jobs
- Configuration management
- Comprehensive CLI interface

## Core Architecture

### Layer Architecture

```
┌─────────────────────────────────────┐
│         CLI Layer (src/cli/)        │  ← User Interface
├─────────────────────────────────────┤
│       Core Services (src/core/)     │  ← Business Logic
├─────────────────────────────────────┤
│   Storage Layer (SQLite Database)   │  ← Data Persistence
└─────────────────────────────────────┘
```

### Component Diagram

```
┌──────────────┐
│   app.js     │  Entry Point
│  (Commander) │
└──────┬───────┘
       │
       ├─────┬──────┬──────┬──────┬──────┐
       │     │      │      │      │      │
       ▼     ▼      ▼      ▼      ▼      ▼
    ┌────┬────┬────┬────┬────┬────┐
    │CLI Handlers (Command Layer) │
    └─┬──┴─┬──┴─┬──┴─┬──┴─┬──┴─┬──┘
      │    │    │    │    │    │
      ▼    ▼    ▼    ▼    ▼    ▼
    ┌───────────────────────────────┐
    │     Core Services Layer       │
    │ ┌───────┐  ┌─────┐  ┌─────┐  │
    │ │  Job  │  │ DLQ │  │Config│ │
    │ │Service│  │Svc  │  │ Svc │  │
    │ └───┬───┘  └──┬──┘  └──┬──┘  │
    │     │         │        │      │
    │ ┌───▼─────────▼────────▼───┐  │
    │ │   Storage Service        │  │
    │ └──────────┬───────────────┘  │
    └────────────┼──────────────────┘
                 ▼
         ┌──────────────┐
         │    SQLite    │
         │   Database   │
         └──────────────┘
```

## Database Schema

### Jobs Table

```sql
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,           -- Unique job identifier
  command TEXT NOT NULL,         -- Shell command to execute
  state TEXT NOT NULL,           -- Job state: pending|processing|completed|failed|dead
  attempts INTEGER DEFAULT 0,    -- Number of execution attempts
  max_retries INTEGER DEFAULT 3, -- Maximum retry attempts
  created_at TEXT NOT NULL,      -- ISO timestamp of job creation
  updated_at TEXT NOT NULL,      -- ISO timestamp of last update
  locked_by TEXT DEFAULT NULL,   -- Worker ID that locked this job
  locked_at TEXT DEFAULT NULL,   -- Timestamp when job was locked
  result TEXT DEFAULT NULL,      -- Output from successful execution
  error TEXT DEFAULT NULL        -- Error message from failed execution
)
```

### Config Table

```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,          -- Configuration key
  value TEXT NOT NULL            -- Configuration value (stored as string)
)
```

### Workers Table

```sql
CREATE TABLE workers (
  worker_id TEXT PRIMARY KEY,    -- Unique worker identifier
  pid INTEGER NOT NULL,          -- Process ID
  status TEXT NOT NULL,          -- Worker status
  started_at TEXT NOT NULL,      -- When worker started
  last_heartbeat TEXT NOT NULL   -- Last heartbeat timestamp
)
```

## Service Responsibilities

### 1. Storage Service (`storageService.js`)

**Purpose:** Manages database connection and initialization

**Key Functions:**
- `initDatabase()` - Create database and tables
- `getDatabase()` - Get database connection
- `closeDatabase()` - Close database connection
- `transaction()` - Execute operations in a transaction

**Design Decisions:**
- Uses SQLite with WAL (Write-Ahead Logging) mode for better concurrency
- Single database instance shared across all services
- Database file stored in `src/db/queuectl.db`

### 2. Job Service (`jobService.js`)

**Purpose:** Manages all job CRUD operations and state transitions

**Key Functions:**
- `createJob(jobData)` - Create a new job
- `getJob(jobId)` - Retrieve job by ID
- `getJobsByState(state)` - Filter jobs by state
- `acquireNextJob(workerId)` - Atomically lock and acquire next pending job
- `completeJob(jobId, result)` - Mark job as completed
- `failJob(jobId, error)` - Handle job failure with retry logic
- `getQueueStats()` - Get statistics about queue

**State Machine:**

```
         ┌──────────┐
    ┌───▶│ PENDING  │◀─────┐
    │    └────┬─────┘      │
    │         │             │
    │         │ acquire     │
    │         ▼             │
    │    ┌───────────┐     │
    │    │PROCESSING │     │
    │    └─────┬─────┘     │
    │          │            │
    │    ┌─────▼──────┐    │
    │    │  SUCCESS?  │    │
    │    └─────┬──────┘    │
    │          │            │
    │     ┌────┴─────┐     │
    │     │          │     │
    │    YES        NO     │
    │     │          │     │
    │     ▼          ▼     │
    │ ┌─────────┐ ┌────┐  │
    │ │COMPLETED│ │FAIL│  │
    │ └─────────┘ └─┬──┘  │
    │               │      │
    │          attempts++  │
    │               │      │
    │         ┌─────▼──────┐
    │         │ < max_retry?│
    │         └─────┬───────┘
    │               │
    │          ┌────┴─────┐
    │          │          │
    │         YES        NO
    │          │          │
    └──────────┘          ▼
                      ┌──────┐
                      │ DEAD │
                      │ (DLQ)│
                      └──────┘
```

**Locking Mechanism:**
- Uses database-level locking via transactions
- Job marked as "processing" when acquired
- Lock includes worker ID and timestamp
- Stale locks (>5 minutes) automatically expire

### 3. Worker Service (`workerService.js`)

**Purpose:** Orchestrates worker processes and job execution

**Key Functions:**
- `startWorkers(count)` - Start multiple workers
- `stopWorkers()` - Gracefully stop all workers
- `getWorkerStatus()` - Get current worker status
- `setupGracefulShutdown()` - Handle SIGINT/SIGTERM

**Worker Lifecycle:**

```
  Start ─┐
         │
         ▼
    ┌─────────┐
    │  IDLE   │
    └────┬────┘
         │
         ▼
    ┌──────────┐
    │ Acquire  │ ───no job──┐
    │   Job    │            │
    └────┬─────┘            │
         │                  │
      has job              │
         │                  │
         ▼                  │
    ┌──────────┐            │
    │ Execute  │            │
    │ Command  │            │
    └────┬─────┘            │
         │                  │
    ┌────▼─────┐            │
    │ Success? │            │
    └────┬─────┘            │
         │                  │
    ┌────┴────┐             │
    │         │             │
   YES       NO             │
    │         │             │
    ▼         ▼             │
Complete   Fail+Retry       │
    │         │             │
    └─────────┴─────────────┘
         │
         ▼
    Shutdown? ─no──┐
         │         │
        yes        │
         │         │
         ▼         │
       Stop    ◀───┘
```

**Exponential Backoff:**
- Formula: `delay = backoff_base ^ attempts` (seconds)
- Example with base=2: 2s, 4s, 8s, 16s...
- Implemented by resetting job to pending state
- Workers naturally wait before picking it up again

**Process Execution:**
- Uses Node.js `child_process.exec()`
- 5-minute timeout per job
- 10MB output buffer
- Exit code determines success/failure

### 4. DLQ Service (`dlqService.js`)

**Purpose:** Manages dead letter queue operations

**Key Functions:**
- `listDeadJobs()` - Get all dead jobs
- `retryDeadJob(jobId)` - Move job back to pending
- `retryAllDeadJobs()` - Retry all dead jobs
- `deleteDeadJob(jobId)` - Permanently delete job
- `getDLQStats()` - Get DLQ statistics

**Design Philosophy:**
- Jobs in DLQ are preserved for analysis
- Can be retried manually with reset attempts
- Provides safety net for transient failures

### 5. Config Service (`configService.js`)

**Purpose:** Manages application configuration

**Key Functions:**
- `getConfig(key)` - Get config value
- `setConfig(key, value)` - Set config value
- `getAllConfig()` - Get all config
- `getMaxRetries()` - Typed getter for max retries
- `getBackoffBase()` - Typed getter for backoff base

**Built-in Configurations:**
- `max-retries`: Maximum retry attempts (default: 3)
- `backoff-base`: Exponential backoff base (default: 2)

## CLI Architecture

### Command Structure

```
queuectl
├── enqueue <json>
├── worker
│   ├── start [--count N]
│   ├── stop
│   └── status
├── status
├── list [--state <state>]
├── dlq
│   ├── list
│   ├── retry <job-id>
│   ├── retry-all
│   └── stats
└── config
    ├── get [key]
    └── set <key> <value>
```

### CLI Layer Flow

```
User Input
    ↓
Commander.js (parsing)
    ↓
CLI Handler (validation)
    ↓
Core Service (business logic)
    ↓
Storage Service (persistence)
    ↓
Database
```

## Concurrency & Thread Safety

### Race Condition Prevention

1. **Job Acquisition:**
   - Uses SQLite transactions for atomicity
   - UPDATE with WHERE condition ensures single winner
   - Failed updates return 0 changes

2. **Worker Coordination:**
   - No shared memory between workers
   - All state in database
   - Lock timeout handles crashed workers

3. **Database Concurrency:**
   - SQLite WAL mode allows multiple readers
   - Single writer at a time
   - Automatic retry on SQLITE_BUSY

### Performance Considerations

- **Worker Count:** Recommended max 10 workers
- **Polling Interval:** 1 second when no jobs available
- **Lock Timeout:** 5 minutes for stale locks
- **Database:** Indexed on `state` and `created_at`

## Error Handling

### Levels of Error Handling

1. **Command Execution Errors:**
   - Caught by worker service
   - Triggers retry mechanism
   - Logged with error message

2. **Database Errors:**
   - SQLITE_CONSTRAINT → Duplicate job
   - SQLITE_BUSY → Retry transaction
   - Other → Propagate to CLI

3. **CLI Errors:**
   - Validation errors → User-friendly message + exit(1)
   - Service errors → Error message + exit(1)
   - Unexpected errors → Stack trace + exit(1)

## Extensibility Points

### Adding New Job Types

1. Add job type field to schema
2. Extend `createJob()` validation
3. Create type-specific executor in worker service
4. Add type filter to `list` command

### Adding New Commands

1. Create handler in `src/cli/`
2. Register in `src/app.js`
3. Add to README documentation
4. Add tests in `tests/test.js`

### Custom Backoff Strategies

1. Add config for strategy type
2. Extend `calculateBackoffDelay()` in worker service
3. Support: exponential, linear, fibonacci, etc.

## Testing Strategy

### Unit Tests

- Test each service independently
- Mock database for isolation
- Test edge cases and error paths

### Integration Tests

- Test full job lifecycle
- Test worker concurrency
- Test state transitions
- Test retry mechanism

### Manual Testing

- Use demo scripts
- Test with real shell commands
- Test graceful shutdown
- Test failure scenarios

## Security Considerations

### Command Injection

- ⚠️ Jobs execute shell commands
- No input sanitization (by design)
- Users must trust job sources
- Consider sandboxing for production

### Database Access

- Local file-based database
- No network exposure
- File permissions protect data

### Worker Isolation

- Workers share database
- No shared memory
- Crash in one doesn't affect others

## Future Enhancements

### Potential Features

1. **Job Priorities:** Priority queue for urgent jobs
2. **Job Dependencies:** Wait for other jobs to complete
3. **Scheduled Jobs:** Run at specific times
4. **Job Chains:** Pipeline multiple jobs
5. **Web UI:** Browser-based monitoring
6. **Metrics:** Prometheus/Grafana integration
7. **Notifications:** Webhooks for job completion
8. **Distributed:** Multiple machines via network DB
9. **Job Grouping:** Batch operations on job groups
10. **Rate Limiting:** Throttle job execution

### Scalability Improvements

1. **Database:** Switch to PostgreSQL for multi-machine
2. **Message Queue:** Use Redis or RabbitMQ
3. **Worker Pool:** Dynamic scaling based on load
4. **Monitoring:** Health checks and metrics
5. **Logging:** Structured logging with levels

## Design Principles

1. **Simplicity:** Clear, readable code over clever tricks
2. **Reliability:** Graceful error handling and recovery
3. **Persistence:** All state survives restarts
4. **Atomicity:** Operations are all-or-nothing
5. **Observability:** Rich status and debugging info
6. **Modularity:** Loosely coupled services
7. **Testability:** Easy to test in isolation

---

**Last Updated:** 2025-01-15
**Version:** 1.0.0

