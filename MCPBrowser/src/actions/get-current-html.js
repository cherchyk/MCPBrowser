/**
 * get-current-html.js - Get current HTML from an already-loaded page
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { extractAndProcessHtml } from '../core/page.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';
import { getPluginNextSteps } from '../core/plugin-loader.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful get_current_html operations
 */
export class GetCurrentHtmlSuccessResponse extends MCPResponse {
  /**
   * @param {string} currentUrl - Current page URL
   * @param {string} html - Page HTML content
   * @param {string[]} nextSteps - Suggested next actions
   */
  constructor(currentUrl, html, nextSteps) {
    super(nextSteps);
    
    if (typeof currentUrl !== 'string') {
      throw new TypeError('currentUrl must be a string');
    }
    if (typeof html !== 'string') {
      throw new TypeError('html must be a string');
    }
    
    this.currentUrl = currentUrl;
    this.html = html;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      html: this.html
    };
  }

  getTextSummary() {
    return `Retrieved HTML from: ${this.currentUrl}`;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const GET_CURRENT_HTML_TOOL = {
  name: "get_current_html",
  title: "Get Current HTML",
  description: "**BROWSER STATE EXTRACTION** - Retrieves current HTML from an already-loaded page WITHOUT navigating/reloading. Use this to check page state after interactions (click, type) or to re-examine the current page. Much faster than fetch_webpage since it only extracts HTML from the current page state.\n\n**PREREQUISITE**: Page MUST be loaded with fetch_webpage first. This tool reads from an already-loaded page in the browser.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
      removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%.", default: true }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      currentUrl: { type: "string", description: "Current page URL" },
      html: { type: "string", description: "Page HTML content" },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["currentUrl", "html", "nextSteps"],
    additionalProperties: false
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Get current HTML from an already-loaded page without reloading/navigating
 * Use this after interactions (click, type, wait) to get updated DOM state
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page to get HTML from
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML
 * @returns {Promise<Object>} Result object with current HTML
 */
export async function getCurrentHtml({ url, removeUnnecessaryHTML = true }) {
  const startTime = Date.now();
  logger.info(`get_current_html called: url=${url}`);
  
  if (!url) {
    throw new Error("url parameter is required");
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Ensure browser connection (triggers domain map rebuild on reconnect)
  try {
    await getBrowser();
  } catch (err) {
    logger.error(`get_current_html: Failed to connect to browser: ${err.message}`);
    return new InformationalResponse(
      `Browser connection failed: ${err.message}`,
      'The browser must be running with remote debugging enabled.',
      [
        'Ensure the browser is installed and running',
        'Check that remote debugging is enabled (--remote-debugging-port)',
        'Try restarting the MCP server'
      ]
    );
  }

  // Validate page exists and is usable
  const { page, error: pageError } = await getValidatedPage(hostname);
  
  if (!page) {
    const isConnectionLost = pageError && pageError.includes('connection');
    logger.debug(`get_current_html: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost 
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can get its current HTML',
      [
        "Use MCPBrowser's fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's get_current_html with the same URL"
      ]
    );
  }

  try {
    const currentUrl = page.url();
    const html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
    
    logger.info(`get_current_html completed: got HTML from ${currentUrl}`);
    
    return new GetCurrentHtmlSuccessResponse(
      currentUrl,
      html,
      [
        ...getPluginNextSteps(currentUrl, html),
        "Use MCPBrowser's click_element to interact with elements",
        "Use MCPBrowser's type_text to fill forms",
        "Use MCPBrowser's take_screenshot if page layout or visual content is hard to understand from HTML",
        "Use MCPBrowser's close_tab to free resources when done"
      ]
    );
  } catch (err) {
    logger.error(`get_current_html failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to get HTML: ${err.message}`,
      'Could not extract HTML from the page. The page may have navigated away or the connection was lost.',
      [
        "Try MCPBrowser's fetch_webpage to reload the page",
        "Use MCPBrowser's close_tab and start fresh if needed"
      ]
    );
  }
}
