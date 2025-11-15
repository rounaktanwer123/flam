import { readJobs, writeJobs, atomicUpdate } from './storageService.js';
import { getMaxRetries } from './configService.js';

export function createJob(data) {
  const now = new Date().toISOString();
  const retries = data.max_retries !== undefined ? data.max_retries : getMaxRetries();
  
  const job = {
    id: data.id,
    command: data.command,
    state: 'pending',
    attempts: 0,
    max_retries: retries,
    timeout: data.timeout !== undefined ? data.timeout : 30,
    priority: data.priority !== undefined ? data.priority : 3,
    run_at: data.run_at || null,
    created_at: now,
    updated_at: now,
    locked_by: null,
    locked_at: null,
    result: null,
    error: null,
    execution_time: null
  };
  
  const jobs = readJobs();
  if (jobs.find(j => j.id === data.id)) {
    throw new Error(`Job with id '${data.id}' already exists`);
  }
  
  jobs.push(job);
  writeJobs(jobs);
  return job;
}

export function getJob(id) {
  return readJobs().find(j => j.id === id) || null;
}

export function getJobsByState(state) {
  return readJobs().filter(j => j.state === state);
}

export function getAllJobs() {
  return readJobs();
}

export function updateJobState(id, state, extras = {}) {
  const updated = atomicUpdate('jobs', (jobs) => {
    const job = jobs.find(j => j.id === id);
    if (!job) return jobs;
    
    job.state = state;
    job.updated_at = new Date().toISOString();
    Object.assign(job, extras);
    
    return jobs;
  });
  
  return updated.find(j => j.id === id);
}

export function acquireNextJob(workerId) {
  const now = new Date().toISOString();
  const nowTs = Date.now();
  const staleTime = new Date(nowTs - 5 * 60 * 1000).toISOString();
  
  let acquired = null;
  
  atomicUpdate('jobs', (jobs) => {
    const eligible = jobs.filter(j => {
      if (j.state !== 'pending') return false;
      if (j.locked_by !== null && j.locked_at >= staleTime) return false;
      
      if (j.run_at) {
        const runTime = new Date(j.run_at).getTime();
        if (runTime > nowTs) return false;
      }
      
      return true;
    });
    
    if (eligible.length === 0) return jobs;
    
    eligible.sort((a, b) => {
      const priA = a.priority || 3;
      const priB = b.priority || 3;
      
      if (priA !== priB) return priA - priB;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    
    const job = jobs.find(j => j.id === eligible[0].id);
    
    if (job) {
      job.state = 'processing';
      job.locked_by = workerId;
      job.locked_at = now;
      job.updated_at = now;
      job.execution_start = now;
      acquired = { ...job };
    }
    
    return jobs;
  });
  
  return acquired;
}

export function releaseLock(id) {
  updateJobState(id, 'pending', {
    locked_by: null,
    locked_at: null
  });
}

export function incrementAttempts(id) {
  let count = 0;
  
  atomicUpdate('jobs', (jobs) => {
    const job = jobs.find(j => j.id === id);
    if (job) {
      job.attempts += 1;
      job.updated_at = new Date().toISOString();
      count = job.attempts;
    }
    return jobs;
  });
  
  return count;
}

export function completeJob(id, result = null) {
  updateJobState(id, 'completed', {
    locked_by: null,
    locked_at: null,
    result
  });
}

export function failJob(id, error) {
  const job = getJob(id);
  if (!job) return;
  
  const attempts = incrementAttempts(id);
  
  if (attempts >= job.max_retries) {
    updateJobState(id, 'dead', {
      locked_by: null,
      locked_at: null,
      error
    });
  } else {
    updateJobState(id, 'failed', {
      locked_by: null,
      locked_at: null,
      error
    });
    
    setTimeout(() => {
      const current = getJob(id);
      if (current && current.state === 'failed') {
        updateJobState(id, 'pending', {});
      }
    }, 100);
  }
}

export function getQueueStats() {
  const jobs = readJobs();
  const stats = { total: jobs.length, pending: 0, processing: 0, completed: 0, failed: 0, dead: 0 };
  
  jobs.forEach(j => {
    if (stats[j.state] !== undefined) stats[j.state]++;
  });
  
  return stats;
}

export function deleteJob(id) {
  atomicUpdate('jobs', (jobs) => jobs.filter(j => j.id !== id));
}

export function clearAllJobs() {
  writeJobs([]);
}

export default {
  createJob,
  getJob,
  getJobsByState,
  getAllJobs,
  updateJobState,
  acquireNextJob,
  releaseLock,
  incrementAttempts,
  completeJob,
  failJob,
  getQueueStats,
  deleteJob,
  clearAllJobs
};
