/**
 * get-current-html.js - Get current HTML from an already-loaded page
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { extractAndProcessHtml } from '../core/page.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';
import { getPluginNextSteps, getRecommendedPlugins } from '../core/plugin-loader.js';
import { scanPageForms } from './detect-forms.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful browser_get_current_html operations
 */
export class GetCurrentHtmlSuccessResponse extends MCPResponse {
  /**
   * @param {string} currentUrl - Current page URL
   * @param {string} html - Page HTML content
   * @param {string[]} nextSteps - Suggested next actions
   * @param {Array} [recommendedPlugins] - Detected plugin metadata
   * @param {Object} [formData] - Detected forms data
   */
  constructor(currentUrl, html, nextSteps, recommendedPlugins = [], formData = null) {
    super(nextSteps);
    
    if (typeof currentUrl !== 'string') {
      throw new TypeError('currentUrl must be a string');
    }
    if (typeof html !== 'string') {
      throw new TypeError('html must be a string');
    }
    
    this.currentUrl = currentUrl;
    this.html = html;
    this.recommendedPlugins = recommendedPlugins;
    this.forms = formData?.forms || [];
    this.orphanedFields = formData?.orphanedFields || [];
    this.totalFieldCount = formData?.totalFieldCount || 0;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      html: this.html,
      recommendedPlugins: this.recommendedPlugins,
      forms: this.forms,
      orphanedFields: this.orphanedFields,
      totalFieldCount: this.totalFieldCount
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
  name: "browser_get_current_html",
  title: "Get Current HTML",
  description: "**BROWSER STATE EXTRACTION** - Retrieves current HTML from an already-loaded page WITHOUT navigating/reloading. Use this to check page state after interactions (click, type) or to re-examine the current page. Much faster than browser_fetch_webpage since it only extracts HTML from the current page state.\n\n**PREREQUISITE**: Page MUST be loaded with browser_fetch_webpage first. This tool reads from an already-loaded page in the browser.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
      removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%.", default: true },
      selector: { type: "string", description: "CSS selector to extract a specific DOM subtree instead of the full page. Use to scope extraction and reduce response size (e.g., 'main', '[role=\"main\"]', 'body > div:first-child'). If no elements match, falls back to full page with a note." },
      detectForms: { type: "boolean", description: "Scan page for forms and return structured form data (fields, selectors, submit buttons, orphaned inputs). Set to true when you need to fill or interact with forms.", default: false }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      currentUrl: { type: "string", description: "Current page URL" },
      html: { type: "string", description: "Page HTML content" },
      forms: { type: "array", items: { type: "object" }, description: "Detected forms with fields, selectors, and metadata" },
      orphanedFields: { type: "array", items: { type: "object" }, description: "Input/select/textarea elements not inside any <form>" },
      totalFieldCount: { type: "number", description: "Total number of form fields found on the page" },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      },
      recommendedPlugins: {
        type: "array",
        items: { type: "object" },
        description: "Detected site-specific plugins available for this domain"
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
export async function getCurrentHtml({ url, removeUnnecessaryHTML = true, selector = null, detectForms = false }) {
  const startTime = Date.now();
  logger.info(`browser_get_current_html called: url=${url}${selector ? ` selector=${selector}` : ''}`);
  
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
    logger.error(`browser_get_current_html: Failed to connect to browser: ${err.message}`);
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
    logger.debug(`browser_get_current_html: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost 
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can get its current HTML',
      [
        "Use MCPBrowser's browser_fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's browser_get_current_html with the same URL"
      ]
    );
  }

  try {
    const currentUrl = page.url();
    const html = await extractAndProcessHtml(page, removeUnnecessaryHTML, selector);
    
    // Scan for forms when requested (lightweight, ~50-100ms)
    let formData = null;
    if (detectForms) {
      try {
        formData = await scanPageForms(page);
      } catch (err) {
        logger.debug(`Form scan failed (non-fatal): ${err.message}`);
      }
    }
    
    // Detect empty/near-empty HTML extraction (e.g., CSP blocking page.evaluate)
    if (!html || html.trim().length < 100) {
      logger.warn(`browser_get_current_html: HTML extraction returned empty/minimal content from ${currentUrl} (${html ? html.trim().length : 0} chars)`);
      return new InformationalResponse(
        `HTML extraction returned empty content from ${currentUrl}`,
        'The page may be blocking evaluation via Content Security Policy (CSP), the page has not fully rendered, or the page uses a sandboxed context that prevents DOM reading.',
        [
          "Use MCPBrowser's browser_take_screenshot to verify the page is visually loaded",
          "Use MCPBrowser's browser_execute_javascript with a simple script like 'document.title' to test page accessibility",
          "Try MCPBrowser's browser_fetch_webpage to reload the page",
          "Wait and retry — the page may still be rendering"
        ]
      );
    }
    
    logger.info(`browser_get_current_html completed: got HTML from ${currentUrl}`);
    
    return new GetCurrentHtmlSuccessResponse(
      currentUrl,
      html,
      [
        ...getPluginNextSteps(currentUrl, html),
        "Use MCPBrowser's browser_click_element to interact with elements",
        "Use MCPBrowser's browser_type_text to fill forms",
        "Use MCPBrowser's browser_take_screenshot if page layout or visual content is hard to understand from HTML",
        "Use MCPBrowser's browser_close_tab to free resources when done"
      ],
      getRecommendedPlugins(currentUrl, html),
      formData
    );
  } catch (err) {
    logger.error(`browser_get_current_html failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to get HTML: ${err.message}`,
      'Could not extract HTML from the page. The page may have navigated away or the connection was lost.',
      [
        "Try MCPBrowser's browser_fetch_webpage to reload the page",
        "Use MCPBrowser's browser_close_tab and start fresh if needed"
      ]
    );
  }
}
