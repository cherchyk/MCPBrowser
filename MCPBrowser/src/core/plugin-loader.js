/**
 * plugin-loader.js — Core plugin infrastructure for MCPBrowser.
 * Loads the static plugin registry and provides detection/accessor functions
 * for dispatch tools.
 */

import logger from './logger.js';
import { CorePlugin, CURRENT_PLUGIN_INTERFACE_VERSION } from './plugins.js';
import { PLUGINS } from '../plugins/index.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Current plugin interface version. Plugins must match this exactly. */
export const CURRENT_INTERFACE_VERSION = CURRENT_PLUGIN_INTERFACE_VERSION;

/** @type {Map<string, object>} Loaded plugin instances keyed by name */
const loadedPlugins = new Map();

// ============================================================================
// LOADING
// ============================================================================

/**
 * Load all plugins from the static registry.
 * @param {CorePlugin[]} [plugins]
 * @returns {Promise<number>} Number of successfully loaded plugins
 */
export async function loadPlugins(plugins = PLUGINS) {
  loadedPlugins.clear();

  const seen = new Set();
  for (const plugin of plugins) {
    if (!(plugin instanceof CorePlugin)) {
      logger.warn('Plugin registry entries must be CorePlugin instances — skipping invalid entry');
      continue;
    }
    if (seen.has(plugin.id)) {
      logger.warn(`Plugin "${plugin.id}" is registered multiple times — skipping duplicate`);
      continue;
    }
    seen.add(plugin.id);
    loadedPlugins.set(plugin.id, plugin);
    logger.info(
      `Plugin "${plugin.id}" v${plugin.manifest.version} loaded (${plugin.getActions().length} actions)`,
    );
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

        // Build nextSteps from plugin info — concise, actionable
        const info = plugin.getInfo();
        const recommendationText =
          info.recommendation || info.description || 'Site-specific automation available.';

        const nextSteps = [
          `Recommended: use "${name}" plugin to ${recommendationText.charAt(0).toLowerCase() + recommendationText.slice(1).replace(/\.$/, '')}. See recommendedPlugins for available actions.`,
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

/**
 * Build the recommendedPlugins payload for structuredContent.
 * Returns full plugin metadata including action catalog with params,
 * so agents can call actions directly without needing browser_plugin_info.
 * @param {string} url - Current page URL
 * @param {string} html - Extracted page HTML
 * @returns {Array<{ plugin: string, recommendation: string, actions: Array, usage: string }>}
 */
export function getRecommendedPlugins(url, html) {
  const detections = detectPlugins(url, html);
  return detections.map((d) => {
    const plugin = loadedPlugins.get(d.pluginName);
    const info = plugin.getInfo();
    const recommendationText =
      info.recommendation || info.description || 'Site-specific automation available.';
    return {
      plugin: d.pluginName,
      recommendation: recommendationText,
      actions: info.actions || [],
      usage: `browser_plugin_action({ plugin: '${d.pluginName}', action: '<name>', params: {...} })`,
    };
  });
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
