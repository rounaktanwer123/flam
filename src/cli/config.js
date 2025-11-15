import { getConfig, getAllConfig, setConfig } from '../core/configService.js';

export function configGetCommand(key) {
  try {
    if (key) {
      const val = getConfig(key);
      
      if (val === null) {
        console.log(`Config key '${key}' not found`);
        return;
      }
      
      console.log(`${key} = ${val}`);
    } else {
      const config = getAllConfig();
      const keys = Object.keys(config);
      
      if (keys.length === 0) {
        console.log('No configuration found');
        return;
      }
      
      console.log('\n=== Configuration ===\n');
      keys.forEach(k => console.log(`${k} = ${config[k]}`));
      console.log('');
    }
  } catch (err) {
    console.error(`Error getting config: ${err.message}`);
    process.exit(1);
  }
}

export function configSetCommand(key, value) {
  try {
    if (!key) {
      console.error('Error: Config key is required');
      console.error('Usage: queuectl config set <key> <value>');
      process.exit(1);
    }
    
    if (value === undefined) {
      console.error('Error: Config value is required');
      console.error('Usage: queuectl config set <key> <value>');
      process.exit(1);
    }
    
    if (key === 'max-retries') {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        console.error('Error: max-retries must be a non-negative integer');
        process.exit(1);
      }
    }
    
    if (key === 'backoff-base') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 1) {
        console.error('Error: backoff-base must be a number >= 1');
        process.exit(1);
      }
    }
    
    setConfig(key, value);
    console.log(`✓ Configuration updated: ${key} = ${value}`);
  } catch (err) {
    console.error(`Error setting config: ${err.message}`);
    process.exit(1);
  }
}

export default {
  configGetCommand,
  configSetCommand
};
