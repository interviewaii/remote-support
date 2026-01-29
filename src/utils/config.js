const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), 'desire-ai');
const CONFIG_FILE = path.join(CONFIG_DIR, 'settings.json');

/**
 * Ensure the config directory exists
 */
function ensureConfigDir() {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }
}

/**
 * Read the current config from the file
 */
function readConfig() {
    try {
        ensureConfigDir();
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading config file:', error);
    }
    return {};
}

/**
 * Write the config to the file
 */
function writeConfig(config) {
    try {
        ensureConfigDir();
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing config file:', error);
        return false;
    }
}

/**
 * Update a specific key in the config
 */
function updateConfig(key, value) {
    const config = readConfig();
    config[key] = value;
    return writeConfig(config);
}

/**
 * Update multiple keys in the config
 */
function updateConfigBatch(updates) {
    const config = readConfig();
    const newConfig = { ...config, ...updates };
    return writeConfig(newConfig);
}

module.exports = {
    readConfig,
    writeConfig,
    updateConfig,
    updateConfigBatch
};
