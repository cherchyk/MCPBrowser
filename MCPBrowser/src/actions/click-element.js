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

import { getBrowser, domainPages } from '../core/browser.js';
import { extractAndProcessHtml, waitForPageStability } from '../core/page.js';
import { MCPResponse, ErrorResponse } from '../core/responses.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful click_element operations
 */
export class ClickElementSuccessResponse extends MCPResponse {
  /**
   * @param {string} currentUrl - URL after click
   * @param {string} message - Success message
   * @param {string|null} html - Page HTML if returnHtml was true
   * @param {string[]} nextSteps - Suggested next actions
   */
  constructor(currentUrl, message, html, nextSteps) {
    super(nextSteps);
    
    if (typeof currentUrl !== 'string') {
      throw new TypeError('currentUrl must be a string');
    }
    if (typeof message !== 'string') {
      throw new TypeError('message must be a string');
    }
    if (html !== null && typeof html !== 'string') {
      throw new TypeError('html must be a string or null');
    }
    
    this.currentUrl = currentUrl;
    this.message = message;
    this.html = html;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      message: this.message,
      html: this.html
    };
  }

  getTextSummary() {
    return this.message || "Element clicked successfully";
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
      currentUrl: { type: "string", description: "URL after click" },
      message: { type: "string", description: "Success message" },
      html: { 
        type: ["string", "null"], 
        description: "Page HTML if returnHtml was true, null otherwise" 
      },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["currentUrl", "message", "html", "nextSteps"],
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
      return new ErrorResponse(
        selector ? `Element not found: ${selector}` : `Element with text "${text}" not found`,
        [
          "Use get_current_html to verify page content",
          "Try a different selector or text",
          "Check if the element is visible on the page"
        ]
      );
    }

    // Scroll element into view and click
    // For automation, use instant scroll instead of smooth animation to avoid delays
    await page.evaluate(el => el.scrollIntoView({ behavior: 'auto', block: 'center' }), elementHandle);
    // original:
    // Smooth scroll (commented out for performance):
    // await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), elementHandle);
    // await new Promise(r => setTimeout(r, 300)); // Brief delay after scroll
    
    await elementHandle.click();
    
    if (returnHtml) {
      // Wait for page to stabilize (handles both navigation and SPA content updates)
      // This ensures content is fully loaded before returning, just like fetch_webpage does
      await waitForPageStability(page);
      
      // Wait for SPAs to render dynamic content after click
      if (postClickWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postClickWait));
      }
      
      const currentUrl = page.url();
      const html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
      
      return new ClickElementSuccessResponse(
        currentUrl,
        selector ? `Clicked element: ${selector}` : `Clicked element with text: "${text}"`,
        html,
        [
          "Use click_element again to navigate further",
          "Use type_text to fill forms if needed",
          "Use get_current_html to refresh page state",
          "Use close_tab when finished"
        ]
      );
    } else {
      // Wait for page to stabilize even for fast clicks (ensures JS has finished)
      await waitForPageStability(page);
      
      // Wait for SPAs to render dynamic content after click
      if (postClickWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postClickWait));
      }
      
      const currentUrl = page.url();
      
      return new ClickElementSuccessResponse(
        currentUrl,
        selector ? `Clicked element: ${selector}` : `Clicked element with text: "${text}"`,
        null,
        [
          "Use get_current_html to see updated page state",
          "Use click_element or type_text for more interactions",
          "Use close_tab when finished"
        ]
      );
    }
  } catch (err) {
    return new ErrorResponse(
      `Failed to click element: ${err.message}`,
      [
        "Use get_current_html to check current page state",
        "Verify the selector or text is correct",
        "Try fetch_webpage to reload if page is stale"
      ]
    );
  }
}
