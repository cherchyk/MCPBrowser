/**
 * Logger - Simple logging for MCPBrowser
 * 
 * All output goes to stderr so it doesn't interfere with MCP protocol on stdout.
 */

const PREFIX = '[MCPBrowser]';

/**
 * Log an info message
 * @param {string} message - The message to log
 */
function info(message) {
  console.error(`${PREFIX} ${message}`);
}

/**
 * Log an error message
 * @param {string} message - The message to log
 */
function error(message) {
  console.error(`${PREFIX} ❌ ${message}`);
}

export const logger = { info, error };
export default logger;
