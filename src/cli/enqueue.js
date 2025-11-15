import { createJob } from '../core/jobService.js';

export function enqueueCommand(jobJson, options = {}) {
  try {
    const data = JSON.parse(jobJson);
    
    if (!data.id) {
      console.error('Error: Job must have an "id" field');
      console.error('\nExample:');
      console.error('  queuectl enqueue \'{"id":"job1","command":"echo hello"}\'');
      process.exit(1);
    }
    
    if (!data.command) {
      console.error('Error: Job must have a "command" field');
      console.error('\nExample:');
      console.error('  queuectl enqueue \'{"id":"job1","command":"echo hello"}\'');
      process.exit(1);
    }
    
    if (options.retries) {
      data.max_retries = parseInt(options.retries, 10);
    }
    
    const job = createJob(data);
    
    console.log('✓ Job enqueued successfully\n');
    console.log('Job Details:');
    console.log(`  ID: ${job.id}`);
    console.log(`  Command: ${job.command}`);
    console.log(`  State: ${job.state}`);
    console.log(`  Max Retries: ${job.max_retries}`);
    console.log(`  Created: ${job.created_at}`);
    console.log('\nNext Steps:');
    console.log('  queuectl worker start    # Start workers to process');
    console.log('  queuectl status          # Check queue status');
    
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('Error: Invalid JSON format');
      console.error('\nCorrect format:');
      console.error('  queuectl enqueue \'{"id":"job1","command":"echo hello"}\'');
      console.error('\nWith custom retries:');
      console.error('  queuectl enqueue \'{"id":"job1","command":"echo hello","max_retries":5}\'');
    } else {
      console.error(`Error: ${err.message}`);
    }
    process.exit(1);
  }
}

export default enqueueCommand;
