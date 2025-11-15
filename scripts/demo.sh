#!/bin/bash

# Demo script for queuectl
# Demonstrates all major features: enqueue, workers, retry, DLQ

echo "================================================"
echo "  queuectl Demo - Job Queue System"
echo "================================================"
echo ""

# Alias for convenience
QUEUECTL="node src/app.js"

echo "Step 1: Configure the system"
echo "-----------------------------------"
$QUEUECTL config set max-retries 3
$QUEUECTL config set backoff-base 2
echo ""
echo "Current configuration:"
$QUEUECTL config get
echo ""

echo "Step 2: Enqueue test jobs"
echo "-----------------------------------"
echo "Enqueueing 3 jobs..."
$QUEUECTL enqueue '{"id":"demo-job-1","command":"echo Job 1: Hello from queuectl!"}'
echo ""
$QUEUECTL enqueue '{"id":"demo-job-2","command":"echo Job 2: Processing data..."}'
echo ""
$QUEUECTL enqueue '{"id":"demo-job-3","command":"echo Job 3: Task complete!"}'
echo ""

echo "Enqueueing a job that will fail (for DLQ demo)..."
$QUEUECTL enqueue '{"id":"demo-fail","command":"exit 1","max_retries":2}'
echo ""

echo "Step 3: Check initial queue status"
echo "-----------------------------------"
$QUEUECTL status
echo ""

echo "Step 4: List pending jobs"
echo "-----------------------------------"
$QUEUECTL list --state pending
echo ""

echo "Step 5: Start 2 workers"
echo "-----------------------------------"
echo "Starting workers... (will run for 10 seconds)"
echo ""

# Start workers in background
$QUEUECTL worker start --count 2 &
WORKER_PID=$!

# Wait for jobs to process
sleep 10

# Stop workers
echo ""
echo "Stopping workers..."
kill -INT $WORKER_PID 2>/dev/null
wait $WORKER_PID 2>/dev/null

echo ""
echo "Step 6: Check updated status"
echo "-----------------------------------"
$QUEUECTL status
echo ""

echo "Step 7: List completed jobs"
echo "-----------------------------------"
$QUEUECTL list --state completed
echo ""

echo "Step 8: Check Dead Letter Queue"
echo "-----------------------------------"
$QUEUECTL dlq list
echo ""

echo "Step 9: Retry a dead job"
echo "-----------------------------------"
echo "Retrying demo-fail job..."
$QUEUECTL dlq retry demo-fail
echo ""

echo "Step 10: Final status"
echo "-----------------------------------"
$QUEUECTL status
echo ""

echo "Step 11: DLQ Statistics"
echo "-----------------------------------"
$QUEUECTL dlq stats
echo ""

echo "================================================"
echo "  Demo Complete!"
echo "================================================"
echo ""
echo "Key Features Demonstrated:"
echo "  ✓ Job enqueueing"
echo "  ✓ Multiple workers (2 workers)"
echo "  ✓ Automatic retry with exponential backoff"
echo "  ✓ Dead Letter Queue (DLQ)"
echo "  ✓ Job state transitions"
echo "  ✓ Configuration management"
echo ""
echo "Try it yourself:"
echo "  queuectl enqueue '{\"id\":\"my-job\",\"command\":\"echo test\"}'"
echo "  queuectl worker start --count 3"
echo "  queuectl status"
echo ""

