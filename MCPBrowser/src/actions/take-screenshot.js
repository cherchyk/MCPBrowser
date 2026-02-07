/**
 * take-screenshot.js - Capture screenshot from browser page
 * Takes screenshots of already-loaded pages for visual analysis
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful take_screenshot operations
 * Returns screenshot as base64-encoded image
 */
export class TakeScreenshotSuccessResponse extends MCPResponse {
  /**
   * @param {string} currentUrl - Current page URL
   * @param {string} screenshotBase64 - Base64-encoded PNG screenshot
   * @param {string} mimeType - Image MIME type
   * @param {string[]} nextSteps - Suggested next actions
   */
  constructor(currentUrl, screenshotBase64, mimeType, nextSteps) {
    super(nextSteps);
    
    if (typeof currentUrl !== 'string') {
      throw new TypeError('currentUrl must be a string');
    }
    if (typeof screenshotBase64 !== 'string') {
      throw new TypeError('screenshotBase64 must be a string');
    }
    if (typeof mimeType !== 'string') {
      throw new TypeError('mimeType must be a string');
    }
    
    this.currentUrl = currentUrl;
    this.screenshotBase64 = screenshotBase64;
    this.mimeType = mimeType;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      screenshotBase64: this.screenshotBase64,
      mimeType: this.mimeType
    };
  }

  getTextSummary() {
    return `Screenshot captured from: ${this.currentUrl}`;
  }

  /**
   * Override toMcpFormat to return image content
   * MCP supports image content type with base64 data
   */
  toMcpFormat() {
    return {
      content: [
        {
          type: "text",
          text: this.getTextSummary()
        },
        {
          type: "image",
          data: this.screenshotBase64,
          mimeType: this.mimeType
        }
      ],
      isError: false,
      structuredContent: this.toJSON()
    };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const TAKE_SCREENSHOT_TOOL = {
  name: "take_screenshot",
  title: "Take Screenshot",
  description: "**VISUAL CAPTURE** - Takes a screenshot of an already-loaded page for visual analysis. Useful when HTML parsing is insufficient or you need to see visual layout, images, charts, or rendered content. Returns a PNG image.\n\n**PREREQUISITE**: Page MUST be loaded with fetch_webpage first. This tool captures the current visual state of the page.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
      fullPage: { type: "boolean", description: "Capture the full scrollable page instead of just the viewport. Default: false (viewport only).", default: false }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      currentUrl: { type: "string", description: "Current page URL" },
      screenshotBase64: { type: "string", description: "Base64-encoded PNG screenshot" },
      mimeType: { type: "string", description: "Image MIME type (image/png)" },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["currentUrl", "screenshotBase64", "mimeType", "nextSteps"],
    additionalProperties: false
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Take a screenshot of an already-loaded page
 * Use this when visual analysis is needed instead of HTML
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page to screenshot
 * @param {boolean} [params.fullPage=false] - Whether to capture full scrollable page
 * @returns {Promise<Object>} Result object with screenshot data
 */
export async function takeScreenshot({ url, fullPage = false }) {
  logger.info(`take_screenshot called: url=${url}, fullPage=${fullPage}`);
  
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
    logger.error(`take_screenshot: Failed to connect to browser: ${err.message}`);
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
    logger.info(`take_screenshot: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost 
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can take a screenshot',
      [
        "Use MCPBrowser's fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's take_screenshot with the same URL"
      ]
    );
  }

  try {
    const currentUrl = page.url();
    
    // Take screenshot as base64
    const screenshotBuffer = await page.screenshot({
      encoding: 'base64',
      type: 'png',
      fullPage: fullPage
    });
    
    logger.info(`take_screenshot completed: captured from ${currentUrl} (fullPage=${fullPage})`);
    
    return new TakeScreenshotSuccessResponse(
      currentUrl,
      screenshotBuffer,
      'image/png',
      [
        "Use MCPBrowser's get_current_html if you need the HTML instead",
        "Use MCPBrowser's click_element to interact with elements",
        "Use MCPBrowser's type_text to fill forms",
        "Use MCPBrowser's close_tab to free resources when done"
      ]
    );
  } catch (err) {
    logger.error(`take_screenshot failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to take screenshot: ${err.message}`,
      'Could not capture screenshot from the page. The page may have navigated away or the connection was lost.',
      [
        "Try MCPBrowser's fetch_webpage to reload the page",
        "Use MCPBrowser's close_tab and start fresh if needed"
      ]
    );
  }
}
