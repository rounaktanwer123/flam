import { getJob } from '../core/jobService.js';

export function getJobCommand(id) {
  try {
    if (!id) {
      console.error('Error: Job ID is required');
      console.error('Usage: queuectl job-get <job-id>');
      console.error('\nExample:');
      console.error('  queuectl job-get job1');
      process.exit(1);
    }
    
    const job = getJob(id);
    
    if (!job) {
      console.error(`Error: Job with ID '${id}' not found`);
      console.error('\nAvailable commands:');
      console.error('  queuectl list           # List all jobs');
      console.error('  queuectl list --state pending  # List jobs by state');
      console.error('  queuectl dlq list       # List jobs in DLQ');
      process.exit(1);
    }
    
    console.log('\n=== Job Details ===\n');
    
    console.log(`ID: ${job.id}`);
    console.log(`Command: ${job.command}`);
    console.log(`State: ${job.state}`);
    console.log(`Attempts: ${job.attempts}/${job.max_retries}`);
    console.log(`Priority: ${job.priority || 3} (1=highest, 5=lowest)`);
    console.log(`Timeout: ${job.timeout || 30}s`);
    
    if (job.run_at) {
      const runDate = new Date(job.run_at);
      const isPast = runDate <= new Date();
      console.log(`Scheduled: ${job.run_at} ${isPast ? '(due)' : '(future)'}`);
    }
    
    console.log(`Created: ${job.created_at}`);
    console.log(`Updated: ${job.updated_at}`);
    
    if (job.execution_time) {
      console.log(`Execution Time: ${job.execution_time.toFixed(2)}s`);
    }
    
    if (job.locked_by) {
      console.log(`\nLock Information:`);
      console.log(`  Locked By: ${job.locked_by}`);
      console.log(`  Locked At: ${job.locked_at}`);
    }
    
    if (job.result) {
      console.log(`\nResult:`);
      console.log(`  ${job.result}`);
    }
    
    if (job.error) {
      console.log(`\nError:`);
      console.log(`  ${job.error}`);
    }
    
    console.log('\n' + '='.repeat(40));
    
    const stateMessages = {
      pending: '\nStatus: Job is waiting to be processed\nAction: Start workers to process this job\n  queuectl worker start',
      processing: `\nStatus: Job is currently being processed${job.locked_by ? `\nWorker: ${job.locked_by}` : ''}`,
      completed: '\nStatus: Job completed successfully ✓',
      failed: `\nStatus: Job failed but will be retried\nRemaining attempts: ${job.max_retries - job.attempts}`,
      dead: `\nStatus: Job exceeded maximum retries\nLocation: Dead Letter Queue (DLQ)\nAction: Retry from DLQ if needed\n  queuectl dlq retry ${job.id}`
    };
    
    console.log(stateMessages[job.state] || `\nStatus: ${job.state}`);
    console.log('');
    
  } catch (err) {
    console.error(`Error retrieving job: ${err.message}`);
    process.exit(1);
  }
}

export default getJobCommand;
