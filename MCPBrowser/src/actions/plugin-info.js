/**
 * plugin-info.js — MCP tool that returns information about installed plugins,
 * their available actions, parameters, and high-level site context.
 * Part of the plugin dispatch pair (browser_plugin_info + browser_plugin_action).
 */

import { MCPResponse, ErrorResponse } from '../core/responses.js';
import { getLoadedPlugins, getPlugin } from '../core/plugin-loader.js';
import logger from '../core/logger.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASSES
// ============================================================================

/** Response listing all loaded plugins */
export class PluginListResponse extends MCPResponse {
  constructor(plugins, nextSteps) {
    super(nextSteps);
    this.plugins = plugins;
  }
  _getAdditionalFields() { return { plugins: this.plugins }; }
  getTextSummary() { return `${this.plugins.length} plugin(s) loaded`; }
}

/** Response with plugin detail (action catalog + site context) */
export class PluginInfoResponse extends MCPResponse {
  constructor(info, nextSteps) {
    super(nextSteps);
    this.pluginInfo = info;
  }
  _getAdditionalFields() { return { ...this.pluginInfo }; }
  getTextSummary() { return `Plugin "${this.pluginInfo.name}": ${this.pluginInfo.actions?.length || 0} action(s)`; }
}

/** Response with single action detail */
export class PluginActionDetailResponse extends MCPResponse {
  constructor(plugin, action, nextSteps) {
    super(nextSteps);
    this.plugin = plugin;
    this.action = action;
  }
  _getAdditionalFields() { return { plugin: this.plugin, action: this.action }; }
  getTextSummary() { return `Action "${this.action.name}" from plugin "${this.plugin}"`; }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/** @type {Tool} */
export const PLUGIN_INFO_TOOL = {
  name: "browser_plugin_info",
  title: "Plugin Info",
  description: "Get information about an installed site plugin — its available actions, parameters, and site context. Call this after a plugin is detected (recommended in nextSteps) to discover what actions you can perform via browser_plugin_action. You can also call with no arguments to list all loaded plugins.",
  inputSchema: {
    type: "object",
    properties: {
      plugin: {
        type: "string",
        description: "Plugin name to get info for. Omit to list all loaded plugins."
      },
      action: {
        type: "string",
        description: "Optional. Specific action name to get detailed info for."
      }
    },
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      nextSteps: {
        type: "array",
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["nextSteps"],
    additionalProperties: true
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Get plugin information — list all plugins, plugin detail, or action detail.
 * @param {Object} params
 * @param {string} [params.plugin] - Plugin name (omit to list all)
 * @param {string} [params.action] - Action name (requires plugin)
 * @returns {MCPResponse}
 */
export function pluginInfo({ plugin, action } = {}) {
  logger.info(`browser_plugin_info called: plugin=${plugin || '(all)'} action=${action || '(all)'}`);

  const loadedPlugins = getLoadedPlugins();

  // Mode 1: List all plugins
  if (!plugin) {
    const plugins = [];
    for (const [name, p] of loadedPlugins) {
      plugins.push({
        name,
        description: p.manifest.description,
        actionCount: p.getActions().length
      });
    }

    const nextSteps = plugins.length > 0
      ? plugins.map(p => `Call browser_plugin_info({ plugin: '${p.name}' }) to see ${p.name}'s available actions`)
      : ["No plugins are currently loaded. Add plugin names to plugins.json and restart the server."];

    return new PluginListResponse(plugins, nextSteps);
  }

  // Validate plugin exists
  const pluginInstance = getPlugin(plugin);
  if (!pluginInstance) {
    const available = [...loadedPlugins.keys()].join(', ') || '(none)';
    return new ErrorResponse(
      `Unknown plugin: '${plugin}'. Available plugins: ${available}`,
      loadedPlugins.size > 0
        ? [`Call browser_plugin_info() with no arguments to list all plugins`]
        : ["No plugins are currently loaded. Add plugin names to plugins.json and restart the server."]
    );
  }

  // Mode 3: Single action detail
  if (action) {
    const actions = pluginInstance.getActions();
    const actionDef = actions.find(a => a.name === action);
    if (!actionDef) {
      const validActions = actions.map(a => a.name).join(', ');
      return new ErrorResponse(
        `Unknown action '${action}' for plugin '${plugin}'. Available actions: ${validActions}`,
        [`Call browser_plugin_info({ plugin: '${plugin}' }) to see all available actions`]
      );
    }

    return new PluginActionDetailResponse(
      plugin,
      { name: actionDef.name, description: actionDef.description, params: actionDef.params },
      [`Call browser_plugin_action({ plugin: '${plugin}', action: '${action}', params: { ... } })`]
    );
  }

  // Mode 2: Plugin detail with full action catalog
  const info = pluginInstance.getInfo();
  const pluginDetail = {
    name: plugin,
    description: info.description,
    targetPages: info.targetPages,
    ...(info.authFlow ? { authFlow: info.authFlow } : {}),
    actions: info.actions || []
  };

  const nextSteps = [
    ...(info.actions || []).slice(0, 3).map(a =>
      `Use browser_plugin_action({ plugin: '${plugin}', action: '${a.name}' }) to ${a.description.toLowerCase()}`
    ),
    "Use browser_fetch_webpage to navigate to the target site first if not already there"
  ];

  return new PluginInfoResponse(pluginDetail, nextSteps);
}
