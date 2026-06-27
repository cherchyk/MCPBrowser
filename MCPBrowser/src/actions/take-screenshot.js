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
 * Response for successful browser_take_screenshot operations
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
  name: "browser_take_screenshot",
  title: "Take Screenshot",
  description: "Capture a screenshot of a browser-loaded page as PNG. Set fullPage=true to capture the entire scrollable page in one shot — this avoids multiple scroll+screenshot cycles. Only use fullPage=false when you specifically need just the current viewport (rare). Use when: you need to see what a page looks like, analyze visual layout, view charts/images/graphs, debug UI issues, or when HTML alone is insufficient. Returns base64-encoded PNG. PREREQUISITE: Page must be loaded with browser_fetch_webpage first.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
      // fullPage: { type: "boolean", description: "RECOMMENDED: set to true to capture the entire scrollable page in one shot instead of just the viewport. Avoids multiple scroll+screenshot cycles. Automatically falls back to viewport if the page is extremely tall.", default: false }
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
  },
  annotations: {
    title: "Take Screenshot",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
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

/** Max page height (px) for safe full-page capture. Beyond this, fall back to viewport to avoid giant payloads. */
const MAX_FULL_PAGE_HEIGHT = 12000;

export async function takeScreenshot({ url, fullPage = false }) {
  logger.info(`browser_take_screenshot called: url=${url}, fullPage=${fullPage}`);
  
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
    logger.error(`browser_take_screenshot: Failed to connect to browser: ${err.message}`);
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
    logger.debug(`browser_take_screenshot: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost 
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can take a screenshot',
      [
        "Use MCPBrowser's browser_fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's browser_take_screenshot with the same URL"
      ]
    );
  }

  try {
    const currentUrl = page.url();
    
    // Safety cap: if fullPage requested, check page height first
    let effectiveFullPage = fullPage;
    let wasClipped = false;
    if (fullPage) {
      const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      if (pageHeight > MAX_FULL_PAGE_HEIGHT) {
        logger.warn(`browser_take_screenshot: page height ${pageHeight}px exceeds ${MAX_FULL_PAGE_HEIGHT}px cap, falling back to viewport`);
        effectiveFullPage = false;
        wasClipped = true;
      }
    }
    
    // Take screenshot as base64
    const screenshotBuffer = await page.screenshot({
      encoding: 'base64',
      type: 'png',
      fullPage: effectiveFullPage
    });
    
    logger.info(`browser_take_screenshot completed: captured from ${currentUrl} (fullPage=${effectiveFullPage}${wasClipped ? ', clipped from full' : ''})`);
    
    const nextSteps = [];
    if (wasClipped) {
      nextSteps.push(`Page too tall for full-page capture (>${MAX_FULL_PAGE_HEIGHT}px). Viewport screenshot taken instead. Use browser_scroll_page to see more content, then browser_take_screenshot again.`);
    } else if (!fullPage) {
      nextSteps.push("Use MCPBrowser's browser_take_screenshot with fullPage=true to capture the entire page in one shot");
    }
    nextSteps.push(
      "Use MCPBrowser's browser_get_current_html if you need the HTML instead",
      "Use MCPBrowser's browser_click_element to interact with elements",
      "Use MCPBrowser's browser_type_text to fill forms",
      "Use MCPBrowser's browser_close_tab to free resources when done"
    );
    
    return new TakeScreenshotSuccessResponse(
      currentUrl,
      screenshotBuffer,
      'image/png',
      nextSteps
    );
  } catch (err) {
    logger.error(`browser_take_screenshot failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to take screenshot: ${err.message}`,
      'Could not capture screenshot from the page. The page may have navigated away or the connection was lost.',
      [
        "Try MCPBrowser's browser_fetch_webpage to reload the page",
        "Use MCPBrowser's browser_close_tab and start fresh if needed"
      ]
    );
  }
}
