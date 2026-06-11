/**
 * scroll-page.js - Scroll within browser page
 * Scrolls the page in various ways for visibility and screenshot capture.
 * Automatically detects scrollable containers inside SPAs.
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// SCROLLABLE AREA SCANNER (exported for reuse by fetch-page, click-element, etc.)
// ============================================================================

/**
 * Scan a page for scrollable containers and return structured data.
 * Lightweight (~20-50ms) — safe to call on every page load.
 *
 * Returns an array of scrollable areas sorted by visible area (largest first).
 * Each entry has a CSS selector the agent can pass to browser_scroll_page's
 * `container` parameter to target that specific area.
 *
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<Array<{selector: string, scrollHeight: number, clientHeight: number, scrollTop: number, hiddenPixels: number, description: string}>>}
 */
export async function scanScrollableAreas(page) {
  return await page.evaluate(() => {
    const results = [];
    const minScrollable = 200; // ignore tiny scroll areas (dropdowns, etc.)

    // Check if the window/document itself scrolls
    const docEl = document.documentElement;
    const body = document.body;
    const windowScrollH = Math.max(docEl.scrollHeight, body.scrollHeight);
    const windowClientH = docEl.clientHeight;
    const htmlOverflow = getComputedStyle(docEl).overflowY;
    const bodyOverflow = getComputedStyle(body).overflowY;
    const windowBlocked = (htmlOverflow === 'hidden' && bodyOverflow === 'hidden');

    if (!windowBlocked && windowScrollH > windowClientH + minScrollable) {
      results.push({
        selector: 'window',
        scrollHeight: windowScrollH,
        clientHeight: windowClientH,
        scrollTop: window.scrollY,
        hiddenPixels: windowScrollH - windowClientH - window.scrollY,
        description: 'Main page (window scroll)'
      });
    }

    // Scan for inner scrollable containers
    // Check common SPA wrappers + anything with overflow: auto/scroll
    const seen = new WeakSet();
    const candidates = document.querySelectorAll(
      'body > *, body > * > *, [class*="scroll"], [role="main"], [role="region"], ' +
      '#root > *, #app > *, #__next > *, [class*="content"], [class*="container"], ' +
      '[class*="panel"], [class*="feed"], [class*="list"], [data-is-scrollable]'
    );

    for (const el of candidates) {
      if (seen.has(el)) continue;
      seen.add(el);

      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow < minScrollable) continue;

      const style = getComputedStyle(el);
      if (style.overflowY === 'hidden' || style.overflowY === 'visible') continue;
      // auto, scroll, overlay are all scrollable

      // Skip elements that are too small to be meaningful content areas
      if (el.clientWidth < 100 || el.clientHeight < 100) continue;

      // Build a stable selector
      let selector;
      if (el.id) {
        selector = '#' + CSS.escape(el.id);
      } else if (el.getAttribute('role')) {
        const role = el.getAttribute('role');
        const roleEls = document.querySelectorAll(`[role="${role}"]`);
        if (roleEls.length === 1) {
          selector = `[role="${role}"]`;
        }
      }
      if (!selector) {
        // Try class-based selector
        const classes = Array.from(el.classList).filter(c =>
          c.includes('scroll') || c.includes('content') || c.includes('main') ||
          c.includes('panel') || c.includes('feed') || c.includes('list') ||
          c.includes('container') || c.includes('body') || c.includes('region')
        );
        if (classes.length > 0) {
          const candidate = '.' + CSS.escape(classes[0]);
          if (document.querySelectorAll(candidate).length === 1) {
            selector = candidate;
          }
        }
      }
      if (!selector) {
        // Use nth-child path as last resort
        const tag = el.tagName.toLowerCase();
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(s => s.tagName === el.tagName);
          const idx = siblings.indexOf(el) + 1;
          const parentSel = parent.id ? '#' + CSS.escape(parent.id) : parent.tagName.toLowerCase();
          selector = `${parentSel} > ${tag}:nth-of-type(${idx})`;
        } else {
          selector = tag;
        }
      }

      // Build a human-readable description from ARIA, class, or tag
      let description = el.getAttribute('aria-label') || '';
      if (!description) {
        const meaningful = Array.from(el.classList).filter(c =>
          !c.match(/^(bolt-|flex|ms-|css-|_|sc-)/i)
        ).slice(0, 2).join(' ');
        description = meaningful || el.tagName.toLowerCase();
      }

      results.push({
        selector,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
        hiddenPixels: el.scrollHeight - el.clientHeight - el.scrollTop,
        description
      });
    }

    // Sort by visible area (largest containers first) and deduplicate nested
    results.sort((a, b) => {
      if (a.selector === 'window') return -1;
      if (b.selector === 'window') return 1;
      return (b.clientHeight * 100 + b.scrollHeight) - (a.clientHeight * 100 + a.scrollHeight);
    });

    // Cap at 5 most significant scrollable areas
    return results.slice(0, 5);
  });
}

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
   * @param {Array} [scrollableAreas] - Detected scrollable containers
   */
  constructor(currentUrl, scrollX, scrollY, pageWidth, pageHeight, viewportWidth, viewportHeight, nextSteps, scrollableAreas = []) {
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
    this.scrollableAreas = scrollableAreas;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      scrollX: this.scrollX,
      scrollY: this.scrollY,
      pageWidth: this.pageWidth,
      pageHeight: this.pageHeight,
      viewportWidth: this.viewportWidth,
      viewportHeight: this.viewportHeight,
      scrollableAreas: this.scrollableAreas
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
  description: "Scroll within a browser-loaded page. Automatically detects scrollable containers inside SPAs (e.g., ADO, Jira, Gmail) where the main content scrolls inside an inner div rather than the window. Use when: you need to see more content below the fold, bring an element into view before clicking, scroll to a specific section, or navigate long pages. Supports scroll by direction, to a CSS selector, or to absolute coordinates. PREREQUISITE: Page must be loaded with browser_fetch_webpage first.",
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
        description: "Direction to scroll. Use with 'amount' parameter.",
        default: "down"
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
      },
      container: {
        type: "string",
        description: "CSS selector of a specific scrollable container to scroll within. Use when the page has multiple scroll areas (e.g., a sidebar + main content). Get available selectors from the scrollableAreas field in fetch/get_current_html/click responses. If omitted, auto-detects the primary scrollable container."
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
      scrollableAreas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector to target this container (or 'window' for main page)" },
            scrollHeight: { type: "number", description: "Total scrollable height in pixels" },
            clientHeight: { type: "number", description: "Visible height in pixels" },
            scrollTop: { type: "number", description: "Current scroll position" },
            hiddenPixels: { type: "number", description: "Pixels of content below current scroll position" },
            description: { type: "string", description: "Human-readable description of the container" }
          }
        },
        description: "Scrollable containers detected on the page. Pass a selector to the 'container' parameter to scroll within a specific area."
      },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["currentUrl", "scrollX", "scrollY", "pageWidth", "pageHeight", "viewportWidth", "viewportHeight", "nextSteps"],
    additionalProperties: false
  },
  annotations: {
    title: "Scroll Page",
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Scroll within an already-loaded page
 * Supports directional scrolling, scroll-to-element, and absolute positioning.
 * Automatically detects scrollable containers in SPAs, or accepts an explicit
 * container selector from the agent.
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page to scroll
 * @param {string} [params.direction] - Direction to scroll: 'up', 'down', 'left', 'right'
 * @param {number} [params.amount=500] - Pixels to scroll in the direction
 * @param {string} [params.selector] - CSS selector to scroll into view
 * @param {number} [params.x] - Absolute x scroll position
 * @param {number} [params.y] - Absolute y scroll position
 * @param {string} [params.container] - CSS selector of scrollable container to scroll within
 * @returns {Promise<Object>} Result object with scroll position data
 */
export async function scrollPage({ url, direction, amount = 500, selector, x, y, container }) {
  logger.info(`browser_scroll_page called: url=${url}, direction=${direction}, amount=${amount}, selector=${selector}, x=${x}, y=${y}${container ? `, container=${container}` : ''}`);
  
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

    // Scan all scrollable areas on the page (lightweight, ~20-50ms)
    const scrollableAreas = await scanScrollableAreas(page);
    logger.debug(`browser_scroll_page: found ${scrollableAreas.length} scrollable area(s)`);

    // Resolve which container to target:
    // 1. Explicit container param from agent
    // 2. Auto-detect: largest non-window scrollable area (if window is blocked)
    // 3. Fallback: window
    let containerInfo; // { isWindow: boolean, selector?: string }
    if (container) {
      // Agent explicitly specified a container
      if (container === 'window') {
        containerInfo = { isWindow: true };
      } else {
        containerInfo = { isWindow: false, selector: container };
      }
      logger.debug(`browser_scroll_page: using explicit container=${container}`);
    } else {
      // Auto-detect: check if window scrolls; if not, pick the largest inner container
      const windowArea = scrollableAreas.find(a => a.selector === 'window');
      const innerAreas = scrollableAreas.filter(a => a.selector !== 'window');

      if (windowArea && windowArea.hiddenPixels > 0) {
        containerInfo = { isWindow: true };
      } else if (innerAreas.length > 0) {
        containerInfo = { isWindow: false, selector: innerAreas[0].selector };
      } else {
        containerInfo = { isWindow: true };
      }
      logger.debug(`browser_scroll_page: auto-detected container=${containerInfo.isWindow ? 'window' : containerInfo.selector}`);
    }
    
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
      // Absolute position mode — target the resolved container
      logger.debug(`browser_scroll_page: Scrolling to absolute position: (${x}, ${y})`);
      
      await page.evaluate(({ scrollX, scrollY, ctr }) => {
        if (ctr.isWindow) {
          window.scrollTo(scrollX, scrollY);
        } else {
          const el = document.querySelector(ctr.selector);
          if (el) {
            el.scrollTo(scrollX, scrollY);
          } else {
            window.scrollTo(scrollX, scrollY);
          }
        }
      }, { scrollX: x, scrollY: y, ctr: containerInfo });
      
    } else if (direction) {
      // Directional scroll mode — target the resolved container
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
      
      await page.evaluate(({ dx, dy, ctr }) => {
        if (ctr.isWindow) {
          window.scrollBy(dx, dy);
        } else {
          const el = document.querySelector(ctr.selector);
          if (el) {
            el.scrollBy(dx, dy);
          } else {
            window.scrollBy(dx, dy);
          }
        }
      }, { dx: delta.x, dy: delta.y, ctr: containerInfo });
      
    } else {
      // No scroll parameters provided - just return current position
      logger.debug(`browser_scroll_page: No scroll action specified, returning current position`);
    }
    
    // Small delay to let scroll complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Re-scan scrollable areas to get updated positions after scroll
    const updatedAreas = await scanScrollableAreas(page);

    // Get final scroll position from the targeted container
    const scrollInfo = await page.evaluate((ctr) => {
      if (ctr.isWindow) {
        return {
          scrollX: window.scrollX,
          scrollY: window.scrollY,
          pageWidth: document.documentElement.scrollWidth,
          pageHeight: document.documentElement.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        };
      }
      const el = document.querySelector(ctr.selector);
      if (el) {
        return {
          scrollX: el.scrollLeft,
          scrollY: el.scrollTop,
          pageWidth: el.scrollWidth,
          pageHeight: el.scrollHeight,
          viewportWidth: el.clientWidth,
          viewportHeight: el.clientHeight
        };
      }
      return {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        pageWidth: document.documentElement.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    }, containerInfo);
    
    logger.info(`browser_scroll_page completed: position=(${scrollInfo.scrollX}, ${scrollInfo.scrollY}), page=(${scrollInfo.pageWidth}x${scrollInfo.pageHeight})${containerInfo.isWindow ? '' : ` container=${containerInfo.selector}`}`);
    
    const containerHint = containerInfo.isWindow
      ? []
      : [`Scrolled within inner container (${containerInfo.selector}). Use container="${containerInfo.selector}" to keep targeting it.`];

    return new ScrollPageSuccessResponse(
      currentUrl,
      scrollInfo.scrollX,
      scrollInfo.scrollY,
      scrollInfo.pageWidth,
      scrollInfo.pageHeight,
      scrollInfo.viewportWidth,
      scrollInfo.viewportHeight,
      [
        ...containerHint,
        "Use MCPBrowser's browser_take_screenshot to capture the current view",
        "Use MCPBrowser's browser_scroll_page again to navigate further",
        "Use MCPBrowser's browser_click_element to interact with visible elements",
        "Use MCPBrowser's browser_get_current_html to get the page content"
      ],
      updatedAreas
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
