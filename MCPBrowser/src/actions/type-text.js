/**
 * type-text.js - Type text into input fields
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
 * Response for successful type_text operations
 */
export class TypeTextSuccessResponse extends MCPResponse {
  /**
   * @param {string} currentUrl - URL after typing
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
    return this.message || "Text typed successfully";
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const TYPE_TEXT_TOOL = {
  name: "type_text",
  title: "Type Text",
  description: "**BROWSER INTERACTION** - Types text into input fields on browser-loaded pages. Use this for filling forms, entering search queries, or any text input on the page.\n\nWorks with input fields, textareas, and other editable elements.\n\n**PREREQUISITE**: Page MUST be loaded with fetch_webpage first. This tool operates on an already-loaded page in the browser.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
      selector: { type: "string", description: "CSS selector for the input element (e.g., '#username', 'input[name=\"email\"]')" },
      text: { type: "string", description: "Text to type into the field" },
      clear: { type: "boolean", description: "Whether to clear existing text first", default: true },
      typeDelay: { type: "number", description: "Delay between keystrokes in milliseconds (simulates human typing)", default: 50 },
      waitForElementTimeout: { type: "number", description: "Maximum time to wait for element in milliseconds", default: 5000 },
      returnHtml: { type: "boolean", description: "Whether to wait for stability and return HTML after typing.", default: true },
      removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%. Only used when returnHtml is true.", default: true },
      postTypeWait: { type: "number", description: "Milliseconds to wait after typing for SPAs to render dynamic content.", default: 1000 }
    },
    required: ["url", "selector", "text"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      currentUrl: { type: "string", description: "URL after typing" },
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
 * Type text into an input field
 * @param {Object} params - Type parameters
 * @param {string} params.url - The URL of the page to interact with
 * @param {string} params.selector - CSS selector for the input element
 * @param {string} params.text - Text to type
 * @param {boolean} [params.clear=true] - Whether to clear existing text first
 * @param {number} [params.typeDelay=50] - Delay between keystrokes in milliseconds
 * @param {number} [params.waitForElementTimeout=30000] - Maximum time to wait for element
 * @param {boolean} [params.returnHtml=true] - Whether to wait for stability and return HTML
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML (only if returnHtml is true)
 * @param {number} [params.postTypeWait=1000] - Milliseconds to wait after typing for SPAs to render dynamic content
 * @returns {Promise<Object>} Result object with success status and details
 */
export async function typeText({ url, selector, text, clear = true, typeDelay = 50, waitForElementTimeout = 30000, returnHtml = true, removeUnnecessaryHTML = true, postTypeWait = 1000 }) {
  if (!url) {
    throw new Error("url parameter is required");
  }
  
  if (!selector) {
    throw new Error("selector parameter is required");
  }
  
  if (text === undefined || text === null) {
    throw new Error("text parameter is required");
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
      `No open page found for ${hostname}. Please fetch the page first using fetch_webpage_protected.`,
      [
        "Use fetch_webpage to load the page first"
      ]
    );
  }

  try {
    await page.waitForSelector(selector, { timeout: waitForElementTimeout, visible: true });
    
    if (clear) {
      await page.click(selector, { clickCount: 3 }); // Select all text
      await page.keyboard.press('Backspace');
    }
    
    await page.type(selector, String(text), { delay: typeDelay });
    
    if (returnHtml) {
      // Wait for page to stabilize (handles form validation, autocomplete, etc.)
      await waitForPageStability(page);
      
      // Wait for SPAs to render dynamic content after typing
      if (postTypeWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postTypeWait));
      }
      
      const currentUrl = page.url();
      const html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
      
      return new TypeTextSuccessResponse(
        currentUrl,
        `Typed text into: ${selector}`,
        html,
        [
          "Use type_text to fill additional fields",
          "Use click_element to submit the form or navigate",
          "Use get_current_html to check for validation messages",
          "Use close_tab when finished"
        ]
      );
    } else {
      // Wait for page to stabilize even without returning HTML
      await waitForPageStability(page);
      
      // Wait for SPAs to render dynamic content after typing
      if (postTypeWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postTypeWait));
      }
      
      const currentUrl = page.url();
      
      return new TypeTextSuccessResponse(
        currentUrl,
        `Typed text into: ${selector}`,
        null,
        [
          "Use get_current_html to see updated page state",
          "Use type_text for additional fields or click_element to submit",
          "Use close_tab when finished"
        ]
      );
    }
  } catch (err) {
    return new ErrorResponse(
      `Failed to type text: ${err.message}`,
      [
        "Use get_current_html to verify page state",
        "Check if the selector is correct",
        "Verify the input field is visible and enabled"
      ]
    );
  }
}
