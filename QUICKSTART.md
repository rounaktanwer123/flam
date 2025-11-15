# Quick Start Guide

Get up and running with queuectl in 5 minutes!

## Installation

```bash
# 1. Navigate to project directory
cd queuectl

# 2. Install dependencies
npm install

# 3. (Optional) Link for global access
npm link

# Or use directly:
# node src/app.js <command>
```

## Verify Installation

```bash
# Show help
queuectl --help

# Check version
queuectl --version
```

## Your First Job

### 1. Enqueue a simple job

```bash
queuectl enqueue '{"id":"hello","command":"echo Hello, queuectl!"}'
```

### 2. Start a worker

```bash
queuectl worker start
```

You should see output like:
```
Starting 1 worker(s)...
[Worker 1] Started
[Worker 1] Processing job: hello (attempt 1/3)
[Worker 1] Command: echo Hello, queuectl!
[Worker 1] Job hello completed successfully
[Worker 1] Output: Hello, queuectl!
```

### 3. Stop the worker (Ctrl+C)

Press `Ctrl+C` to gracefully stop the worker.

### 4. Check the results

```bash
queuectl list --state completed
```

## Common Workflows

### Batch Processing

```bash
# Enqueue multiple jobs
for i in {1..10}; do
  queuectl enqueue "{\"id\":\"job-$i\",\"command\":\"echo Processing $i\"}"
done

# Process with multiple workers
queuectl worker start --count 3
```

### Monitor Queue

```bash
# In one terminal
queuectl worker start --count 2

# In another terminal
queuectl status
queuectl list --state processing
```

### Handle Failures

```bash
# Enqueue a job that will fail
queuectl enqueue '{"id":"fail-test","command":"exit 1"}'

# Start worker to process it
queuectl worker start

# After it moves to DLQ, check it
queuectl dlq list

# Retry it
queuectl dlq retry fail-test
```

### Configure System

```bash
# Set max retries to 5
queuectl config set max-retries 5

# Set backoff to base 3 (slower backoff)
queuectl config set backoff-base 3

# View all config
queuectl config get
```

## Demo Script

Run the included demo to see all features:

**Linux/Mac:**
```bash
chmod +x demo.sh
./demo.sh
```

**Windows:**
```powershell
.\demo.ps1
```

## Run Tests

```bash
npm test
```

## Troubleshooting

### "Workers are already running"

```bash
queuectl worker stop
```

### Jobs not processing

1. Check if workers are running:
```bash
queuectl status
```

2. Check pending jobs:
```bash
queuectl list --state pending
```

3. Start workers if needed:
```bash
queuectl worker start
```

### Database issues

Delete the database to start fresh:
```bash
# Linux/Mac
rm src/db/queuectl.db*

# Windows
del src\db\queuectl.db*
```

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for system design
- Check [tests/test.js](tests/test.js) for examples

## Example Use Cases

### 1. Image Processing

```bash
queuectl enqueue '{"id":"img1","command":"convert input.jpg -resize 800x600 output.jpg"}'
queuectl enqueue '{"id":"img2","command":"convert input.jpg -thumbnail 100x100 thumb.jpg"}'
```

### 2. Data Backup

```bash
queuectl enqueue '{"id":"backup","command":"tar -czf backup.tar.gz /data"}'
queuectl enqueue '{"id":"upload","command":"aws s3 cp backup.tar.gz s3://bucket/"}'
```

### 3. API Calls

```bash
queuectl enqueue '{"id":"api1","command":"curl -X POST https://api.example.com/webhook"}'
```

### 4. Database Tasks

```bash
queuectl enqueue '{"id":"export","command":"pg_dump mydb > backup.sql"}'
queuectl enqueue '{"id":"cleanup","command":"psql -c \"DELETE FROM old_records WHERE date < now() - interval 1 year\""}'
```

---

Happy queuing! 🚀

