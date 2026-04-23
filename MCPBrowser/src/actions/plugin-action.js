/**
 * plugin-action.js — MCP tool that dispatches to a plugin's action.
 * Looks up the plugin by name, finds the action, provides the browser
 * page object, and calls the action's execute function.
 * Part of the plugin dispatch pair (browser_plugin_info + browser_plugin_action).
 */

import { MCPResponse, ErrorResponse } from '../core/responses.js';
import { getLoadedPlugins, getPlugin } from '../core/plugin-loader.js';
import { getBrowser, getValidatedPage } from '../core/browser.js';
import logger from '../core/logger.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/** Response wrapping a plugin action's raw result */
export class PluginActionSuccessResponse extends MCPResponse {
  constructor(pluginName, actionName, data, nextSteps) {
    super(nextSteps);
    this.pluginName = pluginName;
    this.actionName = actionName;
    this.data = data;
  }
  _getAdditionalFields() { return { pluginName: this.pluginName, actionName: this.actionName, data: this.data }; }
  getTextSummary() { return `Plugin "${this.pluginName}" action "${this.actionName}" completed`; }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/** @type {Tool} */
export const PLUGIN_ACTION_TOOL = {
  name: "browser_plugin_action",
  title: "Plugin Action",
  description: "Execute a site-specific plugin action. Use browser_plugin_info first to discover available actions and their parameters. Plugins provide specialized automation for UI-heavy websites like Gmail, Outlook, PowerBI, AWS, and Azure — faster and more reliable than generic DOM interaction.",
  inputSchema: {
    type: "object",
    properties: {
      plugin: {
        type: "string",
        description: "Plugin name (e.g., 'gmail', 'outlook', 'powerbi')"
      },
      action: {
        type: "string",
        description: "Action name within the plugin (e.g., 'list_emails', 'extract_grid')"
      },
      params: {
        type: "object",
        description: "Action parameters. Use browser_plugin_info to discover accepted parameters.",
        additionalProperties: true
      }
    },
    required: ["plugin", "action"],
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
 * Dispatch to a plugin action.
 * @param {Object} params
 * @param {string} params.plugin - Plugin name
 * @param {string} params.action - Action name within the plugin
 * @param {Object} [params.params] - Action parameters
 * @returns {Promise<MCPResponse>}
 */
export async function pluginAction({ plugin: pluginName, action: actionName, params = {} }) {
  logger.info(`browser_plugin_action called: plugin=${pluginName} action=${actionName}`);

  const loadedPlugins = getLoadedPlugins();

  // Validate plugin exists
  const pluginInstance = getPlugin(pluginName);
  if (!pluginInstance) {
    const available = [...loadedPlugins.keys()].join(', ') || '(none)';
    return new ErrorResponse(
      `Unknown plugin: '${pluginName}'. Available plugins: ${available}`,
      ["Call browser_plugin_info() to list all loaded plugins"]
    );
  }

  // Validate action exists
  const actions = pluginInstance.getActions();
  const actionDef = actions.find(a => a.name === actionName);
  if (!actionDef) {
    const validActions = actions.map(a => a.name).join(', ');
    return new ErrorResponse(
      `Unknown action '${actionName}' for plugin '${pluginName}'. Available actions: ${validActions}`,
      [`Call browser_plugin_info({ plugin: '${pluginName}' }) to see all available actions and their parameters`]
    );
  }

  // Get browser page — check if on correct domain (US5/T032)
  let page;
  try {
    // Try to get a validated page for any of the plugin's URL patterns
    const browser = await getBrowser();
    const pages = await browser.pages();
    
    // Find a page matching any of the plugin's URL patterns
    let matchedPage = null;
    for (const p of pages) {
      try {
        const pageUrl = p.url();
        for (const pattern of pluginInstance.manifest.urlPatterns) {
          if (pageUrl.includes(pattern)) {
            matchedPage = p;
            break;
          }
        }
        if (matchedPage) break;
      } catch { /* skip closed/errored pages */ }
    }

    if (!matchedPage) {
      const targetPatterns = pluginInstance.manifest.urlPatterns.join(', ');
      return new ErrorResponse(
        `Plugin '${pluginName}' requires ${targetPatterns} but no matching page is open. Use browser_fetch_webpage to navigate to the correct site first.`,
        [`Use MCPBrowser's browser_fetch_webpage to navigate to a page matching: ${targetPatterns}`, `Then retry browser_plugin_action`]
      );
    }
    
    page = matchedPage;
  } catch (err) {
    logger.error(`browser_plugin_action: browser error — ${err.message}`);
    return new ErrorResponse(
      `Browser connection failed: ${err.message}`,
      ["Ensure the browser is running with remote debugging enabled", "Retry browser_plugin_action after browser is connected"]
    );
  }

  // Execute the action
  try {
    const result = await actionDef.execute({ page, params });
    
    // If result is already an MCPResponse subclass, return it directly
    if (result && typeof result.toMcpFormat === 'function') {
      return result;
    }
    
    // Wrap raw results
    return new PluginActionSuccessResponse(
      pluginName,
      actionName,
      result,
      [`Use browser_plugin_info({ plugin: '${pluginName}' }) to see other available actions`]
    );
  } catch (err) {
    logger.error(`browser_plugin_action: "${pluginName}/${actionName}" failed — ${err.message}`);
    return new ErrorResponse(
      `Plugin '${pluginName}' action '${actionName}' failed: ${err.message}. The site structure may have changed. You can fall back to generic MCPBrowser tools (browser_click_element, browser_get_current_html).`,
      [
        "Check if the page is on the correct site",
        "Try MCPBrowser's browser_get_current_html to inspect the page state",
        "Use generic MCPBrowser tools as a fallback"
      ]
    );
  }
}
