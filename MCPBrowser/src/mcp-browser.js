#!/usr/bin/env node
/**
 * MCPBrowser Server - Main Entry Point
 * A Model Context Protocol server that provides browser automation capabilities
 * with support for authentication flows, tab reuse, and interactive actions.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

// Import CLI mode
import { isCliMode, runCli } from './cli/index.js';

// Import response classes
import { ErrorResponse } from './core/responses.js';
import logger, { attachServer as attachLoggerServer } from './core/logger.js';

import { ACTIONS as ALL_CORE_ACTIONS } from './actions/index.js';

// Import prompt definitions
import { PROMPTS, getPromptMessages } from './core/prompts.js';

// Import plugin system
import { loadPlugins, getLoadedPlugins } from './core/plugin-loader.js';

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
    {
      name: 'MCPBrowser',
      version: packageJson.version,
      title: 'MCP Browser',
      description: packageJson.description,
      websiteUrl: packageJson.homepage,
    },
    {
      capabilities: { tools: {}, logging: {}, prompts: {} },
      instructions:
        "Browser automation server using the user's existing browser session (cookies and auth intact). Workflow: browser_fetch_webpage → browser_take_screenshot (visual content) or browser_get_current_html (re-read after interaction) → browser_click_element / browser_type_text (interact) → browser_close_tab (cleanup). All tools except browser_fetch_webpage and browser_plugin_info require a page loaded first. One tab per domain — same-domain navigations reuse the existing tab. Requests are queued and processed sequentially. Maximum one browser connection at a time. Pages loaded via browser_fetch_webpage persist until browser_close_tab is called or the server shuts down. Screenshots return base64 PNG — prefer browser_get_current_html for text extraction. browser_execute_javascript runs in the page context with access to the full DOM and JavaScript APIs. If plugins are loaded, browser_plugin_info provides site-specific optimized actions for known sites. If authentication is required, the user must complete login in the browser window, then retry the same URL.",
    },
  );

  // Capture the negotiated MCP protocol version so the ListTools handler can
  // strip fields that older clients cannot parse (outputSchema, annotations,
  // title were added in MCP protocol 2025-03-26).
  let negotiatedProtocolVersion = null;
  const _origOnInitialize = server._oninitialize.bind(server);
  server._oninitialize = async function (request) {
    const result = await _origOnInitialize(request);
    negotiatedProtocolVersion = result.protocolVersion;
    return result;
  };

  // Wire server to logger so logs flow to agent via notifications/message.
  attachLoggerServer(server);

  // Load plugins before assembling tools so we only expose plugin tools when plugins are enabled
  const pluginCount = await loadPlugins();
  if (pluginCount > 0) {
    logger.info(`${pluginCount} plugin(s) loaded and ready`);
  }

  // Assemble tools from action imports
  // Only include plugin tools when plugins are actually enabled, with descriptions referencing loaded plugin names
  const pluginActionNames = new Set(['browser_plugin_info', 'browser_plugin_action']);
  const pluginActions =
    pluginCount > 0 ? ALL_CORE_ACTIONS.filter((action) => pluginActionNames.has(action.id)) : [];
  let pluginNameList = '';
  if (pluginCount > 0) {
    const pluginNames = [...getLoadedPlugins().keys()];
    pluginNameList = pluginNames.join(', ');
  }
  const coreActions = ALL_CORE_ACTIONS.filter(
    (action) => action.id !== 'accept_eula' && !pluginActionNames.has(action.id),
  );
  const actions = [...coreActions, ...pluginActions];
  const actionByName = new Map(actions.map((action) => [action.tool.name, action]));
  const tools = actions.map((action) => {
    if (!pluginActions.includes(action)) return action.tool;
    return {
      ...action.tool,
      description: `${action.tool.description} Enabled plugins: ${pluginNameList}.`,
    };
  });

  // Tool icon (SEP-973, MCP 2025-11-25): a single browser glyph shared by all
  // tools, advertised only to clients on protocol 2025-11-25 or newer.
  const TOOL_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#4A90D9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
  const TOOL_ICONS = [
    {
      src: `data:image/svg+xml;base64,${Buffer.from(TOOL_ICON_SVG).toString('base64')}`,
      mimeType: 'image/svg+xml',
      sizes: ['any'],
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const version = negotiatedProtocolVersion;
    // outputSchema, annotations, and title require MCP protocol 2025-03-26+.
    // Strip them for clients that negotiated an older version (e.g. Antigravity/Gemini).
    if (!version || version < '2025-03-26') {
      return {
        tools: tools.map(({ outputSchema, annotations, title, ...core }) => core),
      };
    }
    // Tool icons (SEP-973) require MCP protocol 2025-11-25+.
    if (version < '2025-11-25') {
      return { tools };
    }
    return { tools: tools.map((t) => ({ ...t, icons: TOOL_ICONS })) };
  });

  // --- Prompts handlers ---
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: PROMPTS }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return getPromptMessages(name, args);
  });

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

      const action = actionByName.get(name);
      if (!action) {
        throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${name}`);
      }
      result = await action.execute(safeArgs);
    } catch (error) {
      // Protocol errors (e.g. unknown tool) must propagate as JSON-RPC errors
      // per the MCP spec, not be converted into tool execution results.
      if (error instanceof McpError) throw error;

      // Log the actual error for debugging
      logger.error(`Tool ${name} failed: ${error.message}`);
      logger.error(`Stack: ${error.stack}`);

      // Return a proper error response instead of throwing
      return new ErrorResponse(`${name} failed: ${error.message}`, [
        'Check browser is installed',
        'Try specifying browser parameter explicitly (chrome, edge, or brave)',
        'Check MCP server logs for details',
      ]).toMcpFormat();
    } finally {
      logger.clearProgressToken();
    }

    // Transform result into MCP-compliant response using instance method
    return result.toMcpFormat();
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`MCPBrowser server v${packageJson.version} started`);
}

// Run the MCP server only when this module is executed directly
if (
  import.meta.url === new URL(process.argv[1], 'file://').href ||
  fileURLToPath(import.meta.url) === process.argv[1]
) {
  const argv = process.argv.slice(2);
  if (isCliMode(argv)) {
    // CLI mode: run command and exit
    runCli(argv)
      .then((code) => {
        process.exit(code);
      })
      .catch((err) => {
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
