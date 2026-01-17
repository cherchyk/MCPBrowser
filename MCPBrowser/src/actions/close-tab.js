/**
 * close-tab.js - Close a tab for a specific domain
 */

import { domainPages } from '../core/browser.js';
import { MCPResponse, ErrorResponse } from '../core/responses.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful close_tab operations
 */
export class CloseTabSuccessResponse extends MCPResponse {
  /**
   * @param {string} message - Success message
   * @param {string} hostname - Hostname that was closed
   * @param {string[]} nextSteps - Suggested next actions
   */
  constructor(message, hostname, nextSteps) {
    super(nextSteps);
    
    if (typeof message !== 'string') {
      throw new TypeError('message must be a string');
    }
    if (typeof hostname !== 'string') {
      throw new TypeError('hostname must be a string');
    }
    
    this.message = message;
    this.hostname = hostname;
  }

  _getAdditionalFields() {
    return {
      message: this.message,
      hostname: this.hostname
    };
  }

  getTextSummary() {
    return this.message || `Closed tab for: ${this.hostname}`;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const CLOSE_TAB_TOOL = {
  name: "close_tab",
  title: "Close Tab",
  description: "**BROWSER MANAGEMENT** - Closes the browser tab for the given URL's hostname. This removes the page from the tab pool and forces a fresh session on the next visit to that hostname. Useful for memory management or when you need to clear session state. Note: Uses exact hostname match (www.example.com and example.com are treated as different tabs).",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL whose hostname tab should be closed" }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      message: { type: "string", description: "Success message" },
      hostname: { type: "string", description: "Hostname that was closed" },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["message", "hostname", "nextSteps"],
    additionalProperties: false
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Closes the browser tab for the given URL's hostname and removes it from the tab pool.
 * This forces a fresh session on the next visit to that hostname.
 * @param {object} params - Parameters
 * @param {string} params.url - The URL whose hostname tab should be closed
 * @returns {Promise<object>} Result indicating success or failure
 */
export async function closeTab({ url }) {
  try {
    // Validate URL
    if (!url || typeof url !== 'string') {
      return new ErrorResponse(
        'Invalid or missing URL parameter',
        [
          "Provide a valid URL parameter"
        ]
      );
    }

    // Extract hostname from URL
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return new ErrorResponse(
        'Invalid URL format',
        [
          "Provide a valid URL with protocol (e.g., https://example.com)"
        ]
      );
    }
    
    // Check if we have a tab for this hostname
    if (!domainPages.has(hostname)) {
      // Hostname not found - try to find by actual page URL
      // This handles redirects where tab was created with original hostname
      // but now the page URL is different
      let foundHostname = null;
      for (const [key, page] of domainPages.entries()) {
        try {
          if (!page.isClosed() && page.url() === url) {
            foundHostname = key;
            break;
          }
        } catch {
          // Skip pages we can't access
        }
      }
      
      if (!foundHostname) {
        return new CloseTabSuccessResponse(
          'No open tab found for this hostname',
          hostname,
          [
            "Use fetch_webpage to open a new page if needed"
          ]
        );
      }
      
      // Found the page by URL - use that hostname
      hostname = foundHostname;
    }

    // Get and close the page
    const page = domainPages.get(hostname);
    
    // Check if page is already closed
    if (page.isClosed()) {
      domainPages.delete(hostname);
      return new CloseTabSuccessResponse(
        'Tab was already closed',
        hostname,
        [
          "Use fetch_webpage to open a new page if needed"
        ]
      );
    }

    // Close the page
    await page.close();
    
    // Remove from domain pool
    domainPages.delete(hostname);
    
    console.error(`[MCPBrowser] Closed tab for hostname: ${hostname}`);
    
    return new CloseTabSuccessResponse(
      `Successfully closed tab for ${hostname}`,
      hostname,
      [
        "Use fetch_webpage to open a new page if needed"
      ]
    );
    
  } catch (error) {
    console.error(`[MCPBrowser] Error closing tab:`, error);
    return new ErrorResponse(
      error.message,
      [
        "Check if the URL is correct",
        "Verify a page exists for this hostname"
      ]
    );
  }
}
