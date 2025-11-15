import { readConfig, writeConfig } from './storageService.js';

export function getConfig(key) {
  const config = readConfig();
  return config[key] !== undefined ? config[key] : null;
}

export function getAllConfig() {
  return readConfig();
}

export function setConfig(key, value) {
  const config = readConfig();
  config[key] = value;
  writeConfig(config);
}

export function deleteConfig(key) {
  const config = readConfig();
  delete config[key];
  writeConfig(config);
}

export function getMaxRetries() {
  const val = getConfig('max-retries');
  return val !== null ? parseInt(val, 10) : 3;
}

export function getBackoffBase() {
  const val = getConfig('backoff-base');
  return val !== null ? parseFloat(val) : 2;
}

export function resetConfig() {
  writeConfig({ 'max-retries': 3, 'backoff-base': 2 });
}

export default {
  getConfig,
  getAllConfig,
  setConfig,
  deleteConfig,
  getMaxRetries,
  getBackoffBase,
  resetConfig
};
