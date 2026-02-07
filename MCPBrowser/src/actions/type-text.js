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
  description: "**BROWSER INTERACTION** - Types text into multiple input fields on browser-loaded pages in a single call. Use this for filling forms, entering search queries, or any text input on the page.\n\nWorks with input fields, textareas, and other editable elements. Supports filling multiple fields at once for efficient form filling.\n\n**PREREQUISITE**: Page MUST be loaded with fetch_webpage first. This tool operates on an already-loaded page in the browser.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
      fields: {
        type: "array",
        description: "Array of fields to fill. Each field specifies a selector and text to type.",
        items: {
          type: "object",
          properties: {
            selector: { type: "string", description: "CSS selector for the input element (e.g., '#username', 'input[name=\"email\"]')" },
            text: { type: "string", description: "Text to type into the field" },
            clear: { type: "boolean", description: "Whether to clear existing text first", default: true },
            waitForElementTimeout: { type: "number", description: "Maximum time to wait for element in milliseconds", default: 5000 }
          },
          required: ["selector", "text"],
          additionalProperties: false
        },
        minItems: 1
      },
      returnHtml: { type: "boolean", description: "Whether to wait for stability and return HTML after typing.", default: true },
      removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%. Only used when returnHtml is true.", default: true },
      postTypeWait: { type: "number", description: "Milliseconds to wait after typing for SPAs to render dynamic content.", default: 1000 }
    },
    required: ["url", "fields"],
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
// CONSTANTS
// ============================================================================

/** Hardcoded delay between keystrokes in milliseconds */
const TYPE_DELAY_MS = 10;

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Type text into multiple input fields
 * @param {Object} params - Type parameters
 * @param {string} params.url - The URL of the page to interact with
 * @param {Array<{selector: string, text: string, clear?: boolean, waitForElementTimeout?: number}>} params.fields - Array of fields to fill
 * @param {boolean} [params.returnHtml=true] - Whether to wait for stability and return HTML
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML (only if returnHtml is true)
 * @param {number} [params.postTypeWait=1000] - Milliseconds to wait after typing for SPAs to render dynamic content
 * @returns {Promise<Object>} Result object with success status and details
 */
export async function typeText({ url, fields, returnHtml = true, removeUnnecessaryHTML = true, postTypeWait = 1000 }) {
  const startTime = Date.now();
  logger.info(`type_text called: ${fields?.length || 0} fields, url=${url}`);
  
  if (!url) {
    throw new Error("url parameter is required");
  }
  
  if (!fields || !Array.isArray(fields) || fields.length === 0) {
    throw new Error("fields parameter is required and must be a non-empty array");
  }
  
  // Validate each field
  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    if (!field.selector) {
      throw new Error(`fields[${i}].selector is required`);
    }
    if (field.text === undefined || field.text === null) {
      throw new Error(`fields[${i}].text is required`);
    }
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

  const filledSelectors = [];
  let currentFieldIndex = 0;
  let currentSelector = null;
  
  try {
    // Type into each field sequentially
    for (const field of fields) {
      const { selector, text, clear = true, waitForElementTimeout = 5000 } = field;
      currentSelector = selector;
      
      await page.waitForSelector(selector, { timeout: waitForElementTimeout, visible: true });
      
      if (clear) {
        await page.click(selector, { clickCount: 3 }); // Select all text
        await page.keyboard.press('Backspace');
      }
      
      logger.info(`Typing into: ${selector}`);
      await page.type(selector, String(text), { delay: TYPE_DELAY_MS });
      filledSelectors.push(selector);
      currentFieldIndex++;
    }
    
    const fieldsSummary = filledSelectors.length === 1 
      ? filledSelectors[0] 
      : `${filledSelectors.length} fields (${filledSelectors.join(', ')})`;
    
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
      
      logger.info(`type_text completed: typed into ${fieldsSummary}`);
      
      return new TypeTextSuccessResponse(
        currentUrl,
        `Typed text into: ${fieldsSummary}`,
        html,
        [
          "Use MCPBrowser's type_text to fill additional fields",
          "Use MCPBrowser's click_element to submit the form or navigate",
          "Use MCPBrowser's get_current_html to check for validation messages",
          "Use MCPBrowser's take_screenshot if form has visual feedback or validation that's hard to parse from HTML",
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
      
      logger.info(`type_text completed: typed into ${fieldsSummary} (no HTML)`);
      
      return new TypeTextSuccessResponse(
        currentUrl,
        `Typed text into: ${fieldsSummary}`,
        null,
        [
          "Use MCPBrowser's get_current_html to see updated page state",
          "Use MCPBrowser's take_screenshot if the page has visual feedback that's hard to parse",
          "Use MCPBrowser's type_text for additional fields or MCPBrowser's click_element to submit",
          "Use MCPBrowser's close_tab when finished"
        ]
      );
    }
  } catch (err) {
    // Build informative error message for agent
    const totalFields = fields.length;
    const failedFieldNum = currentFieldIndex + 1;
    const errorMsg = err.message;
    
    // Determine error type for better guidance
    const isNotFound = errorMsg.includes('Waiting for selector') || errorMsg.includes('failed: Waiting failed');
    const isNotVisible = errorMsg.includes('not visible') || errorMsg.includes('hidden');
    const isDetached = errorMsg.includes('detached') || errorMsg.includes('Node is detached');
    
    let reason;
    let nextSteps;
    
    if (isNotFound) {
      reason = `Selector not found: "${currentSelector}". The element may not exist on the page or have a different selector.`;
      nextSteps = [
        "Use MCPBrowser's get_current_html to find the correct selector",
        "Use MCPBrowser's take_screenshot to visually inspect the form",
        "Check for typos in the selector or try a simpler selector (e.g., 'input[type=\"text\"]')",
        "The element may load dynamically - try increasing waitForElementTimeout"
      ];
    } else if (isNotVisible) {
      reason = `Element "${currentSelector}" exists but is not visible. It may be hidden, collapsed, or off-screen.`;
      nextSteps = [
        "Use MCPBrowser's take_screenshot to see the page state",
        "Use MCPBrowser's click_element to expand/show the form section first",
        "Use MCPBrowser's scroll_page to bring the element into view"
      ];
    } else if (isDetached) {
      reason = `Element "${currentSelector}" was removed from the page during interaction. The page may have reloaded or updated.`;
      nextSteps = [
        "Use MCPBrowser's get_current_html to check current page state",
        "Retry the type_text call - the page may have stabilized"
      ];
    } else {
      reason = `Failed to interact with "${currentSelector}": ${errorMsg}`;
      nextSteps = [
        "Use MCPBrowser's get_current_html to verify page state",
        "Use MCPBrowser's take_screenshot to see what's on the page visually",
        "The element may be disabled or read-only"
      ];
    }
    
    // Build progress summary
    let progressInfo;
    if (filledSelectors.length === 0) {
      progressInfo = `Failed on field 1 of ${totalFields}. No fields were filled.`;
    } else {
      progressInfo = `Failed on field ${failedFieldNum} of ${totalFields}. Successfully filled ${filledSelectors.length} field(s): ${filledSelectors.join(', ')}. Do NOT re-type these fields.`;
    }
    
    logger.error(`type_text failed on field ${failedFieldNum}/${totalFields} (${currentSelector}): ${errorMsg}`);
    
    return new InformationalResponse(
      `${progressInfo}`,
      reason,
      nextSteps
    );
  }
}
