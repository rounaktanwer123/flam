import { listDeadJobs, retryDeadJob, retryAllDeadJobs, purgeAllDeadJobs, getDLQStats } from '../core/dlqService.js';

function formatDeadJob(job) {
  const lines = [
    `  ID: ${job.id}`,
    `  Command: ${job.command}`,
    `  Attempts: ${job.attempts}/${job.max_retries}`,
    `  Created: ${job.created_at}`,
    `  Failed: ${job.updated_at}`
  ];
  
  if (job.moved_to_dlq_at) lines.push(`  Moved to DLQ: ${job.moved_to_dlq_at}`);
  if (job.error) lines.push(`  Last Error: ${job.error}`);
  
  return lines.join('\n');
}

export function dlqListCommand() {
  try {
    const dead = listDeadJobs();
    
    console.log('\n=== Dead Letter Queue ===\n');
    
    if (dead.length === 0) {
      console.log('No jobs in dead letter queue');
      console.log('\nTip: Jobs are moved here after exceeding max retries.');
      return;
    }
    
    console.log(`Found ${dead.length} dead job(s):\n`);
    
    dead.forEach((job, idx) => {
      console.log(`[${idx + 1}]`);
      console.log(formatDeadJob(job));
      console.log('');
    });
    
    console.log('Commands:');
    console.log('  queuectl dlq retry <job-id>  - Retry a specific job');
    console.log('  queuectl dlq purge           - Remove all dead jobs');
  } catch (err) {
    console.error(`Error listing DLQ: ${err.message}`);
    process.exit(1);
  }
}

export function dlqRetryCommand(id) {
  try {
    if (!id) {
      console.error('Error: Job ID is required');
      console.error('Usage: queuectl dlq retry <job-id>');
      console.error('\nExample:');
      console.error('  queuectl dlq retry job123');
      process.exit(1);
    }
    
    const success = retryDeadJob(id);
    
    if (success) {
      console.log(`✓ Job '${id}' has been moved back to pending queue`);
      console.log('  - Attempts counter reset to 0');
      console.log('  - Job will be processed by workers');
      console.log('\nStart workers to process:');
      console.log('  queuectl worker start');
    } else {
      console.error(`Error: Job '${id}' not found in dead letter queue`);
      console.error('\nList dead jobs:');
      console.error('  queuectl dlq list');
      process.exit(1);
    }
  } catch (err) {
    console.error(`Error retrying job: ${err.message}`);
    process.exit(1);
  }
}

export function dlqPurgeCommand() {
  try {
    const count = purgeAllDeadJobs();
    
    if (count > 0) {
      console.log(`✓ Purged ${count} job(s) from dead letter queue`);
      console.log('  All dead jobs have been permanently deleted');
    } else {
      console.log('No jobs in dead letter queue to purge');
    }
  } catch (err) {
    console.error(`Error purging DLQ: ${err.message}`);
    process.exit(1);
  }
}

export function dlqStatsCommand() {
  try {
    const stats = getDLQStats();
    
    console.log('\n=== Dead Letter Queue Statistics ===\n');
    console.log(`Total Dead Jobs: ${stats.total}`);
    
    if (stats.total > 0) {
      console.log('\nMost Recent Failures:');
      stats.jobs.forEach((job, idx) => {
        console.log(`\n[${idx + 1}]`);
        console.log(formatDeadJob(job));
      });
      
      console.log('\n' + '='.repeat(40));
      console.log('\nActions:');
      console.log('  queuectl dlq retry <job-id>  - Retry specific job');
      console.log('  queuectl dlq purge           - Delete all dead jobs');
    }
    
    console.log('');
  } catch (err) {
    console.error(`Error getting DLQ stats: ${err.message}`);
    process.exit(1);
  }
}

export default {
  dlqListCommand,
  dlqRetryCommand,
  dlqPurgeCommand,
  dlqStatsCommand
};
