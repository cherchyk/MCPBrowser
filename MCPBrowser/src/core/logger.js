/**
 * Logger - Emits to stderr and, when available, via MCP logging notifications.
 * Stderr stays the primary sink to avoid interfering with MCP stdout traffic.
 */

const PREFIX = '[MCPBrowser]';

// Optional MCP server reference for notifications/message logs.
let mcpServer = null;

// Optional stdout mirroring (off by default to avoid corrupting MCP stdout).
// Auto-enable during tests so test runners capture output.
let consoleOutputEnabled = process.env.NODE_ENV === 'test';
const envStdout = process.env.MCPBROWSER_LOG_TO_STDOUT;
if (envStdout && ['1', 'true', 'yes', 'on'].includes(envStdout.toLowerCase())) {
  consoleOutputEnabled = true;
}

/**
 * Attach the MCP server so logs can flow to the agent via notifications/message.
 * @param {import('@modelcontextprotocol/sdk/dist/esm/server/index.js').Server} server
 */
function attachServer(server) {
  mcpServer = server;
}

/**
 * Enable/disable stdout mirroring. Avoid enabling when running under MCP stdio transport unless the client tolerates extra stdout noise.
 * @param {boolean} enabled
 */
function setConsoleOutput(enabled = true) {
  consoleOutputEnabled = !!enabled;
}

async function notifyAgent(level, data) {
  if (!mcpServer?.sendLoggingMessage) return;
  try {
    // Skip if client requested a higher threshold.
    if (mcpServer.isMessageIgnored?.(level)) return;
    await mcpServer.sendLoggingMessage({ level, logger: 'mcpbrowser', data });
  } catch {
    // Silently drop — this is expected during startup before the MCP
    // transport handshake completes. Stderr already has the message.
  }
}

function emit(level, message, symbol = '') {
  const line = symbol ? `${PREFIX} ${symbol} ${message}` : `${PREFIX} ${message}`;
  console.error(line);
  if (consoleOutputEnabled) {
    console.log(line);
  }
  void notifyAgent(level, message);
}

function info(message) {
  emit('info', message);
}

function warn(message) {
  emit('warning', message, '⚠️');
}

function error(message) {
  emit('error', message, '❌');
}

function debug(message) {
  emit('debug', message, '🔍');
}

export const logger = { info, warn, error, debug, attachServer, setConsoleOutput };
export { attachServer, setConsoleOutput };
export default logger;
