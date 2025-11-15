# PowerShell Demo script for queuectl
# Demonstrates all major features: enqueue, workers, retry, DLQ

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  queuectl Demo - Job Queue System" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Function to run queuectl
function Invoke-QueueCtl {
    param([string]$Args)
    Invoke-Expression "node src/app.js $Args"
}

Write-Host "Step 1: Configure the system" -ForegroundColor Green
Write-Host "-----------------------------------"
Invoke-QueueCtl "config set max-retries 3"
Invoke-QueueCtl "config set backoff-base 2"
Write-Host ""
Write-Host "Current configuration:"
Invoke-QueueCtl "config get"
Write-Host ""

Write-Host "Step 2: Enqueue test jobs" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "Enqueueing 3 jobs..."
Invoke-QueueCtl 'enqueue "{\"id\":\"demo-job-1\",\"command\":\"echo Job 1: Hello from queuectl!\"}"'
Write-Host ""
Invoke-QueueCtl 'enqueue "{\"id\":\"demo-job-2\",\"command\":\"echo Job 2: Processing data...\"}"'
Write-Host ""
Invoke-QueueCtl 'enqueue "{\"id\":\"demo-job-3\",\"command\":\"echo Job 3: Task complete!\"}"'
Write-Host ""

Write-Host "Enqueueing a job that will fail (for DLQ demo)..."
Invoke-QueueCtl 'enqueue "{\"id\":\"demo-fail\",\"command\":\"exit 1\",\"max_retries\":2}"'
Write-Host ""

Write-Host "Step 3: Check initial queue status" -ForegroundColor Green
Write-Host "-----------------------------------"
Invoke-QueueCtl "status"
Write-Host ""

Write-Host "Step 4: List pending jobs" -ForegroundColor Green
Write-Host "-----------------------------------"
Invoke-QueueCtl "list --state pending"
Write-Host ""

Write-Host "Step 5: Start 2 workers" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "Starting workers... (will run for 10 seconds)"
Write-Host ""

# Start workers in background job
$job = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    node src/app.js worker start --count 2
}

# Wait for jobs to process
Start-Sleep -Seconds 10

# Stop workers
Write-Host ""
Write-Host "Stopping workers..."
Stop-Job -Job $job
Remove-Job -Job $job

Write-Host ""
Write-Host "Step 6: Check updated status" -ForegroundColor Green
Write-Host "-----------------------------------"
Invoke-QueueCtl "status"
Write-Host ""

Write-Host "Step 7: List completed jobs" -ForegroundColor Green
Write-Host "-----------------------------------"
Invoke-QueueCtl "list --state completed"
Write-Host ""

Write-Host "Step 8: Check Dead Letter Queue" -ForegroundColor Green
Write-Host "-----------------------------------"
Invoke-QueueCtl "dlq list"
Write-Host ""

Write-Host "Step 9: Retry a dead job" -ForegroundColor Green
Write-Host "-----------------------------------"
Write-Host "Retrying demo-fail job..."
Invoke-QueueCtl "dlq retry demo-fail"
Write-Host ""

Write-Host "Step 10: Final status" -ForegroundColor Green
Write-Host "-----------------------------------"
Invoke-QueueCtl "status"
Write-Host ""

Write-Host "Step 11: DLQ Statistics" -ForegroundColor Green
Write-Host "-----------------------------------"
Invoke-QueueCtl "dlq stats"
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  Demo Complete!" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Key Features Demonstrated:" -ForegroundColor Yellow
Write-Host "  ✓ Job enqueueing"
Write-Host "  ✓ Multiple workers (2 workers)"
Write-Host "  ✓ Automatic retry with exponential backoff"
Write-Host "  ✓ Dead Letter Queue (DLQ)"
Write-Host "  ✓ Job state transitions"
Write-Host "  ✓ Configuration management"
Write-Host ""
Write-Host "Try it yourself:"
Write-Host '  queuectl enqueue "{\"id\":\"my-job\",\"command\":\"echo test\"}"'
Write-Host "  queuectl worker start --count 3"
Write-Host "  queuectl status"
Write-Host ""

