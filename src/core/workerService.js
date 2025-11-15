import { exec } from 'child_process';
import { promisify } from 'util';
import { readWorkers, writeWorkers } from './storageService.js';
import { acquireNextJob, completeJob, failJob, getJob, updateJobState } from './jobService.js';
import { getBackoffBase } from './configService.js';
import { moveToDLQ } from './dlqService.js';

const execAsync = promisify(exec);

let workers = [];
let stopping = false;

function backoffDelay(attempts) {
  return Math.pow(getBackoffBase(), attempts) * 1000;
}

async function runCommand(cmd, timeout = 30) {
  const start = Date.now();
  const timeoutMs = timeout * 1000;
  
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024 * 10,
      killSignal: 'SIGTERM'
    });
    
    return {
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      exitCode: 0,
      executionTime: (Date.now() - start) / 1000,
      timedOut: false
    };
  } catch (err) {
    const execTime = (Date.now() - start) / 1000;
    const timedOut = err.killed || err.signal === 'SIGTERM';
    
    return {
      success: false,
      stdout: err.stdout ? err.stdout.trim() : '',
      stderr: err.stderr ? err.stderr.trim() : (timedOut ? `Job timed out after ${timeout}s` : err.message),
      exitCode: err.code || 1,
      executionTime: execTime,
      timedOut
    };
  }
}

async function processJob(job, workerId) {
  const timeout = job.timeout || 30;
  const priority = job.priority || 3;
  
  console.log(`[Worker ${workerId}] Processing job: ${job.id} (attempt ${job.attempts + 1}/${job.max_retries}) [Priority: ${priority}]`);
  console.log(`[Worker ${workerId}] Command: ${job.command}`);
  console.log(`[Worker ${workerId}] Timeout: ${timeout}s`);
  
  try {
    const result = await runCommand(job.command, timeout);
    
    if (result.success) {
      console.log(`[Worker ${workerId}] Job ${job.id} completed successfully in ${result.executionTime.toFixed(2)}s`);
      if (result.stdout) console.log(`[Worker ${workerId}] Output: ${result.stdout}`);
      
      updateJobState(job.id, 'completed', {
        locked_by: null,
        locked_at: null,
        result: result.stdout,
        execution_time: result.executionTime
      });
    } else {
      const reason = result.timedOut ? 'TIMEOUT' : `exit code ${result.exitCode}`;
      console.error(`[Worker ${workerId}] Job ${job.id} failed: ${reason} (${result.executionTime.toFixed(2)}s)`);
      if (result.stderr) console.error(`[Worker ${workerId}] Error: ${result.stderr}`);
      
      const errorMsg = result.stderr || `Command exited with code ${result.exitCode}`;
      failJob(job.id, errorMsg);
      
      const updated = getJob(job.id);
      if (updated) {
        if (updated.state === 'pending' || updated.state === 'failed') {
          const delay = backoffDelay(updated.attempts);
          console.log(`[Worker ${workerId}] Job ${job.id} will be retried after ${delay / 1000}s backoff`);
        } else if (updated.state === 'dead') {
          console.log(`[Worker ${workerId}] Job ${job.id} moved to dead letter queue (max retries exceeded)`);
          moveToDLQ(updated);
        }
      }
    }
  } catch (err) {
    console.error(`[Worker ${workerId}] Unexpected error processing job ${job.id}:`, err.message);
    failJob(job.id, err.message);
  }
}

async function workerLoop(id) {
  console.log(`[Worker ${id}] Started`);
  
  while (!stopping) {
    try {
      const job = acquireNextJob(id);
      
      if (job) {
        await processJob(job, id);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (err) {
      console.error(`[Worker ${id}] Error in worker loop:`, err.message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`[Worker ${id}] Stopped`);
}

function createWorker(idx) {
  const id = `worker-${idx}-${Date.now()}`;
  return {
    id,
    index: idx,
    pid: process.pid,
    started_at: new Date().toISOString(),
    promise: workerLoop(id)
  };
}

export function startWorkers(count = 1) {
  if (workers.length > 0) {
    console.log('Workers are already running. Stop them first.');
    return;
  }
  
  stopping = false;
  console.log(`Starting ${count} worker(s)...`);
  
  for (let i = 1; i <= count; i++) {
    workers.push(createWorker(i));
  }
  
  writeWorkers({
    workers: workers.map(w => ({ id: w.id, index: w.index, pid: w.pid, started_at: w.started_at })),
    pids: workers.map(w => w.pid),
    count,
    started_at: new Date().toISOString()
  });
  
  console.log(`${count} worker(s) started successfully`);
}

export async function stopWorkers() {
  if (workers.length === 0) {
    console.log('No workers are running');
    return;
  }
  
  console.log('Stopping workers gracefully...');
  stopping = true;
  
  await Promise.all(workers.map(w => w.promise));
  
  workers = [];
  writeWorkers({ workers: [], pids: [], count: 0 });
  
  console.log('All workers stopped');
}

export function getWorkerStatus() {
  const info = readWorkers();
  
  if (!info || info.workers.length === 0 || workers.length === 0) {
    return { running: false, count: 0, workers: [] };
  }
  
  return {
    running: true,
    count: workers.length,
    started_at: info.started_at,
    workers: workers.map(w => ({ id: w.id, index: w.index, pid: w.pid }))
  };
}

export function setupGracefulShutdown() {
  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}, initiating graceful shutdown...`);
    await stopWorkers();
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export default {
  startWorkers,
  stopWorkers,
  getWorkerStatus,
  setupGracefulShutdown
};
