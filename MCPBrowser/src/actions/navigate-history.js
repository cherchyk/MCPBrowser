/**
 * navigate-history.js - Browser back/forward navigation
 * Navigates browser history on an already-loaded page.
 */

import { getBrowser, getValidatedPage, domainPages } from '../core/browser.js';
import { extractAndProcessHtml, waitForPageReady } from '../core/page.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful browser_navigate_history operations
 */
export class NavigateHistorySuccessResponse extends MCPResponse {
  /**
   * @param {string} direction - Navigation direction (back or forward)
   * @param {string} previousUrl - URL before navigation
   * @param {string} currentUrl - URL after navigation
   * @param {string|null} html - Page HTML content (null if returnHtml=false)
   * @param {string[]} nextSteps - Suggested next actions
   */
  constructor(direction, previousUrl, currentUrl, html, nextSteps) {
    super(nextSteps);

    if (typeof direction !== 'string') {
      throw new TypeError('direction must be a string');
    }
    if (typeof previousUrl !== 'string') {
      throw new TypeError('previousUrl must be a string');
    }
    if (typeof currentUrl !== 'string') {
      throw new TypeError('currentUrl must be a string');
    }
    if (html !== null && typeof html !== 'string') {
      throw new TypeError('html must be a string or null');
    }

    this.direction = direction;
    this.previousUrl = previousUrl;
    this.currentUrl = currentUrl;
    this.html = html;
  }

  _getAdditionalFields() {
    return {
      direction: this.direction,
      previousUrl: this.previousUrl,
      currentUrl: this.currentUrl,
      html: this.html
    };
  }

  getTextSummary() {
    return `Navigated ${this.direction}: ${this.previousUrl} → ${this.currentUrl}`;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/** @type {Tool} */
export const NAVIGATE_HISTORY_TOOL = {
  name: "browser_navigate_history",
  title: "Navigate Back/Forward",
  description: "Go back or forward in browser history. Use when: you clicked a link and need to return to the previous page, or want to go forward after going back. PREREQUISITE: Page must be loaded with browser_fetch_webpage first.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL of the already-loaded page (identifies which tab to navigate)" },
      direction: {
        type: "string",
        enum: ["back", "forward"],
        description: "Navigation direction: 'back' to go to previous page, 'forward' to go to next page",
        default: "back"
      },
      returnHtml: { type: "boolean", description: "Return page HTML after navigation", default: true },
      removeUnnecessaryHTML: { type: "boolean", description: "Remove unnecessary HTML elements (scripts, styles, etc.) for size reduction.", default: true }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      direction: { type: "string", enum: ["back", "forward"], description: "Navigation direction used" },
      previousUrl: { type: "string", description: "URL before navigation" },
      currentUrl: { type: "string", description: "URL after navigation" },
      html: { type: ["string", "null"], description: "Page HTML content after navigation (null if returnHtml=false)" },
      nextSteps: {
        type: "array",
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["direction", "previousUrl", "currentUrl", "nextSteps"],
    additionalProperties: false
  },
  annotations: {
    title: "Navigate Back/Forward",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Navigate browser history (back/forward) on an already-loaded page
 * @param {Object} params - Parameters
 * @param {string} params.url - URL of the already-loaded page
 * @param {string} [params.direction='back'] - Navigation direction
 * @param {boolean} [params.returnHtml=true] - Return page HTML after navigation
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Clean HTML
 * @returns {Promise<MCPResponse>} Navigation result
 */
export async function navigateHistory({ url, direction = 'back', returnHtml = true, removeUnnecessaryHTML = true }) {
  logger.info(`browser_navigate_history called: url=${url}, direction=${direction}`);

  if (!url) {
    throw new Error("url parameter is required");
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Ensure browser connection
  try {
    await getBrowser();
  } catch (err) {
    logger.error(`browser_navigate_history: Failed to connect to browser: ${err.message}`);
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
    logger.debug(`browser_navigate_history: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can navigate its history.',
      [
        "Use MCPBrowser's browser_fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's browser_navigate_history with the same URL"
      ]
    );
  }

  try {
    const previousUrl = page.url();

    // Navigate history
    let response;
    if (direction === 'forward') {
      response = await page.goForward({ waitUntil: 'domcontentloaded', timeout: 30000 });
    } else {
      response = await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 });
    }

    // goBack/goForward return null if there's no history entry
    if (response === null) {
      logger.info(`browser_navigate_history: No ${direction} history entry available`);
      return new InformationalResponse(
        `No ${direction} history entry available`,
        `The page has no ${direction} history to navigate to. This means you're already at the ${direction === 'back' ? 'first' : 'last'} page in the browsing history for this tab.`,
        [
          direction === 'back'
            ? "Use MCPBrowser's browser_fetch_webpage to navigate to a different URL"
            : "Use MCPBrowser's browser_navigate_history with direction='back' to go back instead",
          "Use MCPBrowser's browser_get_current_html to check the current page content"
        ]
      );
    }

    const currentUrl = page.url();

    // Update domainPages if hostname changed after navigation
    try {
      const newHostname = new URL(currentUrl).hostname;
      if (newHostname !== hostname) {
        domainPages.delete(hostname);
        domainPages.set(newHostname, page);
        logger.info(`browser_navigate_history: Updated domainPages mapping: ${hostname} → ${newHostname}`);
      }
    } catch {
      // If URL parsing fails, keep existing mapping
    }

    // Extract HTML if requested
    let html = null;
    if (returnHtml) {
      await waitForPageReady(page);
      html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
    }

    logger.info(`browser_navigate_history completed: ${direction} from ${previousUrl} to ${currentUrl}`);

    return new NavigateHistorySuccessResponse(
      direction,
      previousUrl,
      currentUrl,
      html,
      [
        "Use MCPBrowser's browser_navigate_history to go back or forward again",
        "Use MCPBrowser's browser_click_element to interact with elements on the page",
        "Use MCPBrowser's browser_get_current_html to re-read the page content",
        "Use MCPBrowser's browser_fetch_webpage to navigate to a new URL"
      ]
    );
  } catch (err) {
    logger.error(`browser_navigate_history failed: ${err.message}`);
    return new InformationalResponse(
      `Navigation ${direction} failed: ${err.message}`,
      'The browser could not navigate. The page may have been closed or the connection was lost.',
      [
        "Try MCPBrowser's browser_fetch_webpage to reload the page",
        "Use MCPBrowser's browser_close_tab and start fresh if needed"
      ]
    );
  }
}
