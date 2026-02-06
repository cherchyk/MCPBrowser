/**
 * type-text.js - Type text into input fields
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { extractAndProcessHtml, waitForPageStability } from '../core/page.js';
import { MCPResponse, ErrorResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';

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
  const startTime = Date.now();
  logger.info(`type_text called: selector=${selector}, url=${url}`);
  
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

  // Ensure browser connection (triggers domain map rebuild on reconnect)
  try {
    await getBrowser();
  } catch (err) {
    logger.error(`type_text: Failed to connect to browser: ${err.message}`);
    return new ErrorResponse(
      `Browser connection failed: ${err.message}`,
      [
        'Ensure Chrome or Edge browser is installed and running',
        'Check that remote debugging is enabled (--remote-debugging-port)',
        'Try restarting the MCP server'
      ]
    );
  }

  // Validate page exists and is usable
  const { page, error: pageError } = await getValidatedPage(hostname);
  
  if (!page) {
    const isConnectionLost = pageError && pageError.includes('connection');
    logger.info(`type_text: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost 
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can type text into elements',
      [
        "Use MCPBrowser's fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's type_text with the same URL"
      ]
    );
  }

  try {
    await page.waitForSelector(selector, { timeout: waitForElementTimeout, visible: true });
    
    if (clear) {
      await page.click(selector, { clickCount: 3 }); // Select all text
      await page.keyboard.press('Backspace');
    }
    
    logger.info(`Typing into: ${selector}`);
    await page.type(selector, String(text), { delay: typeDelay });
    
    if (returnHtml) {
      // Wait for page to stabilize (handles form validation, autocomplete, etc.)
      logger.info('Waiting for page stability after typing...');
      await waitForPageStability(page);
      
      // Wait for SPAs to render dynamic content after typing
      if (postTypeWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postTypeWait));
      }
      
      const currentUrl = page.url();
      const html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
      
      logger.info(`type_text completed: typed into ${selector}`);
      
      return new TypeTextSuccessResponse(
        currentUrl,
        `Typed text into: ${selector}`,
        html,
        [
          "Use MCPBrowser's type_text to fill additional fields",
          "Use MCPBrowser's click_element to submit the form or navigate",
          "Use MCPBrowser's get_current_html to check for validation messages",
          "Use MCPBrowser's close_tab when finished"
        ]
      );
    } else {
      // Wait for page to stabilize even without returning HTML
      logger.info('Waiting for page stability after typing (fast mode)...');
      await waitForPageStability(page);
      
      // Wait for SPAs to render dynamic content after typing
      if (postTypeWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postTypeWait));
      }
      
      const currentUrl = page.url();
      
      logger.info(`type_text completed: typed into ${selector} (no HTML)`);
      
      return new TypeTextSuccessResponse(
        currentUrl,
        `Typed text into: ${selector}`,
        null,
        [
          "Use MCPBrowser's get_current_html to see updated page state",
          "Use MCPBrowser's type_text for additional fields or MCPBrowser's click_element to submit",
          "Use MCPBrowser's close_tab when finished"
        ]
      );
    }
  } catch (err) {
    logger.error(`type_text failed: ${err.message}`);
    return new ErrorResponse(
      `Failed to type text: ${err.message}`,
      [
        "Use MCPBrowser's get_current_html to verify page state",
        "Check if the selector is correct",
        "Verify the input field is visible and enabled"
      ]
    );
  }
}
