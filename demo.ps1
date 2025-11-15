# Demo script for queuectl (PowerShell version)
# This script demonstrates the basic functionality of the queuectl system

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  queuectl Demo" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# Function to run queuectl commands
function Invoke-QueueCtl {
    param([string]$Command)
    node src/app.js $Command
}

Write-Host "Step 1: Check initial status" -ForegroundColor Green
Write-Host "-----------------------------------"
node src/app.js status
Write-Host ""

Write-Host "Step 2: Configure the system" -ForegroundColor Green
Write-Host "-----------------------------------"
node src/app.js config set max-retries 3
node src/app.js config set backoff-base 2
node src/app.js config get
Write-Host ""

Write-Host "Step 3: Enqueue test jobs" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "Enqueueing successful job..."
node src/app.js enqueue '{\"id\":\"demo-success-1\",\"command\":\"echo Hello from queuectl\"}'
Write-Host ""

Write-Host "Enqueueing another successful job..."
node src/app.js enqueue '{\"id\":\"demo-success-2\",\"command\":\"echo Processing complete\"}'
Write-Host ""

Write-Host "Enqueueing job with timeout..."
node src/app.js enqueue '{\"id\":\"demo-slow\",\"command\":\"timeout /t 3 /nobreak && echo Long task done\"}'
Write-Host ""

Write-Host "Enqueueing job that will fail..."
node src/app.js enqueue '{\"id\":\"demo-fail\",\"command\":\"exit 1\"}'
Write-Host ""

Write-Host "Step 4: Check queue status" -ForegroundColor Green
Write-Host "-----------------------------------"
node src/app.js status
Write-Host ""

Write-Host "Step 5: List pending jobs" -ForegroundColor Green
Write-Host "-----------------------------------"
node src/app.js list --state pending
Write-Host ""

Write-Host "Step 6: Start 2 workers" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "Starting workers (this will process jobs in real-time)..."
Write-Host "Press Ctrl+C to stop workers and see final results" -ForegroundColor Yellow
Write-Host ""
node src/app.js worker start --count 2

