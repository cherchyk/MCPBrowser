#!/usr/bin/env node
/**
 * MCP Browser Server - Main Entry Point
 * A Model Context Protocol server that provides browser automation capabilities
 * with support for authentication flows, tab reuse, and interactive actions.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from 'url';

// Import core functionality
import { fetchPage } from './actions/fetch-page.js';
import { clickElement } from './actions/click-element.js';
import { typeText } from './actions/type-text.js';
import { closeTab } from './actions/close-tab.js';
import { getCurrentHtml } from './actions/get-current-html.js';

// Import functions for testing exports
import { getBrowser, closeBrowser } from './core/browser.js';
import { getOrCreatePage, navigateToUrl, extractAndProcessHtml, waitForPageStability } from './core/page.js';
import { detectRedirectType, waitForAutoAuth, waitForManualAuth } from './core/auth.js';
import { cleanHtml, enrichHtml, prepareHtml } from './core/html.js';
import { getBaseDomain, isLikelyAuthUrl } from './utils.js';

/**
 * Main entry point for the MCP server.
 * Sets up the Model Context Protocol server with all available tools,
 * configures request handlers, and starts the stdio transport.
 * @returns {Promise<void>}
 */
async function main() {
  const server = new Server({ name: "MCPBrowser", version: "0.2.26" }, { capabilities: { tools: {} } });

  const tools = [
    {
      name: "fetch_webpage",
      description: "Fetches web pages using Chrome/Edge browser. Handles auth-required pages, CAPTCHA, SSO, anti-bot protection, and JavaScript-heavy sites.\n\nWaits for user interaction (login, CAPTCHA) if needed, then returns content automatically.\n\nIMPORTANT: Call ONE URL at a time only. Never parallel - causes conflicts. Wait for completion before next URL.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
          removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%.", default: true },
          postLoadWait: { type: "number", description: "Milliseconds to wait after page load for SPAs to render dynamic content.", default: 1000 }
        },
        required: ["url"],
        additionalProperties: false,
      },
      annotations: {
        title: "Fetch Web Page"
      }
    },
    {
      name: "click_element",
      description: "Clicks on an element on the page. Works with any clickable element including buttons, links, or elements with onclick handlers. Can target by CSS selector or text content. Waits for page stability and returns updated HTML by default. The page must be already loaded via fetch_webpage first.",
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
      annotations: {
        title: "Click Element"
      }
    },
    {
      name: "type_text",
      description: "Types text into an input field, textarea, or other editable element. The page must be already loaded via fetch_webpage first.",
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
        additionalProperties: false,
      },
      annotations: {
        title: "Type Text"
      }
    },
    {
      name: "close_tab",
      description: "Closes the browser tab for the given URL's hostname. This removes the page from the tab pool and forces a fresh session on the next visit to that hostname. Useful for memory management or when you need to clear session state. Note: Uses exact hostname match (www.example.com and example.com are treated as different tabs).",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL whose hostname tab should be closed" }
        },
        required: ["url"],
        additionalProperties: false,
      },
      annotations: {
        title: "Close Tab"
      }
    },
    {
      name: "get_current_html",
      description: "Gets the current HTML from an already-loaded page WITHOUT navigating/reloading. Use this after interactions (click, type, wait) to get the updated DOM state efficiently. Much faster than fetch_webpage since it only extracts HTML from the current page state.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
          removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%.", default: true }
        },
        required: ["url"],
        additionalProperties: false,
      },
      annotations: {
        title: "Get Current HTML"
      }
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const safeArgs = args || {};
    
    let result;
    
    switch (name) {
      case "fetch_webpage":
        const fallbackUrl = process.env.DEFAULT_FETCH_URL || process.env.MCP_DEFAULT_FETCH_URL;
        if (!safeArgs.url) {
          if (fallbackUrl) {
            safeArgs.url = fallbackUrl;
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ success: false, error: "Missing url and no DEFAULT_FETCH_URL/MCP_DEFAULT_FETCH_URL configured" }),
                },
              ],
            };
          }
        }
        result = await fetchPage(safeArgs);
        break;
        
      case "click_element":
        result = await clickElement(safeArgs);
        break;
        
      case "type_text":
        result = await typeText(safeArgs);
        break;
        
      case "close_tab":
        result = await closeTab(safeArgs);
        break;
        
      case "get_current_html":
        result = await getCurrentHtml(safeArgs);
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Export for testing
export { 
  fetchPage, 
  getBrowser,
  closeBrowser,
  prepareHtml, 
  cleanHtml, 
  enrichHtml,
  getOrCreatePage,
  navigateToUrl,
  detectRedirectType,
  waitForAutoAuth,
  waitForManualAuth,
  waitForPageStability,
  extractAndProcessHtml,
  getBaseDomain,
  isLikelyAuthUrl,
  clickElement,
  typeText,
  closeTab,
  getCurrentHtml
};

// Run the MCP server only if this is the main module (not imported for testing)
if (import.meta.url === new URL(process.argv[1], 'file://').href || 
    fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
