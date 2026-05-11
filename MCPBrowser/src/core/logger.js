/**
 * Logger - Emits to stderr and, when available, via MCP logging notifications.
 * Also sends MCP progress notifications (notifications/progress) when a
 * progressToken is active, so agents see real-time status during tool execution.
 * Stderr stays the primary sink to avoid interfering with MCP stdout traffic.
 */

const PREFIX = '[MCPBrowser]';

// Optional MCP server reference for notifications/message logs.
let mcpServer = null;

// MCP progress tracking — set per-request by the request handler.
let _progressToken = null;
let _progressStep = 0;

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

/**
 * Set the MCP progress token for the current request.
 * While set, every logger.info() call also sends a notifications/progress
 * message so the agent sees real-time status during tool execution.
 * @param {string|number|null|undefined} token - progressToken from request._meta
 */
function setProgressToken(token) {
  _progressToken = token ?? null;
  _progressStep = 0;
}

/**
 * Clear the progress token after the request completes.
 */
function clearProgressToken() {
  _progressToken = null;
  _progressStep = 0;
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

/**
 * Send an MCP progress notification if a progressToken is active.
 * Called automatically from info-level log messages.
 * @param {string} message - Human-readable progress message
 */
async function sendProgress(message) {
  if (!_progressToken || !mcpServer) return;
  _progressStep++;
  try {
    await mcpServer.notification({
      method: 'notifications/progress',
      params: {
        progressToken: _progressToken,
        progress: _progressStep,
        message
      }
    });
  } catch {
    // Fire and forget — don't break the action if progress fails
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
  // Also send as MCP progress notification when token is active
  void sendProgress(message);
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

export const logger = { info, warn, error, debug, attachServer, setConsoleOutput, setProgressToken, clearProgressToken };
export { attachServer, setConsoleOutput, setProgressToken, clearProgressToken };
export default logger;
