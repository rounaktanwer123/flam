#!/usr/bin/env node

import { Command } from 'commander';
import { initStorage } from './core/storageService.js';
import { setupGracefulShutdown } from './core/workerService.js';
import { enqueueCommand } from './cli/enqueue.js';
import { workerStartCommand, workerStopCommand, workerStatusCommand } from './cli/worker.js';
import { statusCommand } from './cli/status.js';
import { listCommand } from './cli/list.js';
import { getJobCommand } from './cli/getJob.js';
import { dlqListCommand, dlqRetryCommand, dlqPurgeCommand, dlqStatsCommand } from './cli/dlq.js';
import { configGetCommand, configSetCommand } from './cli/config.js';

initStorage();
setupGracefulShutdown();

const program = new Command();

program
  .name('queuectl')
  .description('A command-line job queue management system with workers, retries, and dead letter queue')
  .version('1.0.0');

program
  .command('enqueue <job-json>')
  .description('Enqueue a new job to the queue')
  .option('-r, --retries <number>', 'Override max retries for this job')
  .action((jobJson, options) => {
    enqueueCommand(jobJson, options);
  })
  .addHelpText('after', `
Examples:
  $ queuectl enqueue '{"id":"job1","command":"echo hello"}'
  $ queuectl enqueue '{"id":"backup","command":"tar -czf backup.tar.gz /data","max_retries":5}'
  `);

const worker = program
  .command('worker')
  .description('Manage worker processes');

worker
  .command('start')
  .description('Start worker(s) to process jobs from the queue')
  .option('-c, --count <number>', 'Number of workers to start (default: 1)', '1')
  .action((options) => {
    workerStartCommand(options);
  })
  .addHelpText('after', `
Examples:
  $ queuectl worker start              # Start 1 worker
  $ queuectl worker start --count 3    # Start 3 workers
  
Note: Press Ctrl+C to stop workers gracefully
  `);

worker
  .command('stop')
  .description('Stop all running workers gracefully')
  .action(async () => {
    await workerStopCommand();
    process.exit(0);
  })
  .addHelpText('after', `
Note: Workers will finish their current job before stopping
  `);

worker
  .command('status')
  .description('Show worker status and information')
  .action(() => {
    workerStatusCommand();
  });

program
  .command('status')
  .description('Show queue and worker status summary')
  .action(() => {
    statusCommand();
  })
  .addHelpText('after', `
Shows:
  - Total jobs and breakdown by state
  - Worker status (running/stopped)
  - Active worker count
  `);

program
  .command('list')
  .description('List jobs in the queue')
  .option('-s, --state <state>', 'Filter by state: pending, processing, completed, failed, dead')
  .action((options) => {
    listCommand(options);
  })
  .addHelpText('after', `
Examples:
  $ queuectl list                   # List all jobs
  $ queuectl list --state pending   # List only pending jobs
  $ queuectl list --state completed # List completed jobs
  $ queuectl list --state dead      # List dead jobs (also in DLQ)
  `);

program
  .command('job-get <id>')
  .description('Get detailed information about a specific job')
  .action((jobId) => {
    getJobCommand(jobId);
  })
  .addHelpText('after', `
Example:
  $ queuectl job-get job1           # Show details for job1
  $ queuectl job-get test-fail      # Show details for test-fail job

Shows:
  - Job ID, command, and current state
  - Attempt counter (attempts/max_retries)
  - Timestamps (created, updated)
  - Result (if completed) or error (if failed)
  - Lock information (if processing)
  - Suggested next actions based on state
  `);

const dlq = program
  .command('dlq')
  .description('Manage dead letter queue (failed jobs)');

dlq
  .command('list')
  .description('List all jobs in the dead letter queue')
  .action(() => {
    dlqListCommand();
  })
  .addHelpText('after', `
Dead jobs are those that exceeded max retry attempts.
  `);

dlq
  .command('retry <job-id>')
  .description('Retry a specific dead job')
  .action((jobId) => {
    dlqRetryCommand(jobId);
  })
  .addHelpText('after', `
Example:
  $ queuectl dlq retry job123
  
This will:
  - Reset attempts to 0
  - Move job back to pending state
  - Make it available for workers to process
  `);

dlq
  .command('purge')
  .description('Permanently delete all dead jobs')
  .action(() => {
    dlqPurgeCommand();
  })
  .addHelpText('after', `
WARNING: This permanently deletes all dead jobs.
Cannot be undone.
  `);

dlq
  .command('stats')
  .description('Show dead letter queue statistics')
  .action(() => {
    dlqStatsCommand();
  });

const config = program
  .command('config')
  .description('Manage configuration settings');

config
  .command('get [key]')
  .description('Get configuration value(s)')
  .action((key) => {
    configGetCommand(key);
  })
  .addHelpText('after', `
Examples:
  $ queuectl config get              # Show all config
  $ queuectl config get max-retries  # Show specific value
  `);

config
  .command('set <key> <value>')
  .description('Set configuration value')
  .action((key, value) => {
    configSetCommand(key, value);
  })
  .addHelpText('after', `
Available settings:
  - max-retries: Maximum retry attempts (default: 3)
  - backoff-base: Exponential backoff base (default: 2)
  
Examples:
  $ queuectl config set max-retries 5
  $ queuectl config set backoff-base 3
  
Backoff formula: delay = base ^ attempts (in seconds)
With base=2: 2s, 4s, 8s, 16s...
With base=3: 3s, 9s, 27s, 81s...
  `);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
