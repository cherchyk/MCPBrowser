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

// Import CLI mode
import { isCliMode, runCli } from './cli/index.js';

// Import response classes
import { ErrorResponse } from './core/responses.js';
import logger, { attachServer as attachLoggerServer } from './core/logger.js';

// Import EULA functionality
import { handleAcceptEula, ACCEPT_EULA_TOOL, requireEulaAcceptance } from './actions/accept-eula.js';

// Import core functionality
import { fetchPage, FETCH_WEBPAGE_TOOL } from './actions/fetch-page.js';
import { clickElement, CLICK_ELEMENT_TOOL } from './actions/click-element.js';
import { typeText, TYPE_TEXT_TOOL } from './actions/type-text.js';
import { closeTab, CLOSE_TAB_TOOL } from './actions/close-tab.js';
import { getCurrentHtml, GET_CURRENT_HTML_TOOL } from './actions/get-current-html.js';
import { takeScreenshot, TAKE_SCREENSHOT_TOOL } from './actions/take-screenshot.js';
import { scrollPage, SCROLL_PAGE_TOOL } from './actions/scroll-page.js';
import { executeJavascript, EXECUTE_JAVASCRIPT_TOOL } from './actions/execute-javascript.js';
import { navigateHistory, NAVIGATE_HISTORY_TOOL } from './actions/navigate-history.js';
import { detectForms, DETECT_FORMS_TOOL } from './actions/detect-forms.js';

// Import plugin dispatch tools
import { pluginAction, PLUGIN_ACTION_TOOL } from './actions/plugin-action.js';
import { pluginInfo, PLUGIN_INFO_TOOL } from './actions/plugin-info.js';

// Import functions for testing exports
import { getBrowser, closeBrowser } from './core/browser.js';
import { getOrCreatePage, queueRequest, navigateToUrl, waitForPageReady, extractAndProcessHtml } from './core/page.js';
import { isLikelyAuthUrl, waitForAuth, pollUntilAuthDone, detectLoginPage } from './core/auth.js';
import { cleanHtml, enrichHtml, prepareHtml } from './core/html.js';
import { getBaseDomain } from './utils.js';

// Import plugin system
import { loadPlugins, getLoadedPlugins, getPlugin, detectPlugins, getPluginNextSteps } from './core/plugin-loader.js';

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
  
  const server = new Server(
    { name: "MCPBrowser", version: packageJson.version },
    { capabilities: { tools: {}, logging: {} } }
  );

  // Wire server to logger so logs flow to agent via notifications/message.
  attachLoggerServer(server);

  // Assemble tools from action imports
  // ACCEPT_EULA_TOOL must be first - it's required before using other tools
  const tools = [
    // ACCEPT_EULA_TOOL,
    FETCH_WEBPAGE_TOOL,
    EXECUTE_JAVASCRIPT_TOOL,
    CLICK_ELEMENT_TOOL,
    TYPE_TEXT_TOOL,
    CLOSE_TAB_TOOL,
    GET_CURRENT_HTML_TOOL,
    TAKE_SCREENSHOT_TOOL,
    SCROLL_PAGE_TOOL,
    NAVIGATE_HISTORY_TOOL,
    DETECT_FORMS_TOOL,
    PLUGIN_INFO_TOOL,
    PLUGIN_ACTION_TOOL
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    const safeArgs = args || {};
    
    // Enable MCP progress notifications for this request if the client sent a progressToken.
    // Every logger.info() call during tool execution will automatically send a
    // notifications/progress message so the agent sees real-time status updates.
    const progressToken = extra?._meta?.progressToken;
    logger.setProgressToken(progressToken);
    
    let result;
    
    try {
      // EULA check - accept_eula is always allowed, other tools require EULA acceptance
      // if (name !== "accept_eula") {
      //   const eulaResponse = requireEulaAcceptance(name);
      //   if (eulaResponse) return eulaResponse;
      // }
      
      switch (name) {
        // case "accept_eula":
        //   result = await handleAcceptEula(safeArgs);
        //   break;
          
        case "browser_fetch_webpage":
          result = await fetchPage(safeArgs);
          break;

        case "browser_execute_javascript":
          result = await executeJavascript(safeArgs);
          break;
          
        case "browser_click_element":
          result = await clickElement(safeArgs);
          break;
          
        case "browser_type_text":
          result = await typeText(safeArgs);
          break;
          
        case "browser_close_tab":
          result = await closeTab(safeArgs);
          break;
          
        case "browser_get_current_html":
          result = await getCurrentHtml(safeArgs);
          break;
          
        case "browser_take_screenshot":
          result = await takeScreenshot(safeArgs);
          break;
          
        case "browser_scroll_page":
          result = await scrollPage(safeArgs);
          break;

        case "browser_navigate_history":
          result = await navigateHistory(safeArgs);
          break;

        case "browser_detect_forms":
          result = await detectForms(safeArgs);
          break;

        case "browser_plugin_info":
          result = pluginInfo(safeArgs);
          break;

        case "browser_plugin_action":
          result = await pluginAction(safeArgs);
          break;
          
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      // Log the actual error for debugging
      logger.error(`Tool ${name} failed: ${error.message}`);
      logger.error(`Stack: ${error.stack}`);
      
      // Return a proper error response instead of throwing
      return new ErrorResponse(
        `${name} failed: ${error.message}`,
        ['Check browser is installed', 'Try specifying browser parameter explicitly (chrome, edge, or brave)', 'Check MCP server logs for details']
      ).toMcpFormat();
    } finally {
      logger.clearProgressToken();
    }
    
    // Transform result into MCP-compliant response using instance method
    return result.toMcpFormat();
  });

  const transport = new StdioServerTransport();
  
  // Load plugins before starting the server
  const pluginCount = await loadPlugins();
  if (pluginCount > 0) {
    logger.info(`${pluginCount} plugin(s) loaded and ready`);
  }
  
  await server.connect(transport);
  logger.info(`MCPBrowser server v${packageJson.version} started`);
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
  queueRequest,
  navigateToUrl,
  waitForPageReady,
  waitForAuth,
  pollUntilAuthDone,
  detectLoginPage,
  extractAndProcessHtml,
  getBaseDomain,
  isLikelyAuthUrl,
  executeJavascript,
  clickElement,
  typeText,
  closeTab,
  getCurrentHtml,
  takeScreenshot,
  scrollPage,
  navigateHistory,
  detectForms,
  handleAcceptEula,
  // CLI exports
  isCliMode,
  runCli,
  // Plugin system exports
  loadPlugins,
  getLoadedPlugins,
  getPlugin,
  detectPlugins,
  getPluginNextSteps,
  pluginAction,
  pluginInfo
};

// Run the MCP server only if this is the main module (not imported for testing)
if (import.meta.url === new URL(process.argv[1], 'file://').href || 
    fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2);
  if (isCliMode(argv)) {
    // CLI mode: run command and exit
    runCli(argv).then((code) => {
      process.exit(code);
    }).catch((err) => {
      process.stderr.write(`Error: ${err.message}\n`);
      process.exit(1);
    });
  } else {
    // MCP server mode (default): stdin/stdout JSON-RPC
    main().catch((err) => {
      logger.error(`Server failed: ${err.message}`);
      process.exit(1);
    });
  }
}
