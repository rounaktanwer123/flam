import { getAllJobs, getJobsByState } from '../core/jobService.js';

function formatJob(job) {
  const lines = [
    `  ID: ${job.id}`,
    `  Command: ${job.command}`,
    `  State: ${job.state}`,
    `  Priority: ${job.priority || 3}`,
    `  Attempts: ${job.attempts}/${job.max_retries}`,
    `  Timeout: ${job.timeout || 30}s`,
    `  Created: ${job.created_at}`,
    `  Updated: ${job.updated_at}`
  ];
  
  if (job.run_at) {
    const runDate = new Date(job.run_at);
    const status = runDate <= new Date() ? 'due' : 'scheduled';
    lines.splice(5, 0, `  Scheduled: ${job.run_at} (${status})`);
  }
  
  if (job.error) lines.push(`  Error: ${job.error}`);
  if (job.result) {
    const truncated = job.result.substring(0, 100);
    lines.push(`  Result: ${truncated}${job.result.length > 100 ? '...' : ''}`);
  }
  
  return lines.join('\n');
}

export function listCommand(options) {
  try {
    let jobs;
    
    if (options.state) {
      const validStates = ['pending', 'processing', 'completed', 'failed', 'dead'];
      if (!validStates.includes(options.state)) {
        console.error(`Error: Invalid state. Must be one of: ${validStates.join(', ')}`);
        process.exit(1);
      }
      
      jobs = getJobsByState(options.state);
      console.log(`\n=== Jobs (State: ${options.state}) ===\n`);
    } else {
      jobs = getAllJobs();
      console.log('\n=== All Jobs ===\n');
    }
    
    if (jobs.length === 0) {
      console.log('No jobs found');
      return;
    }
    
    console.log(`Found ${jobs.length} job(s):\n`);
    
    jobs.forEach((job, idx) => {
      console.log(`[${idx + 1}]`);
      console.log(formatJob(job));
      console.log('');
    });
  } catch (err) {
    console.error(`Error listing jobs: ${err.message}`);
    process.exit(1);
  }
}

export default listCommand;
