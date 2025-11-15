import { startWorkers, stopWorkers, getWorkerStatus } from '../core/workerService.js';

export function workerStartCommand(options) {
  const count = parseInt(options.count || '1', 10);
  
  if (isNaN(count) || count < 1) {
    console.error('Error: Worker count must be a positive integer');
    process.exit(1);
  }
  
  if (count > 10) {
    console.error('Error: Maximum 10 workers allowed');
    process.exit(1);
  }
  
  try {
    startWorkers(count);
    console.log(`\n✓ ${count} worker(s) started and running`);
    console.log('  Press Ctrl+C to stop workers gracefully');
  } catch (err) {
    console.error(`Error starting workers: ${err.message}`);
    process.exit(1);
  }
}

export async function workerStopCommand() {
  try {
    await stopWorkers();
    console.log('✓ Workers stopped successfully');
  } catch (err) {
    console.error(`Error stopping workers: ${err.message}`);
    process.exit(1);
  }
}

export function workerStatusCommand() {
  try {
    const status = getWorkerStatus();
    
    if (!status.running) {
      console.log('No workers are currently running');
      return;
    }
    
    console.log('Worker Status:');
    console.log(`  Running: ${status.running}`);
    console.log(`  Count: ${status.count}`);
    console.log(`  Started: ${status.started_at}`);
    console.log('\nActive Workers:');
    status.workers.forEach(w => {
      console.log(`  - Worker ${w.index} (${w.id})`);
    });
  } catch (err) {
    console.error(`Error getting worker status: ${err.message}`);
    process.exit(1);
  }
}

export default {
  workerStartCommand,
  workerStopCommand,
  workerStatusCommand
};
