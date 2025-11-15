#!/bin/bash

# Demo script for queuectl
# This script demonstrates the basic functionality of the queuectl system

echo "====================================="
echo "  queuectl Demo"
echo "====================================="
echo ""

# Ensure we're using the local version
alias queuectl="node src/app.js"

echo "Step 1: Check initial status"
echo "-----------------------------------"
queuectl status
echo ""

echo "Step 2: Configure the system"
echo "-----------------------------------"
queuectl config set max-retries 3
queuectl config set backoff-base 2
queuectl config get
echo ""

echo "Step 3: Enqueue test jobs"
echo "-----------------------------------"
echo "Enqueueing successful job..."
queuectl enqueue '{"id":"demo-success-1","command":"echo Hello from queuectl"}'
echo ""

echo "Enqueueing job that will succeed..."
queuectl enqueue '{"id":"demo-success-2","command":"echo Processing complete"}'
echo ""

echo "Enqueueing job with sleep..."
queuectl enqueue '{"id":"demo-slow","command":"sleep 3 && echo Long task done"}'
echo ""

echo "Enqueueing job that will fail..."
queuectl enqueue '{"id":"demo-fail","command":"exit 1"}'
echo ""

echo "Step 4: Check queue status"
echo "-----------------------------------"
queuectl status
echo ""

echo "Step 5: List pending jobs"
echo "-----------------------------------"
queuectl list --state pending
echo ""

echo "Step 6: Start 2 workers"
echo "-----------------------------------"
echo "Starting workers (this will process jobs in real-time)..."
echo "Press Ctrl+C after a few seconds to stop and continue the demo"
echo ""
queuectl worker start --count 2

