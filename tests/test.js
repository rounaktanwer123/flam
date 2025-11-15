#!/usr/bin/env node

/**
 * Test Suite for queuectl
 * 
 * This script tests all major functionality of the queuectl system:
 * - Job enqueuing
 * - Worker processing
 * - Retry mechanism with exponential backoff
 * - Dead letter queue
 * - Configuration management
 * - Job state transitions
 */

import { initDatabase, closeDatabase } from '../src/core/storageService.js';
import { createJob, getJob, getJobsByState, completeJob, failJob, getQueueStats, clearAllJobs, acquireNextJob, releaseLock } from '../src/core/jobService.js';
import { listDeadJobs, retryDeadJob, retryAllDeadJobs } from '../src/core/dlqService.js';
import { setConfig, getConfig, getMaxRetries, getBackoffBase } from '../src/core/configService.js';

// Test utilities
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`  ✗ ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const condition = actual === expected;
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`  ✗ ${message}`);
    console.error(`    Expected: ${expected}`);
    console.error(`    Actual: ${actual}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

function testGroup(name, fn) {
  console.log(`\n${name}`);
  try {
    fn();
  } catch (error) {
    console.error(`  Test group failed: ${error.message}`);
  }
}

// Initialize test database
console.log('Initializing test database...\n');
initDatabase();

// Clear any existing data
clearAllJobs();

// ===== TEST: Configuration Management =====
testGroup('TEST GROUP: Configuration Management', () => {
  // Test setting and getting config
  setConfig('max-retries', '5');
  const maxRetries = getConfig('max-retries');
  assertEqual(maxRetries, '5', 'Set and get max-retries');
  
  setConfig('backoff-base', '3');
  const backoffBase = getConfig('backoff-base');
  assertEqual(backoffBase, '3', 'Set and get backoff-base');
  
  // Test typed getters
  const maxRetriesInt = getMaxRetries();
  assertEqual(maxRetriesInt, 5, 'Get max retries as integer');
  
  const backoffBaseFloat = getBackoffBase();
  assertEqual(backoffBaseFloat, 3, 'Get backoff base as float');
  
  // Reset to defaults
  setConfig('max-retries', '3');
  setConfig('backoff-base', '2');
});

// ===== TEST: Job Creation =====
testGroup('TEST GROUP: Job Creation', () => {
  const job1 = createJob({
    id: 'test-job-1',
    command: 'echo "Test 1"'
  });
  
  assert(job1.id === 'test-job-1', 'Job created with correct ID');
  assert(job1.command === 'echo "Test 1"', 'Job created with correct command');
  assert(job1.state === 'pending', 'Job created in pending state');
  assert(job1.attempts === 0, 'Job created with 0 attempts');
  assert(job1.max_retries === 3, 'Job created with default max_retries');
  
  // Test job with custom max_retries
  const job2 = createJob({
    id: 'test-job-2',
    command: 'echo "Test 2"',
    max_retries: 5
  });
  
  assert(job2.max_retries === 5, 'Job created with custom max_retries');
  
  // Test duplicate job prevention
  try {
    createJob({
      id: 'test-job-1',
      command: 'echo "Duplicate"'
    });
    testsFailed++;
    console.error('  ✗ Should throw error for duplicate job ID');
  } catch (error) {
    testsPassed++;
    console.log('  ✓ Correctly prevents duplicate job IDs');
  }
});

// ===== TEST: Job Retrieval =====
testGroup('TEST GROUP: Job Retrieval', () => {
  const job = getJob('test-job-1');
  assert(job !== null, 'Can retrieve job by ID');
  assert(job.id === 'test-job-1', 'Retrieved correct job');
  
  const pendingJobs = getJobsByState('pending');
  assert(pendingJobs.length >= 2, 'Can retrieve jobs by state');
  
  const nonExistent = getJob('non-existent-job');
  assert(nonExistent === undefined, 'Returns undefined for non-existent job');
});

// ===== TEST: Job State Transitions =====
testGroup('TEST GROUP: Job State Transitions', () => {
  createJob({
    id: 'test-job-3',
    command: 'echo "Test 3"'
  });
  
  // Test completion
  completeJob('test-job-3', 'Success output');
  const completedJob = getJob('test-job-3');
  assert(completedJob.state === 'completed', 'Job marked as completed');
  assert(completedJob.result === 'Success output', 'Job result stored');
  
  // Test failure and retry
  createJob({
    id: 'test-job-4',
    command: 'echo "Test 4"',
    max_retries: 2
  });
  
  failJob('test-job-4', 'First error');
  let failedJob = getJob('test-job-4');
  assert(failedJob.state === 'pending', 'Failed job reset to pending for retry');
  assert(failedJob.attempts === 1, 'Attempt count incremented');
  assert(failedJob.error === 'First error', 'Error message stored');
  
  failJob('test-job-4', 'Second error');
  failedJob = getJob('test-job-4');
  assert(failedJob.state === 'dead', 'Job moved to DLQ after max retries');
  assert(failedJob.attempts === 2, 'Final attempt count correct');
});

// ===== TEST: Queue Statistics =====
testGroup('TEST GROUP: Queue Statistics', () => {
  const stats = getQueueStats();
  assert(stats.total >= 4, 'Total job count is correct');
  assert(stats.pending >= 0, 'Pending count present');
  assert(stats.completed >= 1, 'Completed count present');
  assert(stats.dead >= 1, 'Dead count present');
  
  console.log(`  Current stats: ${JSON.stringify(stats)}`);
});

// ===== TEST: Dead Letter Queue =====
testGroup('TEST GROUP: Dead Letter Queue', () => {
  const deadJobs = listDeadJobs();
  assert(deadJobs.length >= 1, 'Can list dead jobs');
  
  const deadJob = deadJobs[0];
  assert(deadJob.state === 'dead', 'Dead jobs have correct state');
  
  // Test retry from DLQ
  const success = retryDeadJob(deadJob.id);
  assert(success === true, 'Can retry dead job');
  
  const retriedJob = getJob(deadJob.id);
  assert(retriedJob.state === 'pending', 'Retried job reset to pending');
  assert(retriedJob.attempts === 0, 'Retried job attempts reset to 0');
  
  // Create another dead job for retry-all test
  createJob({
    id: 'test-job-5',
    command: 'echo "Test 5"',
    max_retries: 1
  });
  failJob('test-job-5', 'Error');
  
  // Test retry all
  const deadCount = listDeadJobs().length;
  if (deadCount > 0) {
    const retriedCount = retryAllDeadJobs();
    assert(retriedCount === deadCount, `Retry all retried ${retriedCount} jobs`);
  }
});

// ===== TEST: Integration - Full Job Lifecycle =====
testGroup('TEST GROUP: Integration - Full Job Lifecycle', () => {
  // Clear for clean test
  clearAllJobs();
  
  // Create a new job
  const newJob = createJob({
    id: 'lifecycle-test',
    command: 'echo "Lifecycle"',
    max_retries: 2
  });
  
  assert(newJob.state === 'pending', 'New job starts as pending');
  
  // Test job acquisition and processing
  const processing = acquireNextJob('worker-lifecycle');
  assert(processing !== null, 'Job acquired for processing');
  assert(processing.state === 'processing', 'Job state changed to processing');
  
  // Simulate failure
  failJob(processing.id, 'Simulated error');
  let job = getJob(processing.id);
  assert(job.state === 'pending', 'Job returned to pending after first failure');
  assert(job.attempts === 1, 'Attempt counter incremented');
  
  // Second attempt
  const retry1 = acquireNextJob('worker-lifecycle');
  assert(retry1 !== null, 'Can acquire job for second attempt');
  failJob(retry1.id, 'Second error');
  job = getJob(processing.id);
  assert(job.state === 'dead', 'Job moved to DLQ after max retries');
  assert(job.attempts === 2, 'Final attempt count correct');
  
  // Retry from DLQ
  retryDeadJob(job.id);
  job = getJob(processing.id);
  assert(job.state === 'pending', 'Job revived from DLQ');
  assert(job.attempts === 0, 'Attempts reset after DLQ retry');
  
  // Final success
  const finalAttempt = acquireNextJob('worker-lifecycle');
  assert(finalAttempt !== null, 'Can acquire job for final attempt');
  completeJob(finalAttempt.id, 'Success!');
  job = getJob(processing.id);
  assert(job.state === 'completed', 'Job successfully completed');
  assert(job.result === 'Success!', 'Job result stored');
});

// ===== TEST: Job Locking =====
testGroup('TEST GROUP: Job Locking', () => {
  createJob({
    id: 'test-lock-1',
    command: 'echo "Lock test"'
  });
  
  // Test job locking
  const lockedJob = acquireNextJob('worker-test-1');
  assert(lockedJob !== null, 'Worker can acquire job');
  assert(lockedJob.state === 'processing', 'Acquired job in processing state');
  assert(lockedJob.locked_by === 'worker-test-1', 'Job locked by correct worker');
  
  // Try to acquire same job with different worker (should be null because job is processing)
  const duplicateLock = acquireNextJob('worker-test-2');
  assert(duplicateLock === null, 'Another worker cannot acquire locked job');
  
  // Release lock
  releaseLock(lockedJob.id);
  const releasedJob = getJob(lockedJob.id);
  assert(releasedJob.locked_by === null, 'Lock released successfully');
});

// ===== TEST SUMMARY =====
setTimeout(() => {
  console.log('\n' + '='.repeat(50));
  console.log('TEST SUMMARY');
  console.log('='.repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  console.log(`Total Tests: ${testsPassed + testsFailed}`);
  
  if (testsFailed === 0) {
    console.log('\n✓ All tests passed!');
  } else {
    console.log(`\n✗ ${testsFailed} test(s) failed`);
  }
  
  // Cleanup
  closeDatabase();
  process.exit(testsFailed > 0 ? 1 : 0);
}, 100);

