/**
 * plugin-loader.js — Core plugin infrastructure for MCPBrowser.
 * Reads the plugin registry, validates manifests, dynamically loads plugins,
 * and provides detection/accessor functions for dispatch tools.
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import logger from './logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Current plugin interface version. Plugins must match this exactly. */
export const CURRENT_INTERFACE_VERSION = 1;

/** @type {Map<string, object>} Loaded plugin instances keyed by name */
const loadedPlugins = new Map();

// ============================================================================
// REGISTRY
// ============================================================================

/**
 * Resolve the path to plugins.json relative to this module's package root.
 * @returns {string} Absolute path to plugins.json
 */
function getRegistryPath() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, '../plugins.json');
}

/**
 * Resolve the path to the plugins/ directory.
 * @returns {string} Absolute path to plugins/
 */
function getPluginsDir() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return join(__dirname, '../plugins');
}

/**
 * Read and parse the plugin registry file.
 * @returns {{ enabled: string[] }} Registry data with enabled plugin names
 */
export function readRegistry() {
  const registryPath = getRegistryPath();
  
  if (!existsSync(registryPath)) {
    logger.debug('plugins.json not found — no plugins to load');
    return { enabled: [] };
  }

  try {
    const raw = readFileSync(registryPath, 'utf-8');
    const data = JSON.parse(raw);
    
    if (!data || !Array.isArray(data.enabled)) {
      logger.warn('plugins.json: "enabled" must be an array — no plugins loaded');
      return { enabled: [] };
    }
    
    return { enabled: data.enabled.filter(name => typeof name === 'string' && name.length > 0) };
  } catch (err) {
    logger.warn(`plugins.json: failed to parse — ${err.message}`);
    return { enabled: [] };
  }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate a plugin manifest against required fields and interface version.
 * @param {object} manifest - Plugin manifest object
 * @param {string} folderName - Expected folder name for the plugin
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateManifest(manifest, folderName) {
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, reason: 'manifest is missing or not an object' };
  }

  const required = ['name', 'version', 'description', 'interfaceVersion', 'urlPatterns'];
  for (const field of required) {
    if (manifest[field] === undefined || manifest[field] === null || manifest[field] === '') {
      return { valid: false, reason: `missing required field: ${field}` };
    }
  }

  if (typeof manifest.name !== 'string') {
    return { valid: false, reason: 'name must be a string' };
  }
  if (typeof manifest.version !== 'string') {
    return { valid: false, reason: 'version must be a string' };
  }
  if (typeof manifest.description !== 'string') {
    return { valid: false, reason: 'description must be a string' };
  }
  if (typeof manifest.interfaceVersion !== 'number' || !Number.isInteger(manifest.interfaceVersion)) {
    return { valid: false, reason: 'interfaceVersion must be an integer' };
  }
  if (!Array.isArray(manifest.urlPatterns) || manifest.urlPatterns.length === 0) {
    return { valid: false, reason: 'urlPatterns must be a non-empty array' };
  }

  if (manifest.name !== folderName) {
    return { valid: false, reason: `manifest name "${manifest.name}" does not match folder name "${folderName}"` };
  }

  if (manifest.interfaceVersion !== CURRENT_INTERFACE_VERSION) {
    return { valid: false, reason: `interfaceVersion ${manifest.interfaceVersion} is not compatible (expected ${CURRENT_INTERFACE_VERSION})` };
  }

  return { valid: true };
}

/**
 * Validate that a plugin module has all required exports.
 * @param {object} mod - Imported module namespace
 * @param {string} pluginName - Plugin name for logging
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateExports(mod, pluginName) {
  if (typeof mod.matchesPage !== 'function') {
    return { valid: false, reason: 'missing required export: matchesPage (function)' };
  }
  if (typeof mod.getActions !== 'function') {
    return { valid: false, reason: 'missing required export: getActions (function)' };
  }
  if (typeof mod.getInfo !== 'function') {
    return { valid: false, reason: 'missing required export: getInfo (function)' };
  }
  
  // Validate getActions returns non-empty array with required fields
  try {
    const actions = mod.getActions();
    if (!Array.isArray(actions) || actions.length === 0) {
      return { valid: false, reason: 'getActions() must return a non-empty array' };
    }
    
    const actionNames = new Set();
    for (const action of actions) {
      if (!action.name || !action.description || !Array.isArray(action.params) || typeof action.execute !== 'function') {
        return { valid: false, reason: `action "${action.name || '?'}" is missing required fields (name, description, params, execute)` };
      }
      if (actionNames.has(action.name)) {
        return { valid: false, reason: `duplicate action name "${action.name}" — action names must be unique within a plugin` };
      }
      actionNames.add(action.name);
    }
  } catch (err) {
    return { valid: false, reason: `getActions() threw: ${err.message}` };
  }

  return { valid: true };
}

// ============================================================================
// LOADING
// ============================================================================

/**
 * Load all enabled plugins from the registry.
 * Reads plugins.json, dynamically imports each plugin, validates manifest
 * and exports, and stores valid plugins in the loaded map.
 * @returns {Promise<number>} Number of successfully loaded plugins
 */
export async function loadPlugins() {
  loadedPlugins.clear();
  
  const registry = readRegistry();
  if (registry.enabled.length === 0) {
    logger.debug('No plugins enabled in registry');
    return 0;
  }

  const pluginsDir = getPluginsDir();
  
  // Check for duplicate names in registry
  const seen = new Set();
  const uniqueEnabled = [];
  for (const name of registry.enabled) {
    if (seen.has(name)) {
      logger.warn(`Plugin "${name}" is listed multiple times in registry — skipping duplicate`);
      continue;
    }
    seen.add(name);
    uniqueEnabled.push(name);
  }

  for (const pluginName of uniqueEnabled) {
    const pluginDir = join(pluginsDir, pluginName);
    const entryPoint = join(pluginDir, 'index.js');

    if (!existsSync(entryPoint)) {
      logger.warn(`Plugin "${pluginName}": entry point not found at ${entryPoint} — skipping`);
      continue;
    }

    try {
      const moduleUrl = pathToFileURL(resolve(entryPoint)).href;
      const mod = await import(moduleUrl);

      // Validate manifest
      const manifestCheck = validateManifest(mod.manifest, pluginName);
      if (!manifestCheck.valid) {
        logger.warn(`Plugin "${pluginName}": invalid manifest — ${manifestCheck.reason} — skipping`);
        continue;
      }

      // Validate exports
      const exportsCheck = validateExports(mod, pluginName);
      if (!exportsCheck.valid) {
        logger.warn(`Plugin "${pluginName}": invalid exports — ${exportsCheck.reason} — skipping`);
        continue;
      }

      // Store the loaded plugin
      loadedPlugins.set(pluginName, {
        manifest: mod.manifest,
        matchesPage: mod.matchesPage,
        getActions: mod.getActions,
        getInfo: mod.getInfo
      });

      logger.info(`Plugin "${pluginName}" v${mod.manifest.version} loaded (${mod.getActions().length} actions)`);
    } catch (err) {
      logger.warn(`Plugin "${pluginName}": failed to load — ${err.message} — skipping`);
    }
  }

  logger.info(`Plugin loader: ${loadedPlugins.size} plugin(s) loaded`);
  return loadedPlugins.size;
}

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Detect which loaded plugins match the given page URL and HTML.
 * URL patterns are checked first (fast path), then DOM patterns if defined.
 * @param {string} url - Current page URL
 * @param {string} html - Extracted page HTML
 * @returns {Array<{ pluginName: string, confidence: number, nextSteps: string[] }>}
 */
export function detectPlugins(url, html) {
  if (loadedPlugins.size === 0) return [];
  
  const results = [];
  
  for (const [name, plugin] of loadedPlugins) {
    try {
      const match = plugin.matchesPage(url, html);
      if (match && match.matched) {
        const confidence = typeof match.confidence === 'number' ? match.confidence : 1.0;
        
        // Build nextSteps from plugin info
        const info = plugin.getInfo();
        const topActions = (info.actions || []).slice(0, 3);
        const actionSummary = topActions.map(a => a.name).join(', ');
        
        const nextSteps = [
          `Plugin "${name}" detected — use plugin_info({ plugin: '${name}' }) to see all available actions`,
          ...(actionSummary ? [`Top actions: ${actionSummary}. Use plugin_action({ plugin: '${name}', action: '<name>' }) to execute`] : [])
        ];
        
        results.push({ pluginName: name, confidence, nextSteps });
      }
    } catch (err) {
      // Detection must not throw — skip this plugin silently
      logger.debug(`Plugin "${name}" detection error: ${err.message}`);
    }
  }
  
  // Sort by confidence descending
  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

/**
 * Convert detection results into a flat nextSteps string array for response augmentation.
 * @param {string} url - Current page URL
 * @param {string} html - Extracted page HTML
 * @returns {string[]} Array of nextSteps strings from matching plugins
 */
export function getPluginNextSteps(url, html) {
  const detections = detectPlugins(url, html);
  const steps = [];
  for (const d of detections) {
    steps.push(...d.nextSteps);
  }
  return steps;
}

// ============================================================================
// ACCESSORS
// ============================================================================

/**
 * Get the map of all loaded plugins.
 * @returns {Map<string, object>}
 */
export function getLoadedPlugins() {
  return loadedPlugins;
}

/**
 * Get a specific loaded plugin by name.
 * @param {string} name - Plugin name
 * @returns {object|undefined} Plugin instance or undefined
 */
export function getPlugin(name) {
  return loadedPlugins.get(name);
}
