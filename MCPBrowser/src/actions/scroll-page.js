/**
 * scroll-page.js - Scroll within browser page
 * Scrolls the page in various ways for visibility and screenshot capture
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
 * Response for successful browser_scroll_page operations
 * Returns scroll result with new scroll position
 */
export class ScrollPageSuccessResponse extends MCPResponse {
  /**
   * @param {string} currentUrl - Current page URL
   * @param {number} scrollX - New horizontal scroll position
   * @param {number} scrollY - New vertical scroll position
   * @param {number} pageWidth - Total page width
   * @param {number} pageHeight - Total page height
   * @param {number} viewportWidth - Viewport width
   * @param {number} viewportHeight - Viewport height
   * @param {string[]} nextSteps - Suggested next actions
   */
  constructor(currentUrl, scrollX, scrollY, pageWidth, pageHeight, viewportWidth, viewportHeight, nextSteps) {
    super(nextSteps);
    
    if (typeof currentUrl !== 'string') {
      throw new TypeError('currentUrl must be a string');
    }
    if (typeof scrollX !== 'number') {
      throw new TypeError('scrollX must be a number');
    }
    if (typeof scrollY !== 'number') {
      throw new TypeError('scrollY must be a number');
    }
    if (typeof pageWidth !== 'number') {
      throw new TypeError('pageWidth must be a number');
    }
    if (typeof pageHeight !== 'number') {
      throw new TypeError('pageHeight must be a number');
    }
    if (typeof viewportWidth !== 'number') {
      throw new TypeError('viewportWidth must be a number');
    }
    if (typeof viewportHeight !== 'number') {
      throw new TypeError('viewportHeight must be a number');
    }
    
    this.currentUrl = currentUrl;
    this.scrollX = scrollX;
    this.scrollY = scrollY;
    this.pageWidth = pageWidth;
    this.pageHeight = pageHeight;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      scrollX: this.scrollX,
      scrollY: this.scrollY,
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight
    };
  }

  getTextSummary() {
    const verticalPercent = this.pageHeight > 0 
      ? Math.round((this.scrollY / (this.pageHeight - this.viewportHeight)) * 100) 
      : 0;
    return `Scrolled to position (${this.scrollX}, ${this.scrollY}) - ${Math.min(100, Math.max(0, verticalPercent))}% down the page`;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const SCROLL_PAGE_TOOL = {
  name: "browser_scroll_page",
  title: "Scroll Page",
  description: "Scroll within a browser-loaded page. Use when: you need to see more content below the fold, bring an element into view before clicking, scroll to a specific section, or navigate long pages. Supports scroll by direction, to a CSS selector, or to absolute coordinates. PREREQUISITE: Page must be loaded with browser_fetch_webpage first.",
  inputSchema: {
    type: "object",
    properties: {
      url: { 
        type: "string", 
        description: "The URL of the page (must match a previously fetched page)" 
      },
      direction: { 
        type: "string", 
        enum: ["up", "down", "left", "right"],
        description: "Direction to scroll. Use with 'amount' parameter." 
      },
      amount: { 
        type: "number", 
        description: "Pixels to scroll in the specified direction. Default: 500 (roughly half a viewport).",
        default: 500
      },
      selector: { 
        type: "string", 
        description: "CSS selector of element to scroll into view. When provided, ignores direction/amount and scrolls until the element is visible." 
      },
      x: { 
        type: "number", 
        description: "Absolute horizontal scroll position. Use with 'y' for precise positioning." 
      },
      y: { 
        type: "number", 
        description: "Absolute vertical scroll position. Use with 'x' for precise positioning." 
      }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      currentUrl: { type: "string", description: "Current page URL" },
      scrollX: { type: "number", description: "New horizontal scroll position in pixels" },
      scrollY: { type: "number", description: "New vertical scroll position in pixels" },
      pageWidth: { type: "number", description: "Total scrollable page width" },
      pageHeight: { type: "number", description: "Total scrollable page height" },
      viewportWidth: { type: "number", description: "Visible viewport width" },
      viewportHeight: { type: "number", description: "Visible viewport height" },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["currentUrl", "scrollX", "scrollY", "pageWidth", "pageHeight", "viewportWidth", "viewportHeight", "nextSteps"],
    additionalProperties: false
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Scroll within an already-loaded page
 * Supports directional scrolling, scroll-to-element, and absolute positioning
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page to scroll
 * @param {string} [params.direction] - Direction to scroll: 'up', 'down', 'left', 'right'
 * @param {number} [params.amount=500] - Pixels to scroll in the direction
 * @param {string} [params.selector] - CSS selector to scroll into view
 * @param {number} [params.x] - Absolute x scroll position
 * @param {number} [params.y] - Absolute y scroll position
 * @returns {Promise<Object>} Result object with scroll position data
 */
export async function scrollPage({ url, direction, amount = 500, selector, x, y }) {
  logger.info(`browser_scroll_page called: url=${url}, direction=${direction}, amount=${amount}, selector=${selector}, x=${x}, y=${y}`);
  
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
    logger.error(`browser_scroll_page: Failed to connect to browser: ${err.message}`);
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
    logger.debug(`browser_scroll_page: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost 
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can scroll',
      [
        "Use MCPBrowser's browser_fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's browser_scroll_page with the same URL"
      ]
    );
  }

  try {
    const currentUrl = page.url();
    
    // Determine scroll mode and execute
    if (selector) {
      // Scroll to element mode
      logger.debug(`browser_scroll_page: Scrolling to element: ${selector}`);
      
      const elementExists = await page.$(selector);
      if (!elementExists) {
        return new InformationalResponse(
          `Element not found: ${selector}`,
          'The specified CSS selector did not match any element on the page.',
          [
            "Use MCPBrowser's browser_get_current_html to inspect the page structure",
            "Verify the CSS selector is correct",
            "Try a different selector"
          ]
        );
      }
      
      await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        if (element) {
          element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        }
      }, selector);
      
    } else if (typeof x === 'number' && typeof y === 'number') {
      // Absolute position mode
      logger.debug(`browser_scroll_page: Scrolling to absolute position: (${x}, ${y})`);
      
      await page.evaluate(({ scrollX, scrollY }) => {
        window.scrollTo(scrollX, scrollY);
      }, { scrollX: x, scrollY: y });
      
    } else if (direction) {
      // Directional scroll mode
      logger.debug(`browser_scroll_page: Scrolling ${direction} by ${amount}px`);
      
      const scrollDeltas = {
        up: { x: 0, y: -amount },
        down: { x: 0, y: amount },
        left: { x: -amount, y: 0 },
        right: { x: amount, y: 0 }
      };
      
      const delta = scrollDeltas[direction];
      if (!delta) {
        throw new Error(`Invalid direction: ${direction}. Must be one of: up, down, left, right`);
      }
      
      await page.evaluate(({ dx, dy }) => {
        window.scrollBy(dx, dy);
      }, { dx: delta.x, dy: delta.y });
      
    } else {
      // No scroll parameters provided - just return current position
      logger.debug(`browser_scroll_page: No scroll action specified, returning current position`);
    }
    
    // Small delay to let scroll complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Get final scroll position and page dimensions
    const scrollInfo = await page.evaluate(() => ({
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      pageWidth: document.documentElement.scrollWidth,
      pageHeight: document.documentElement.scrollHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    }));
    
    logger.info(`browser_scroll_page completed: position=(${scrollInfo.scrollX}, ${scrollInfo.scrollY}), page=(${scrollInfo.pageWidth}x${scrollInfo.pageHeight})`);
    
    return new ScrollPageSuccessResponse(
      currentUrl,
      scrollInfo.scrollX,
      scrollInfo.scrollY,
      scrollInfo.pageWidth,
      scrollInfo.pageHeight,
      scrollInfo.viewportWidth,
      scrollInfo.viewportHeight,
      [
        "Use MCPBrowser's browser_take_screenshot to capture the current view",
        "Use MCPBrowser's browser_scroll_page again to navigate further",
        "Use MCPBrowser's browser_click_element to interact with visible elements",
        "Use MCPBrowser's browser_get_current_html to get the page content"
      ]
    );
  } catch (err) {
    logger.error(`browser_scroll_page failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to scroll page: ${err.message}`,
      'Could not scroll the page. The page may have navigated away or the connection was lost.',
      [
        "Try MCPBrowser's browser_fetch_webpage to reload the page",
        "Use MCPBrowser's browser_close_tab and start fresh if needed"
      ]
    );
  }
}
