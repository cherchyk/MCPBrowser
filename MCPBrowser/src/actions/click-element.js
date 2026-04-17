/**
 * click-element.js - Click element action
 * 
 * This function handles two distinct use cases:
 * 
 * 1. NAVIGATION/CONTENT UPDATES (returnHtml: true, default):
 *    - Clicks the element
 *    - Waits for page stability (network idle, DOM updates)
 *    - Returns the updated HTML content
 *    - Use for: Links, navigation buttons, SPA route changes (e.g., Gmail folders)
 *    - Takes 3-8 seconds due to stability wait
 * 
 * 2. FAST FORM INTERACTIONS (returnHtml: false):
 *    - Clicks the element
 *    - Minimal 300ms wait
 *    - Returns success without HTML
 *    - Use for: Checkboxes, radio buttons, form fields that don't navigate
 *    - Takes <1 second
 * 
 * Why this design?
 * - Solves SPA navigation issue: URL hash changes instantly (#inbox → #trash),
 *   but content loads asynchronously. Without waiting, we'd return old content.
 * - Consistent with fetch_webpage: Both wait for stability and return HTML
 * - Flexible: Can disable waiting for fast form interactions
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { extractAndProcessHtml, waitForPageReady } from '../core/page.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';
import { getPluginNextSteps, getRecommendedPlugins } from '../core/plugin-loader.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

/**
 * Structured response for click_element with JS fallback metadata
 */
export class ClickWithFallbackResponse extends MCPResponse {
  constructor({ status, fallbackUsed = false, nativeAttempt, fallbackAttempt, postClickWait, currentUrl, html = null, message, nextSteps = [], recommendedPlugins = [] }) {
    super(nextSteps);
    this.status = status;
    this.fallbackUsed = fallbackUsed;
    this.nativeAttempt = nativeAttempt;
    this.fallbackAttempt = fallbackAttempt;
    this.postClickWait = postClickWait;
    this.currentUrl = currentUrl;
    this.html = html;
    this.message = message;
    this.recommendedPlugins = recommendedPlugins;
  }

  _getAdditionalFields() {
    return {
      status: this.status,
      fallbackUsed: this.fallbackUsed,
      nativeAttempt: this.nativeAttempt,
      fallbackAttempt: this.fallbackAttempt,
      postClickWait: this.postClickWait,
      currentUrl: this.currentUrl,
      html: this.html,
      message: this.message,
      recommendedPlugins: this.recommendedPlugins
    };
  }

  getTextSummary() {
    const base = this.message || 'Click completed';
    return this.fallbackUsed ? `${base} (JS fallback used)` : base;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const CLICK_ELEMENT_TOOL = {
  name: "click_element",
  title: "Click Element",
  description: "**BROWSER INTERACTION** - Clicks elements on browser-loaded pages. Use this for navigation (clicking links/buttons), form submission, and any user interaction that requires clicking.\n\nWorks with any clickable element including buttons, links, or elements with onclick handlers. Can target by CSS selector or text content. Waits for page stability and returns updated HTML by default.\n\n**PREREQUISITE**: Page MUST be loaded with fetch_webpage first. This tool operates on an already-loaded page in the browser.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
      selector: { type: "string", description: "CSS selector for the element to click (e.g., '#submit-btn', '.login-button')" },
      text: { type: "string", description: "Text content to search for if selector is not provided (e.g., 'Sign In', 'Submit')" },
      waitForElementTimeout: { type: "number", description: "Maximum time to wait for element in milliseconds", default: 1000 },
      returnHtml: { type: "boolean", description: "Whether to wait for stability and return HTML after clicking. Set to false for fast form interactions (checkboxes, radio buttons).", default: true },
      removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%. Only used when returnHtml is true.", default: true },
      postClickWait: { type: "number", description: "Milliseconds to wait after click for SPAs to render dynamic content.", default: 1000 }
    },
    required: ["url"],
    additionalProperties: false,
  },
  outputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["success", "failed"], description: "Overall click status after native and fallback attempts" },
      fallbackUsed: { type: "boolean", description: "True when native click timed out and JS fallback ran" },
      nativeAttempt: { 
        type: "object",
        properties: {
          status: { type: "string", enum: ["success", "timeout", "error"] },
          durationMs: { type: "number" },
          error: { type: ["string", "null"] }
        },
        required: ["status", "durationMs"]
      },
      fallbackAttempt: {
        type: ["object", "null"],
        properties: {
          status: { type: "string", enum: ["success", "timeout", "error"] },
          durationMs: { type: "number" },
          error: { type: ["string", "null"] }
        },
        required: ["status", "durationMs"],
        description: "Present when fallbackUsed is true"
      },
      postClickWait: {
        type: "object",
        properties: {
          applied: { type: "boolean" },
          waitedMs: { type: "number" }
        },
        required: ["applied", "waitedMs"],
        description: "Post-click wait metadata"
      },
      currentUrl: { type: "string", description: "URL after click" },
      message: { type: "string", description: "Status message" },
      html: { 
        type: ["string", "null"], 
        description: "Page HTML if returnHtml was true, null otherwise" 
      },
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
    required: ["status", "fallbackUsed", "nativeAttempt", "currentUrl", "message", "html", "nextSteps"],
    additionalProperties: false
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Click on an element on the page
 * 
 * @param {Object} params - Click parameters
 * @param {string} params.url - The URL of the page to interact with
 * @param {string} [params.selector] - CSS selector for the element to click
 * @param {string} [params.text] - Text content to search for (alternative to selector)
 * @param {number} [params.waitForElementTimeout=30000] - Maximum time (ms) to wait for element to appear before failing
 * @param {boolean} [params.returnHtml=true] - Whether to wait for stability and return HTML
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML (only if returnHtml is true)
 * @param {number} [params.postClickWait=1000] - Milliseconds to wait after click for SPAs to render dynamic content
 * @returns {Promise<Object>} Result object with success status and details
 * 
 * @example
 * // Navigate to Gmail Bin folder (waits for emails to load, returns HTML)
 * const result = await clickElement({ url: gmailUrl, text: "Bin" });
 * console.log(result.html); // Contains bin emails
 * 
 * @example
 * // Fast checkbox click (no wait, no HTML)
 * const result = await clickElement({ 
 *   url: formUrl, 
 *   selector: "#agree-checkbox",
 *   returnHtml: false 
 * });
 */
export async function clickElement({ url, selector, text, waitForElementTimeout = 30000, returnHtml = true, removeUnnecessaryHTML = true, postClickWait = 1000 }) {
  logger.info(`click_element called: ${selector || `text="${text}"`}`);
  
  if (!url) {
    throw new Error("url parameter is required");
  }
  
  if (!selector && !text) {
    throw new Error("Either selector or text parameter is required");
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
    logger.error(`click_element: Failed to connect to browser: ${err.message}`);
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
    logger.debug(`click_element: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost 
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can interact with elements on it',
      [
        "Use MCPBrowser's fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's click_element with the same URL"
      ]
    );
  }

  try {
    let elementHandle;
    
    if (selector) {
      // Use CSS selector
      await page.waitForSelector(selector, { timeout: waitForElementTimeout, visible: true });
      elementHandle = await page.$(selector);
    } else {
      // Search by text content
      await page.waitForFunction(
        (searchText) => {
          const elements = Array.from(document.querySelectorAll('*'));
          return elements.some(el => {
            const text = el.textContent?.trim();
            return text && text.includes(searchText) && el.offsetParent !== null;
          });
        },
        { timeout: waitForElementTimeout },
        text
      );
      
      elementHandle = await page.evaluateHandle((searchText) => {
        const elements = Array.from(document.querySelectorAll('*'));
        // Prioritize smaller elements (more specific matches)
        const matches = elements.filter(el => {
          const elText = el.textContent?.trim();
          return elText && elText.includes(searchText) && el.offsetParent !== null;
        });
        matches.sort((a, b) => a.textContent.length - b.textContent.length);
        return matches[0];
      }, text);
    }

    if (!elementHandle || !elementHandle.asElement()) {
      return new InformationalResponse(
        selector ? `Element not found: ${selector}` : `Element with text "${text}" not found`,
        'The element could not be located on the page. It may be hidden, dynamically loaded, or the selector/text may be incorrect.',
        [
          "Use MCPBrowser's get_current_html to verify page content",
          "Use MCPBrowser's take_screenshot to see the visual layout if HTML is unclear",
          "Try a different selector or text",
          "Check if the element is visible on the page"
        ]
      );
    }

    // Scroll element into view and click
    await page.evaluate(el => el.scrollIntoView({ behavior: 'auto', block: 'center' }), elementHandle);

    const attemptClick = async (label, fn, timeoutMs) => {
      const start = Date.now();
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      });

      try {
        await Promise.race([fn(), timeoutPromise]);
        return { status: 'success', durationMs: Date.now() - start };
      } catch (error) {
        const status = /timeout|timed.out/i.test(error?.message || '') ? 'timeout' : 'error';
        return { status, durationMs: Date.now() - start, error: error?.message || 'Unknown error' };
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const clickTimeout = Math.min(Math.max(waitForElementTimeout, 500), 60000);
    logger.debug(`Clicking: ${selector || `text="${text}"`}`);
    const nativeAttempt = await attemptClick('native click', () => elementHandle.click(), clickTimeout);

    let fallbackUsed = false;
    let fallbackAttempt = null;

    if (nativeAttempt.status === 'timeout') {
      fallbackUsed = true;
      fallbackAttempt = await attemptClick('fallback click', () => page.evaluate(el => el.click(), elementHandle), clickTimeout);
    }

    const finalStatus = nativeAttempt.status === 'success' || (fallbackAttempt && fallbackAttempt.status === 'success')
      ? 'success'
      : 'failed';

    if (finalStatus === 'success') {
      logger.debug(`Waiting for page to be ready${returnHtml ? '' : ' (fast mode)'}...`);
      await waitForPageReady(page, { afterInteraction: true });

      if (postClickWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postClickWait));
      }
    }

    const currentUrl = page.url();
    const html = finalStatus === 'success' && returnHtml ? await extractAndProcessHtml(page, removeUnnecessaryHTML) : null;
    const baseMessage = selector ? `Clicked element: ${selector}` : `Clicked element with text: "${text}"`;
    const message = finalStatus === 'success'
      ? baseMessage
      : fallbackUsed
        ? `Click failed after fallback. Native: ${nativeAttempt.error || nativeAttempt.status}. Fallback: ${fallbackAttempt?.error || fallbackAttempt?.status}`
        : `Click failed. Native: ${nativeAttempt.error || nativeAttempt.status}`;

    const nextSteps = returnHtml
      ? [
          ...(html ? getPluginNextSteps(currentUrl, html) : []),
          "Use MCPBrowser's click_element again to navigate further",
          "Use MCPBrowser's type_text to fill forms if needed",
          "Use MCPBrowser's get_current_html to refresh page state",
          "Use MCPBrowser's take_screenshot if page has popups or visual content that's hard to parse from HTML",
          "Use MCPBrowser's close_tab when finished"
        ]
      : [
          "Use MCPBrowser's get_current_html to see updated page state",
          "Use MCPBrowser's take_screenshot if the page has popups, modals, or visual content",
          "Use MCPBrowser's click_element or MCPBrowser's type_text for more interactions",
          "Use MCPBrowser's close_tab when finished"
        ];

    logger.info(`click_element completed: ${selector || `text="${text}"`}${fallbackUsed ? ' (fallback used)' : ''}`);

    return new ClickWithFallbackResponse({
      status: finalStatus,
      fallbackUsed,
      nativeAttempt,
      fallbackAttempt,
      postClickWait: { applied: finalStatus === 'success', waitedMs: finalStatus === 'success' ? postClickWait : 0 },
      currentUrl,
      html,
      message,
      nextSteps,
      recommendedPlugins: html ? getRecommendedPlugins(currentUrl, html) : []
    });
  } catch (err) {
    logger.error(`click_element failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to click element: ${err.message}`,
      'The element was found but could not be clicked. It may be covered by another element, not interactable, or the page may have changed.',
      [
        "Use MCPBrowser's get_current_html to check current page state",
        "Use MCPBrowser's take_screenshot to see what's visually blocking the element",
        "Verify the selector or text is correct",
        "Try MCPBrowser's fetch_webpage to reload if page is stale"
      ]
    );
  }
}
