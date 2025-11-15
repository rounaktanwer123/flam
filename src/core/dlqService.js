import { readDLQ, writeDLQ, atomicUpdate } from './storageService.js';
import { getJob, updateJobState, deleteJob } from './jobService.js';

export function moveToDLQ(job) {
  const dead = readDLQ();
  dead.push({ ...job, moved_to_dlq_at: new Date().toISOString() });
  writeDLQ(dead);
}

export function listDeadJobs() {
  return readDLQ();
}

export function getDeadJob(id) {
  return readDLQ().find(j => j.id === id) || null;
}

export function retryDeadJob(id) {
  let success = false;
  
  atomicUpdate('dlq', (dead) => {
    const idx = dead.findIndex(j => j.id === id);
    if (idx === -1) return dead;
    
    const job = dead[idx];
    updateJobState(job.id, 'pending', {
      attempts: 0,
      locked_by: null,
      locked_at: null,
      error: null
    });
    
    dead.splice(idx, 1);
    success = true;
    return dead;
  });
  
  return success;
}

export function retryAllDeadJobs() {
  const dead = readDLQ();
  let count = 0;
  
  dead.forEach(j => {
    if (retryDeadJob(j.id)) count++;
  });
  
  return count;
}

export function deleteDeadJob(id) {
  let deleted = false;
  
  atomicUpdate('dlq', (dead) => {
    const idx = dead.findIndex(j => j.id === id);
    if (idx !== -1) {
      dead.splice(idx, 1);
      deleted = true;
    }
    return dead;
  });
  
  if (deleted) deleteJob(id);
  return deleted;
}

export function purgeAllDeadJobs() {
  const dead = readDLQ();
  const count = dead.length;
  
  writeDLQ([]);
  dead.forEach(j => deleteJob(j.id));
  
  return count;
}

export function getDLQStats() {
  const dead = readDLQ();
  return { total: dead.length, jobs: dead.slice(0, 10) };
}

export default {
  moveToDLQ,
  listDeadJobs,
  getDeadJob,
  retryDeadJob,
  retryAllDeadJobs,
  deleteDeadJob,
  purgeAllDeadJobs,
  getDLQStats
};
