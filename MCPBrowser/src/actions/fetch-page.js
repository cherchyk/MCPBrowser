/**
 * fetch-page.js - Main page fetching functionality
 * Handles web page fetching with authentication flows and tab reuse
 */

import { getBrowser, domainPages } from '../core/browser.js';
import { getOrCreatePage, queueRequest, navigateToUrl, waitForPageReady, extractAndProcessHtml } from '../core/page.js';
import { isLikelyAuthUrl, waitForAuth } from '../core/auth.js';
import { MCPResponse, ErrorResponse, HttpStatusResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';
import { getPluginNextSteps, getRecommendedPlugins } from '../core/plugin-loader.js';
import { scanPageForms } from './detect-forms.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful fetch_webpage operations
 */
export class FetchPageSuccessResponse extends MCPResponse {
  /**
   * @param {string} currentUrl - Final URL after redirects
   * @param {string} html - Page HTML content
   * @param {string[]} nextSteps - Suggested next actions
   * @param {Array} [recommendedPlugins] - Detected plugin metadata
   * @param {Object} [formData] - Detected forms data
   */
  constructor(currentUrl, html, nextSteps, recommendedPlugins = [], formData = null) {
    super(nextSteps);
    
    if (typeof currentUrl !== 'string') {
      throw new TypeError('currentUrl must be a string');
    }
    if (typeof html !== 'string') {
      throw new TypeError('html must be a string');
    }
    
    this.currentUrl = currentUrl;
    this.html = html;
    this.recommendedPlugins = recommendedPlugins;
    this.forms = formData?.forms || [];
    this.orphanedFields = formData?.orphanedFields || [];
    this.totalFieldCount = formData?.totalFieldCount || 0;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      html: this.html,
      recommendedPlugins: this.recommendedPlugins,
      forms: this.forms,
      orphanedFields: this.orphanedFields,
      totalFieldCount: this.totalFieldCount
    };
  }

  getTextSummary() {
    return `Successfully fetched: ${this.currentUrl}`;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const FETCH_WEBPAGE_TOOL = {
  name: "fetch_webpage",
  title: "Fetch Web Page",
  description: "Fetches web pages using Chrome/Edge browser with full JavaScript rendering and authentication support. **REQUIRED for corporate/enterprise sites, any page requiring login/SSO, anti-bot/CAPTCHA pages, and JavaScript-heavy applications.** Use this as the DEFAULT for all webpage fetching - it handles simple HTML pages too. Opens browser for user authentication when needed. Never use generic HTTP fetch for pages that might require authentication.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL to fetch" },
      browser: { 
        type: "string", 
        description: "Browser to use: 'chrome' or 'edge'. Leave empty for auto-detection. Chrome/Edge use CDP to access existing sessions for authenticated sites.",
        enum: ["", "chrome", "edge"]
      },
      removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%.", default: true },
      postLoadWait: { type: "number", description: "Additional milliseconds to wait after page load before extracting HTML. Use for pages that need extra time to render. Default: 0 (no extra wait, SPA detection handles most cases automatically).", default: 0 }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      currentUrl: { type: "string", description: "Final URL after any redirects" },
      html: { type: "string", description: "Page HTML content" },
      forms: { type: "array", items: { type: "object" }, description: "Detected forms with fields, selectors, and metadata" },
      orphanedFields: { type: "array", items: { type: "object" }, description: "Input/select/textarea elements not inside any <form>" },
      totalFieldCount: { type: "number", description: "Total number of form fields found on the page" },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["currentUrl", "html", "forms", "orphanedFields", "totalFieldCount", "nextSteps"],
    additionalProperties: false
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Fetch a web page using Chrome browser, with support for authentication flows and tab reuse.
 * Reuses existing tabs per domain when possible. Handles authentication redirects by waiting
 * for user to complete login (up to 10 minutes). Processes HTML to remove unnecessary elements
 * and convert relative URLs to absolute. Automatically detects and handles SPAs.
 * 
 * Requests are queued and processed sequentially (one at a time) to avoid race conditions.
 * 
 * @param {Object} params - Fetch parameters
 * @param {string} params.url - The URL to fetch
 * @param {string} [params.browser=''] - Browser type (chrome, edge) or empty for auto-detect
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML (removes scripts, styles, etc.)
 * @param {number} [params.postLoadWait=0] - Additional milliseconds to wait after page load before extracting HTML
 * @returns {Promise<Object>} Result object with success status, URL, HTML content, or error details
 */
export async function fetchPage({ url, browser = '', removeUnnecessaryHTML = true, postLoadWait = 0 }) {
  logger.info(`fetch_webpage called: url=${url}`);
  
  // Handle missing URL with environment variable fallback
  if (!url) {
    const fallbackUrl = process.env.DEFAULT_FETCH_URL || process.env.MCP_DEFAULT_FETCH_URL;
    if (fallbackUrl) {
      url = fallbackUrl;
    } else {
      logger.error("Missing url parameter");
      return new ErrorResponse(
        "Missing url parameter and no DEFAULT_FETCH_URL/MCP_DEFAULT_FETCH_URL configured",
        ["Set DEFAULT_FETCH_URL or MCP_DEFAULT_FETCH_URL environment variable", "Provide url parameter in the request"]
      );
    }
  }

  // Parse hostname for domain-based tab reuse
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    logger.error(`Invalid URL: ${url}`);
    return new ErrorResponse(`Invalid URL: ${url}`, []);
  }

  // Queue this request - processed sequentially, one at a time
  return queueRequest(async () => {
    return await doFetchPage({ url, browser, removeUnnecessaryHTML, postLoadWait });
  });
}

/**
 * Internal function that does the actual page fetching.
 * Called by the queue processor - only one runs at a time.
 */
async function doFetchPage({ url, browser, removeUnnecessaryHTML, postLoadWait }) {
  const originalHostname = new URL(url).hostname;

  // Ensure browser connection
  let browserInstance;
  try {
    browserInstance = await getBrowser(browser);
  } catch (err) {
    logger.error(`fetch_webpage: Failed to connect to browser: ${err.message}`);
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
  
  try {
    let page = await getOrCreatePage(browserInstance, originalHostname);
    let { statusCode, statusText } = await navigateToUrl(page, url, 'domcontentloaded', 30000);
    await waitForPageReady(page);

    // Auth: handle multi-step auth flows (e.g., server OIDC → client MSAL)
    // Loop because some sites bounce through auth multiple times before landing.
    let authAttempts = 0;
    while (isLikelyAuthUrl(page.url()) && !isLikelyAuthUrl(url) && authAttempts < 3) {
      authAttempts++;
      logger.info(`Authentication required (attempt ${authAttempts}): ${page.url()}`);
      const authResult = await waitForAuth(page);
      if (!authResult.success) {
        return new ErrorResponse(
          authResult.error,
          [
            "Complete authentication in the browser window",
            "Call MCPBrowser's fetch_webpage again with the same URL to retry",
            "Use MCPBrowser's close_tab to reset the session if authentication fails"
          ]
        );
      }
      await waitForPageReady(page, { afterInteraction: true });
      statusCode = null;
      statusText = '';
    }

    // Reconcile domain mappings after any redirect (permanent, auth, or none)
    page = reconcileDomainMapping(page, originalHostname);

    // Additional wait if requested
    if (postLoadWait > 0) {
      logger.debug(`Waiting ${postLoadWait}ms (postLoadWait)...`);
      await new Promise(resolve => setTimeout(resolve, postLoadWait));
    }
    
    // Extract and process HTML
    const processedHtml = await extractAndProcessHtml(page, removeUnnecessaryHTML);
    
    // Scan for forms (lightweight, ~50-100ms)
    let formData = null;
    try {
      formData = await scanPageForms(page);
    } catch (err) {
      logger.debug(`Form scan failed (non-fatal): ${err.message}`);
    }
    
    logger.info(`fetch_webpage completed: ${page.url()}`);
    
    // Check for non-2xx HTTP status codes
    if (statusCode && (statusCode >= 400 && statusCode < 600)) {
      logger.debug(`HTTP ${statusCode} ${statusText} - returning as informational response`);
      return new HttpStatusResponse(page.url(), statusCode, statusText, processedHtml);
    }
    
    return new FetchPageSuccessResponse(
      page.url(),
      processedHtml,
      [
        ...getPluginNextSteps(page.url(), processedHtml),
        "Use MCPBrowser's click_element to interact with buttons/links on the page",
        "Use MCPBrowser's type_text to fill in form fields",
        "Use MCPBrowser's get_current_html to re-check page state after interactions",
        "Use MCPBrowser's take_screenshot if page has charts, images, or complex visual layout that's hard to understand from HTML",
        "Use MCPBrowser's close_tab when finished to free browser resources"
      ],
      getRecommendedPlugins(page.url(), processedHtml),
      formData
    );
  } catch (err) {
    logger.error(`fetch_webpage failed: ${err.message || String(err)}`);
    return new ErrorResponse(
      err.message || String(err),
      [
        "Complete authentication in the browser if prompted",
        "Call MCPBrowser's fetch_webpage again with the same URL to retry",
        "Use MCPBrowser's close_tab to reset the session if needed"
      ]
    );
  }
}

/**
 * Reconcile domain mappings after navigation/redirect.
 * If the page ended up on a different hostname, map both to the same tab.
 * If another tab already exists for the new hostname, reuse it.
 * @param {Page} page - The current Puppeteer page
 * @param {string} originalHostname - The hostname from the original URL
 * @returns {Page} The page to use (may differ if an existing tab was found)
 */
function reconcileDomainMapping(page, originalHostname) {
  const currentHostname = new URL(page.url()).hostname;
  if (currentHostname === originalHostname) return page;

  logger.debug(`Redirect: ${originalHostname} → ${currentHostname}`);

  const existing = domainPages.get(currentHostname);
  if (existing && existing !== page && !existing.isClosed()) {
    // Another tab already owns this hostname — close ours, reuse existing
    logger.debug(`Found existing tab for ${currentHostname}, reusing it`);
    page.close().catch(() => {});
    domainPages.set(originalHostname, existing);
    return existing;
  }

  // Map both hostnames to same page
  domainPages.set(originalHostname, page);
  domainPages.set(currentHostname, page);
  return page;
}
