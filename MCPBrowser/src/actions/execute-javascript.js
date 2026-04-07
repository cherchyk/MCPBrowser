/**
 * execute-javascript.js - Run arbitrary JavaScript in the current page context
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { waitForPageReady } from '../core/page.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';
import { serializeExecutionResult } from '../utils.js';
import { getPluginNextSteps, getRecommendedPlugins } from '../core/plugin-loader.js';

// Shared execution defaults for script actions
export const EXECUTION_TIMEOUT_DEFAULT_MS = 30_000;
export const EXECUTION_TIMEOUT_MAX_MS = 60_000;
export const EXECUTION_RESULT_MAX_BYTES = 100_000;

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

/**
 * Structured response for execute_javascript action
 */
export class ExecuteJavascriptResponse extends MCPResponse {
  constructor({ result, type, executionTimeMs, truncated = false, urlChanged = false, currentUrl = '', error = null, nextSteps = [], recommendedPlugins = [] }) {
    super(nextSteps);

    this.result = result;
    this.type = type;
    this.executionTimeMs = executionTimeMs;
    this.truncated = truncated;
    this.urlChanged = urlChanged;
    this.currentUrl = currentUrl;
    this.error = error;
    this.recommendedPlugins = recommendedPlugins;
  }

  _getAdditionalFields() {
    return {
      result: this.result,
      type: this.type,
      executionTimeMs: this.executionTimeMs,
      truncated: this.truncated,
      urlChanged: this.urlChanged,
      currentUrl: this.currentUrl,
      error: this.error || undefined,
      recommendedPlugins: this.recommendedPlugins
    };
  }

  getTextSummary() {
    const outcome = this.error ? `Script error: ${this.error.message || 'Unknown error'}` : 'Script executed';
    const timing = typeof this.executionTimeMs === 'number' ? ` in ${this.executionTimeMs}ms` : '';
    const nav = this.urlChanged ? ' (navigation detected)' : '';
    return `${outcome}${timing}${nav}`;
  }
}

export const EXECUTE_JAVASCRIPT_TOOL = {
  name: 'execute_javascript',
  title: 'Execute JavaScript',
  description: '**BROWSER INTERACTION** - Executes a JavaScript snippet in the active page and returns the result with metadata (execution time, truncation, navigation detection). Use for structured extraction or UI actions that are unreliable via protocol clicks.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL of the page (must match a previously fetched page)' },
      script: { type: 'string', description: 'JavaScript source code to execute in page context' },
      timeoutMs: { type: 'number', description: 'Maximum execution time in milliseconds', default: EXECUTION_TIMEOUT_DEFAULT_MS },
      returnType: { type: 'string', description: "How to interpret the result: 'json' | 'text' | 'void'", enum: ['json', 'text', 'void'], default: 'json' }
    },
    required: ['url', 'script'],
    additionalProperties: false
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: { description: 'Serialized result of the script', nullable: true },
      type: { type: 'string', description: 'Type of the returned result' },
      executionTimeMs: { type: 'number', description: 'Script execution duration' },
      truncated: { type: 'boolean', description: 'True if result was capped to size limit' },
      urlChanged: { type: 'boolean', description: 'True if page URL changed during execution' },
      currentUrl: { type: 'string', description: 'URL after execution' },
      nextSteps: { type: 'array', items: { type: 'string' } },
      error: { type: ['object', 'null'], description: 'Error object when script throws or times out' }
    },
    required: ['type', 'executionTimeMs', 'truncated', 'urlChanged', 'currentUrl', 'nextSteps'],
    additionalProperties: false
  }
};

function clampTimeout(timeoutMs) {
  const numeric = typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) ? timeoutMs : EXECUTION_TIMEOUT_DEFAULT_MS;
  return Math.min(Math.max(numeric, 1), EXECUTION_TIMEOUT_MAX_MS);
}

function buildErrorResponse(message, reason, nextSteps) {
  return new InformationalResponse(message, reason, nextSteps);
}

export async function executeJavascript({ url, script, timeoutMs = EXECUTION_TIMEOUT_DEFAULT_MS, returnType = 'json' }) {
  logger.info(`execute_javascript called: ${url}`);

  if (!url) throw new Error('url parameter is required');
  if (!script || typeof script !== 'string' || !script.trim()) throw new Error('script parameter is required');

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  try {
    await getBrowser();
  } catch (err) {
    logger.error(`execute_javascript: Failed to connect to browser: ${err.message}`);
    return buildErrorResponse(
      `Browser connection failed: ${err.message}`,
      'The browser must be running with remote debugging enabled.',
      [
        'Ensure the browser is installed and running',
        'Check that remote debugging is enabled (--remote-debugging-port)',
        'Try restarting the MCP server'
      ]
    );
  }

  const { page, error: pageError } = await getValidatedPage(hostname);
  if (!page) {
    const isConnectionLost = pageError && pageError.includes('connection');
    logger.debug(`execute_javascript: ${pageError || 'No page found for ' + hostname}`);
    return buildErrorResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can run scripts on it.',
      [
        "Use MCPBrowser's fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's execute_javascript with the same URL"
      ]
    );
  }

  const effectiveTimeout = clampTimeout(timeoutMs);
  const beforeUrl = page.url();
  const start = Date.now();

  const evalPromise = page.evaluate(async ({ userScript, mode }) => {
    const wrap = async () => {
      const fn = new Function(`return (async () => { ${userScript} })();`);
      return await fn();
    };

    try {
      const value = await wrap();
      const isDom = typeof Element !== 'undefined' && value instanceof Element;
      if (mode === 'void') {
        return { value: null, type: 'void' };
      }
      if (mode === 'text') {
        return { value: String(value), type: 'string' };
      }
      if (isDom) {
        return { value: value.outerHTML, type: 'dom-html' };
      }
      const valueType = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);
      return { value, type: valueType };
    } catch (error) {
      return { error: { name: error?.name || 'Error', message: error?.message || 'Script error', stack: error?.stack || '' } };
    }
  }, { userScript: script, mode: returnType });

  let evalResult;
  try {
    evalResult = await Promise.race([
      evalPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Execution timed out after ${effectiveTimeout}ms`)), effectiveTimeout))
    ]);
  } catch (err) {
    const executionTimeMs = Date.now() - start;
    let currentUrl = page.url();
    try {
      currentUrl = await page.evaluate(() => location.href);
    } catch {
      // ignore evaluation failures when the page is gone
    }
    return new ExecuteJavascriptResponse({
      result: null,
      type: 'error',
      executionTimeMs,
      truncated: false,
      urlChanged: currentUrl !== beforeUrl,
      currentUrl,
      error: { name: 'TimeoutError', message: err.message }
    });
  }

  const executionTimeMs = Date.now() - start;
  let currentUrl = page.url();
  try {
    currentUrl = await page.evaluate(() => location.href);
  } catch {
    // If we can't read location (e.g., cross-origin), fall back to page.url()
  }
  const urlChanged = currentUrl !== beforeUrl;

  if (evalResult?.error) {
    return new ExecuteJavascriptResponse({
      result: null,
      type: 'error',
      executionTimeMs,
      truncated: false,
      urlChanged,
      currentUrl,
      error: evalResult.error
    });
  }

  const serialization = serializeExecutionResult(evalResult?.value, { maxBytes: EXECUTION_RESULT_MAX_BYTES });

  return new ExecuteJavascriptResponse({
    result: serialization.result,
    type: evalResult?.type || serialization.type,
    executionTimeMs,
    truncated: serialization.truncated,
    urlChanged,
    currentUrl,
    nextSteps: [
      ...getPluginNextSteps(currentUrl, ''),
      'Use click_element or type_text for follow-up actions',
      'Inspect urlChanged to decide if navigation occurred',
      serialization.truncated ? 'Narrow your selector or reduce returned fields to avoid truncation' : 'Proceed with the returned data'
    ],
    recommendedPlugins: getRecommendedPlugins(currentUrl, '')
  });
}

export async function executeJavascriptWithReady(params) {
  const response = await executeJavascript(params);
  try {
    if (!response.error) {
      const { page } = await getValidatedPage(new URL(params.url).hostname);
      if (page) await waitForPageReady(page, { afterInteraction: true });
    }
  } catch (err) {
    logger.debug(`execute_javascript post-wait skipped: ${err.message}`);
  }
  return response;
}
