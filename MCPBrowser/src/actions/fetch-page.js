/**
 * fetch-page.js - Main page fetching functionality
 * Handles web page fetching with authentication flows and tab reuse
 */

import { getBrowser, domainPages } from '../core/browser.js';
import { getOrCreatePage, queueRequest, navigateToUrl, waitForPageReady, extractAndProcessHtml, waitForPageStability } from '../core/page.js';
import { detectRedirectType, waitForAutoAuth, waitForManualAuth } from '../core/auth.js';
import { MCPResponse, ErrorResponse } from '../core/responses.js';

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
   */
  constructor(currentUrl, html, nextSteps) {
    super(nextSteps);
    
    if (typeof currentUrl !== 'string') {
      throw new TypeError('currentUrl must be a string');
    }
    if (typeof html !== 'string') {
      throw new TypeError('html must be a string');
    }
    
    this.currentUrl = currentUrl;
    this.html = html;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      html: this.html
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
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["currentUrl", "html", "nextSteps"],
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
  // Handle missing URL with environment variable fallback
  if (!url) {
    const fallbackUrl = process.env.DEFAULT_FETCH_URL || process.env.MCP_DEFAULT_FETCH_URL;
    if (fallbackUrl) {
      url = fallbackUrl;
    } else {
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
    return new ErrorResponse(`Invalid URL: ${url}`, []);
  }

  // Queue this request - processed sequentially, one at a time
  return queueRequest(async () => {
    return await doFetchPage({ url, hostname, browser, removeUnnecessaryHTML, postLoadWait });
  });
}

/**
 * Internal function that does the actual page fetching.
 * Called by the queue processor - only one runs at a time.
 */
async function doFetchPage({ url, hostname, browser, removeUnnecessaryHTML, postLoadWait }) {
  // Hardcoded smart defaults
  const waitUntil = "domcontentloaded";
  const navigationTimeout = 30000;
  const authCompletionTimeout = 600000;
  const reuseLastKeptPage = true;

  const browserInstance = await getBrowser(browser);
  
  try {
    // Get or create page for this domain (simple - no locks needed)
    let page = await getOrCreatePage(browserInstance, hostname, reuseLastKeptPage);
    
    // Navigate to URL (pure navigation)
    await navigateToUrl(page, url, waitUntil, navigationTimeout);
    
    // Wait for page content to be ready (handles SPAs automatically)
    await waitForPageReady(page);
    
    const currentUrl = page.url();
    const currentHostname = new URL(currentUrl).hostname;
    
    // Detect redirect type and handle accordingly
    const redirectInfo = detectRedirectType(url, hostname, currentUrl, currentHostname);
    
    if (redirectInfo.type === 'requested_auth') {
      console.error(`[MCPBrowser] User requested auth page directly, returning content`);
      // Update domain mapping if needed
      if (redirectInfo.currentHostname !== hostname) {
        domainPages.delete(hostname);
        domainPages.set(redirectInfo.currentHostname, page);
        hostname = redirectInfo.currentHostname;
      }
    } else if (redirectInfo.type === 'permanent') {
      console.error(`[MCPBrowser] Permanent redirect detected: ${hostname} → ${redirectInfo.currentHostname}`);
      
      // Check if we already have a tab for the redirected hostname
      // (can happen after reconnect - we mapped mail.google.com but not gmail.com)
      const existingPage = domainPages.get(redirectInfo.currentHostname);
      if (existingPage && existingPage !== page && !existingPage.isClosed()) {
        console.error(`[MCPBrowser] Found existing tab for ${redirectInfo.currentHostname}, reusing it`);
        // Close the new tab we just opened, use the existing one
        await page.close().catch(() => {});
        domainPages.delete(hostname);
        page = existingPage;
        // Map original hostname to existing page
        domainPages.set(hostname, existingPage);
      } else {
        console.error(`[MCPBrowser] Mapping both hostnames to same tab for future reuse`);
        // Map both original and final hostname to the same page
        domainPages.set(hostname, page);
        domainPages.set(redirectInfo.currentHostname, page);
      }
      hostname = redirectInfo.currentHostname;
    } else if (redirectInfo.type === 'auth') {
      console.error(`[MCPBrowser] Authentication flow detected (${redirectInfo.flowType})`);
      console.error(`[MCPBrowser] Current location: ${redirectInfo.currentUrl}`);
      
      // Try auto-auth first (check if existing session works)
      const autoAuthResult = await waitForAutoAuth(page);
      
      if (autoAuthResult.success) {
        // Update hostname to where we landed
        if (autoAuthResult.hostname !== hostname) {
          domainPages.delete(hostname);
          domainPages.set(autoAuthResult.hostname, page);
          hostname = autoAuthResult.hostname;
        }
      } else {
        // Wait for manual auth
        const manualAuthResult = await waitForManualAuth(page, authCompletionTimeout);
        
        if (!manualAuthResult.success) {
          return new ErrorResponse(
            manualAuthResult.error,
            [
              "Complete authentication in the browser window",
              "Call fetch_webpage again with the same URL to retry",
              "Use close_tab to reset the session if authentication fails"
            ]
          );
        }
        
        // Update hostname to where we landed
        if (manualAuthResult.hostname !== hostname) {
          domainPages.delete(hostname);
          domainPages.set(manualAuthResult.hostname, page);
          hostname = manualAuthResult.hostname;
        }
      }
      
      // Wait for page stability after auth
      await waitForPageStability(page);
    }
    
    // Additional wait if requested (for pages that need extra time)
    if (postLoadWait > 0) {
      console.error(`[MCPBrowser] Waiting ${postLoadWait}ms (postLoadWait)...`);
      await new Promise(resolve => setTimeout(resolve, postLoadWait));
    }
    
    // Extract and process HTML
    const processedHtml = await extractAndProcessHtml(page, removeUnnecessaryHTML);
    
    return new FetchPageSuccessResponse(
      page.url(),
      processedHtml,
      [
        "Use click_element to interact with buttons/links on the page",
        "Use type_text to fill in form fields",
        "Use get_current_html to re-check page state after interactions",
        "Use close_tab when finished to free browser resources"
      ]
    );
  } catch (err) {
    return new ErrorResponse(
      err.message || String(err),
      [
        "Complete authentication in the browser if prompted",
        "Call fetch_webpage again with the same URL to retry",
        "Use close_tab to reset the session if needed"
      ]
    );
  }
}
