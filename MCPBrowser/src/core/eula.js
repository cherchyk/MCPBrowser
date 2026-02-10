/**
 * EULA (End User License Agreement) Management
 * Tracks whether the user has accepted the EULA.
 * EULA acceptance is persisted to disk and remembered across sessions.
 */

import logger from './logger.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

// EULA URL - where the full license agreement can be found
export const EULA_URL = 'https://github.com/cherchyk/MCPBrowser/blob/main/EULA.md';

// Config directory and file paths
const CONFIG_DIR = join(homedir(), '.mcpbrowser');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

// In-memory cache of EULA acceptance status
let eulaAccepted = null;

/**
 * Load config from disk
 * @returns {Object} Config object
 */
function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const data = readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.warn(`Failed to load config: ${error.message}`);
  }
  return {};
}

/**
 * Save config to disk
 * @param {Object} config - Config object to save
 */
function saveConfig(config) {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
    logger.info(`Config saved to ${CONFIG_FILE}`);
  } catch (error) {
    logger.error(`Failed to save config: ${error.message}`);
  }
}

/**
 * Initialize EULA status from persisted config
 */
function initEulaStatus() {
  if (eulaAccepted === null) {
    const config = loadConfig();
    eulaAccepted = config.eulaAccepted === true;
    if (eulaAccepted) {
      logger.info('EULA previously accepted, loaded from config');
    }
  }
}

/**
 * Check if the EULA has been accepted
 * @returns {boolean} True if EULA has been accepted
 */
export function isEulaAccepted() {
  initEulaStatus();
  return eulaAccepted;
}

/**
 * Accept the EULA (persisted across sessions)
 * @param {string} eulaUrl - The EULA URL being accepted
 */
export function acceptEula(eulaUrl) {
  eulaAccepted = true;
  const config = loadConfig();
  config.eulaAccepted = true;
  config.eulaAcceptedAt = new Date().toISOString();
  config.eulaUrl = eulaUrl;
  saveConfig(config);
  logger.info(`EULA accepted and persisted (${eulaUrl})`);
}

/**
 * Reset EULA acceptance (clears both memory and persisted state)
 * @param {boolean} [persistReset=true] - Whether to also clear the persisted config
 */
export function resetEula(persistReset = true) {
  eulaAccepted = false;
  if (persistReset) {
    const config = loadConfig();
    delete config.eulaAccepted;
    delete config.eulaAcceptedAt;
    delete config.eulaUrl;
    saveConfig(config);
    logger.debug('EULA acceptance reset (memory and disk)');
  } else {
    logger.debug('EULA acceptance reset (memory only)');
  }
}

/**
 * Get EULA status summary
 * @returns {{ accepted: boolean, acceptedAt: string|null, eulaUrl: string }} Current EULA status
 */
export function getEulaStatus() {
  initEulaStatus();
  const config = loadConfig();
  return {
    accepted: eulaAccepted,
    acceptedAt: config.eulaAcceptedAt || null,
    eulaUrl: EULA_URL
  };
}
