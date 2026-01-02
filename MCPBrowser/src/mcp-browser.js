#!/usr/bin/env node
/**
 * MCPBrowser Server - Main Entry Point
 * A Model Context Protocol server that provides browser automation capabilities
 * with support for authentication flows, tab reuse, and interactive actions.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

// Import response classes
import { ErrorResponse } from './core/responses.js';

// Import core functionality
import { fetchPage, FETCH_WEBPAGE_TOOL } from './actions/fetch-page.js';
import { clickElement, CLICK_ELEMENT_TOOL } from './actions/click-element.js';
import { typeText, TYPE_TEXT_TOOL } from './actions/type-text.js';
import { closeTab, CLOSE_TAB_TOOL } from './actions/close-tab.js';
import { getCurrentHtml, GET_CURRENT_HTML_TOOL } from './actions/get-current-html.js';

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
  // Read version from package.json dynamically
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  
  const server = new Server({ name: "MCPBrowser", version: packageJson.version }, { capabilities: { tools: {} } });

  // Assemble tools from action imports
  const tools = [
    FETCH_WEBPAGE_TOOL,
    CLICK_ELEMENT_TOOL,
    TYPE_TEXT_TOOL,
    CLOSE_TAB_TOOL,
    GET_CURRENT_HTML_TOOL
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const safeArgs = args || {};
    
    let result;
    
    switch (name) {
      case "fetch_webpage":
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
    
    // Transform result into MCP-compliant response using instance method
    return result.toMcpFormat();
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
