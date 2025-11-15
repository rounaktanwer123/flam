import { getQueueStats } from '../core/jobService.js';
import { getWorkerStatus } from '../core/workerService.js';

export function statusCommand() {
  try {
    const stats = getQueueStats();
    const workerStatus = getWorkerStatus();
    
    console.log('\n=== Queue Status ===\n');
    
    console.log('Jobs:');
    console.log(`  Total: ${stats.total}`);
    console.log(`  Pending: ${stats.pending}`);
    console.log(`  Processing: ${stats.processing}`);
    console.log(`  Completed: ${stats.completed}`);
    console.log(`  Failed: ${stats.failed || 0}`);
    console.log(`  Dead (DLQ): ${stats.dead}`);
    
    console.log('\nWorkers:');
    if (workerStatus.running) {
      console.log(`  Status: Running`);
      console.log(`  Count: ${workerStatus.count}`);
      console.log(`  Started: ${workerStatus.started_at}`);
    } else {
      console.log(`  Status: Not running`);
    }
    
    console.log('');
  } catch (err) {
    console.error(`Error getting status: ${err.message}`);
    process.exit(1);
  }
}

export default statusCommand;
