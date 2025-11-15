import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATA_DIR = join(__dirname, '../data');
const JOBS_FILE = join(DATA_DIR, 'jobs.json');
const DLQ_FILE = join(DATA_DIR, 'dlq.json');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const WORKERS_FILE = join(DATA_DIR, 'workers.json');

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

export function initStorage() {
  if (!existsSync(JOBS_FILE)) {
    writeFileSync(JOBS_FILE, JSON.stringify({ jobs: [] }, null, 2));
  }
  
  if (!existsSync(DLQ_FILE)) {
    writeFileSync(DLQ_FILE, JSON.stringify({ deadJobs: [] }, null, 2));
  }
  
  if (!existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify({
      'max-retries': 3,
      'backoff-base': 2
    }, null, 2));
  }
  
  if (!existsSync(WORKERS_FILE)) {
    writeFileSync(WORKERS_FILE, JSON.stringify({ workers: [], pids: [] }, null, 2));
  }
}

export function readJobs() {
  try {
    const data = readFileSync(JOBS_FILE, 'utf8');
    return JSON.parse(data).jobs || [];
  } catch (error) {
    return [];
  }
}

export function writeJobs(jobs) {
  writeFileSync(JOBS_FILE, JSON.stringify({ jobs }, null, 2));
}

export function readDLQ() {
  try {
    const data = readFileSync(DLQ_FILE, 'utf8');
    return JSON.parse(data).deadJobs || [];
  } catch (error) {
    return [];
  }
}

export function writeDLQ(deadJobs) {
  writeFileSync(DLQ_FILE, JSON.stringify({ deadJobs }, null, 2));
}

export function readConfig() {
  try {
    const data = readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { 'max-retries': 3, 'backoff-base': 2 };
  }
}

export function writeConfig(config) {
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function readWorkers() {
  try {
    const data = readFileSync(WORKERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { workers: [], pids: [] };
  }
}

export function writeWorkers(info) {
  writeFileSync(WORKERS_FILE, JSON.stringify(info, null, 2));
}

export function atomicUpdate(type, callback) {
  const readers = { jobs: readJobs, dlq: readDLQ, config: readConfig, workers: readWorkers };
  const writers = { jobs: writeJobs, dlq: writeDLQ, config: writeConfig, workers: writeWorkers };
  
  const data = readers[type]();
  const updated = callback(data);
  writers[type](updated);
  return updated;
}

export default {
  initStorage,
  readJobs,
  writeJobs,
  readDLQ,
  writeDLQ,
  readConfig,
  writeConfig,
  readWorkers,
  writeWorkers,
  atomicUpdate
};
