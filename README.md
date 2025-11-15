# queuectl

A robust command-line job queue management system with workers, automatic retries, exponential backoff, and a dead letter queue (DLQ).

## Features

- ✅ **Persistent Queue**: JSON-based storage for jobs, DLQ, and configuration
- ✅ **Multiple Workers**: Run multiple workers concurrently (`--count` flag)
- ✅ **Automatic Retries**: Failed jobs are automatically retried with exponential backoff
- ✅ **Exponential Backoff**: Configurable backoff formula: `delay = base ^ attempts` (seconds)
- ✅ **Dead Letter Queue (DLQ)**: Jobs exceeding max retries moved to DLQ
- ✅ **Job States**: pending → processing → completed/failed → dead
- ✅ **Graceful Shutdown**: Workers finish current job before stopping
- ✅ **Job Locking**: Prevents multiple workers from processing the same job
- ✅ **Configurable**: Set max retries, backoff base, and other parameters
- ✅ **Rich CLI**: Comprehensive command-line interface for all operations
- ✅ **Job Priority**: Priority-based job processing (1=highest, 5=lowest)
- ✅ **Job Timeout**: Configurable execution timeout for each job
- ✅ **Scheduled Jobs**: Schedule jobs to run at specific times

## Installation

### Prerequisites

- Node.js >= 16.0.0
- npm or yarn

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/rounaktanwer123/flam.git
cd flam

# 2. Install dependencies
npm install

# 3. (Optional) Link for global access
npm link
```

## Quick Start

```bash
# 1. Enqueue a job
queuectl enqueue '{"id":"job1","command":"echo Hello World"}'

# 2. Start a worker
queuectl worker start

# 3. Check status
queuectl status
```

## Architecture

### Project Structure

```
queuectl/
├── src/
│   ├── app.js              # CLI entry point
│   ├── cli/                # Command handlers
│   │   ├── enqueue.js      # Job enqueueing
│   │   ├── worker.js       # Worker management
│   │   ├── status.js       # Status display
│   │   ├── list.js         # Job listing
│   │   ├── getJob.js       # Single job details
│   │   ├── dlq.js          # DLQ operations
│   │   └── config.js       # Configuration
│   ├── core/               # Business logic
│   │   ├── storageService.js   # JSON file operations
│   │   ├── jobService.js       # Job CRUD & locking
│   │   ├── workerService.js    # Worker orchestration
│   │   ├── dlqService.js       # DLQ management
│   │   └── configService.js    # Config management
│   └── data/               # Persistent storage (auto-generated)
│       ├── jobs.json       # Active jobs queue
│       ├── dlq.json        # Dead letter queue
│       ├── config.json     # Configuration
│       └── workers.json    # Worker state
├── scripts/
│   ├── demo.sh             # Demo script (bash)
│   └── demo.ps1            # Demo script (PowerShell)
├── tests/
│   └── test.js             # Test suite
├── package.json
└── README.md
```

### Job Lifecycle

```
┌─────────┐
│ Enqueue │
└────┬────┘
     │
     ▼
┌─────────┐     ┌────────────┐     ┌───────────┐
│ Pending │────▶│ Processing │────▶│ Completed │
└────┬────┘     └─────┬──────┘     └───────────┘
     │                │
     │                │ (on failure)
     │                ▼
     │          ┌──────────┐
     │          │  Failed  │
     │          └────┬─────┘
     │               │
     │               │ (attempts < max_retries)
     │               │ Apply exponential backoff
     └───────────────┘
                     │
                     │ (attempts >= max_retries)
                     ▼
              ┌──────────┐
              │   Dead   │
              │  (DLQ)   │
              └──────────┘
```

## CLI Commands

### Enqueue Jobs

```bash
# Basic job
queuectl enqueue '{"id":"job1","command":"echo hello"}'

# Job with priority (1=highest, 5=lowest)
queuectl enqueue '{"id":"urgent","command":"backup.sh","priority":1}'

# Job with timeout (in seconds)
queuectl enqueue '{"id":"quick","command":"ping google.com","timeout":5}'

# Scheduled job (ISO timestamp)
queuectl enqueue '{"id":"scheduled","command":"echo future","run_at":"2025-11-20T10:00:00.000Z"}'
```

**Job Fields:**
- `id` (required): Unique job identifier
- `command` (required): Shell command to execute
- `priority` (optional): Priority level 1-5, default 3
- `timeout` (optional): Execution timeout in seconds, default 30
- `run_at` (optional): ISO timestamp for scheduled execution
- `max_retries` (optional): Override default max retries

### Worker Management

```bash
# Start single worker
queuectl worker start

# Start multiple workers
queuectl worker start --count 3

# Check worker status
queuectl worker status

# Stop all workers gracefully
queuectl worker stop
```

### Queue Status

```bash
# Show overall status
queuectl status
```

### List Jobs

```bash
# List all jobs
queuectl list

# Filter by state
queuectl list --state pending
queuectl list --state completed
queuectl list --state failed
queuectl list --state dead

# List jobs ready to run (scheduled)
queuectl list --due
```

### Job Details

```bash
# View detailed information about a specific job
queuectl job-get <job-id>
```

### Dead Letter Queue (DLQ)

```bash
# List dead jobs
queuectl dlq list

# Retry a specific dead job
queuectl dlq retry <job-id>

# Purge all dead jobs (permanent deletion)
queuectl dlq purge

# Show DLQ statistics
queuectl dlq stats
```

### Configuration

```bash
# View all configuration
queuectl config get

# Set configuration
queuectl config set max-retries 5
queuectl config set backoff-base 3
```

**Configuration Options:**
- `max-retries`: Maximum retry attempts (default: 3)
- `backoff-base`: Exponential backoff base (default: 2)

## Examples

### Example 1: Basic Usage

```bash
# Enqueue jobs
queuectl enqueue '{"id":"job1","command":"echo Task 1"}'
queuectl enqueue '{"id":"job2","command":"echo Task 2"}'
queuectl enqueue '{"id":"job3","command":"echo Task 3"}'

# Start worker
queuectl worker start

# Check status
queuectl status
```

### Example 2: Priority-Based Processing

```bash
# Enqueue jobs with different priorities
queuectl enqueue '{"id":"high","command":"echo HIGH","priority":1}'
queuectl enqueue '{"id":"normal","command":"echo NORMAL","priority":3}'
queuectl enqueue '{"id":"low","command":"echo LOW","priority":5}'

# Start worker (processes high priority first)
queuectl worker start
```

### Example 3: Handling Failures

```bash
# Enqueue a job that will fail
queuectl enqueue '{"id":"test-fail","command":"exit 1","max_retries":2}'

# Start worker
queuectl worker start

# Watch it retry with backoff
# Attempt 1: fails, retry after 2s
# Attempt 2: fails, moves to DLQ

# Check DLQ
queuectl dlq list

# Retry the job
queuectl dlq retry test-fail
```

## Demo Script

Run the comprehensive demo:

```bash
# Linux/Mac
chmod +x scripts/demo.sh
./scripts/demo.sh

# Windows PowerShell
.\scripts\demo.ps1
```

## Testing

```bash
# Run test suite
npm test
```

## Features Breakdown

### Job Priority
- Priority levels: 1 (highest) to 5 (lowest)
- Default priority: 3
- Workers process high-priority jobs first

### Job Timeout
- Configurable timeout per job
- Default: 30 seconds
- Process killed if timeout exceeded
- Failed jobs retry with backoff

### Scheduled Jobs
- Schedule jobs for future execution
- Use ISO timestamp format
- Workers skip jobs until scheduled time
- Use `queuectl list --due` to see ready jobs

### Retry & Exponential Backoff
- Automatic retries on failure
- Delay formula: `delay = base ^ attempts` (seconds)
- Example (base=2, max_retries=3):
  - Attempt 1 fails → retry after 2s
  - Attempt 2 fails → retry after 4s
  - Attempt 3 fails → move to DLQ

## Troubleshooting

### Workers Won't Start
```bash
queuectl worker stop
```

### Jobs Stuck in Processing
Jobs have a 5-minute lock timeout. They will automatically become available again.

### Clear All Data
```bash
rm -rf src/data/*
```

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new features
4. Submit a pull request

## License

MIT

---

**Built with ❤️ using Node.js and Commander.js**
