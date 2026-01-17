/**
 * get-current-html.js - Get current HTML from an already-loaded page
 */

import { getBrowser, domainPages } from '../core/browser.js';
import { extractAndProcessHtml } from '../core/page.js';
import { MCPResponse, ErrorResponse } from '../core/responses.js';

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
  if (!url) {
    throw new Error("url parameter is required");
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const browser = await getBrowser();
  let page = domainPages.get(hostname);
  
  if (!page || page.isClosed()) {
    return new ErrorResponse(
      `No open page found for ${hostname}. Please fetch the page first using fetch_webpage.`,
      [
        "Use fetch_webpage to load the page first"
      ]
    );
  }

  try {
    const currentUrl = page.url();
    const html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
    
    return new GetCurrentHtmlSuccessResponse(
      currentUrl,
      html,
      [
        "Use click_element to interact with elements",
        "Use type_text to fill forms",
        "Use close_tab to free resources when done"
      ]
    );
  } catch (err) {
    return new ErrorResponse(
      `Failed to get HTML: ${err.message}`,
      [
        "Try fetch_webpage to reload the page",
        "Use close_tab and start fresh if needed"
      ]
    );
  }
}
