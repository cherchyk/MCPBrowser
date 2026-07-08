/**
 * get-current-html.js - Get current HTML from an already-loaded page
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { extractAndProcessHtml, getLargeHtmlHints, detectMainContent, buildMainContentHint } from '../core/page.js';
import { formatContent } from '../core/markdown.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';
import { getPluginNextSteps, getRecommendedPlugins } from '../core/plugin-loader.js';
import { scanPageForms } from './detect-forms.js';
import { scanScrollableAreas } from './scroll-page.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful browser_get_current_html operations
 */
export class GetCurrentHtmlSuccessResponse extends MCPResponse {
  /**
   * @param {string} currentUrl - Current page URL
   * @param {string} html - Page HTML content
   * @param {string[]} nextSteps - Suggested next actions
   * @param {Array} [recommendedPlugins] - Detected plugin metadata
   * @param {Object} [formData] - Detected forms data
   */
  constructor(currentUrl, html, nextSteps, recommendedPlugins = [], formData = null, scrollableAreas = []) {
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
    this.scrollableAreas = scrollableAreas;
  }

  _getAdditionalFields() {
    return {
      currentUrl: this.currentUrl,
      html: this.html,
      recommendedPlugins: this.recommendedPlugins,
      forms: this.forms,
      orphanedFields: this.orphanedFields,
      totalFieldCount: this.totalFieldCount,
      scrollableAreas: this.scrollableAreas
    };
  }

  getTextSummary() {
    return `Retrieved HTML from: ${this.currentUrl}`;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const GET_CURRENT_HTML_TOOL = {
  name: "browser_get_current_html",
  title: "Get Current HTML",
  description: "Re-read HTML from an already-loaded page without reloading it. Use when: you need to check page state after a click or form fill, re-extract content from the current page, or get updated HTML after dynamic changes. Much faster than browser_fetch_webpage since it skips navigation. PREREQUISITE: Page must be loaded with browser_fetch_webpage first.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "The URL of the page (must match a previously fetched page)" },
      // removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%.", default: true },
      selector: { type: "string", description: "CSS selector to extract a specific DOM subtree instead of the full page. Prefer semantic content regions like 'main', 'article', or '[role=\"main\"]' to capture the primary content while skipping navigation, headers, and footers (this also reduces response size). Other examples: '.content', 'body > div:first-child'. If no elements match, falls back to full page with a note." },
      format: { type: "string", enum: ["html", "text", "markdown"], description: "Format for the returned content. 'html' (default) returns cleaned HTML. 'text' returns normalized visible text. 'markdown' returns readable Markdown. For 'text' and 'markdown' without a selector, MCPBrowser automatically scopes to the detected main content, skipping navigation/header/footer.", default: "html" },
      detectForms: { type: "boolean", description: "Scan page for forms and return structured form data (fields, selectors, submit buttons, orphaned inputs). Set to true when you need to fill or interact with forms.", default: false }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      currentUrl: { type: "string", description: "Current page URL" },
      html: { type: "string", description: "Page content in the requested format (cleaned HTML by default; visible text or Markdown when 'format' is set)" },
      forms: { type: "array", items: { type: "object" }, description: "Detected forms with fields, selectors, and metadata" },
      orphanedFields: { type: "array", items: { type: "object" }, description: "Input/select/textarea elements not inside any <form>" },
      totalFieldCount: { type: "number", description: "Total number of form fields found on the page" },
      nextSteps: { 
        type: "array", 
        items: { type: "string" },
        description: "Suggested next actions"
      },
      recommendedPlugins: {
        type: "array",
        items: { type: "object" },
        description: "Detected site-specific plugins available for this domain"
      },
      scrollableAreas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            selector: { type: "string" },
            scrollHeight: { type: "number" },
            clientHeight: { type: "number" },
            scrollTop: { type: "number" },
            hiddenPixels: { type: "number" },
            description: { type: "string" }
          }
        },
        description: "Scrollable containers on the page. Pass a selector to browser_scroll_page's 'container' parameter to scroll within a specific area."
      }
    },
    required: ["currentUrl", "html", "nextSteps"],
    additionalProperties: false
  },
  annotations: {
    title: "Get Current HTML",
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Get current HTML from an already-loaded page without reloading/navigating
 * Use this after interactions (click, type, wait) to get updated DOM state
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page to get HTML from
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML
 * @returns {Promise<Object>} Result object with current HTML
 */
export async function getCurrentHtml({ url, removeUnnecessaryHTML = true, selector = null, detectForms = false, format = 'html' }) {
  const startTime = Date.now();
  logger.info(`browser_get_current_html called: url=${url}${selector ? ` selector=${selector}` : ''}`);
  
  if (!url) {
    throw new Error("url parameter is required");
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Ensure browser connection (triggers domain map rebuild on reconnect)
  try {
    await getBrowser();
  } catch (err) {
    logger.error(`browser_get_current_html: Failed to connect to browser: ${err.message}`);
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

  // Validate page exists and is usable
  const { page, error: pageError } = await getValidatedPage(hostname);
  
  if (!page) {
    const isConnectionLost = pageError && pageError.includes('connection');
    logger.debug(`browser_get_current_html: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost 
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can get its current HTML',
      [
        "Use MCPBrowser's browser_fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's browser_get_current_html with the same URL"
      ]
    );
  }

  try {
    const currentUrl = page.url();

    // When the agent didn't scope with a selector, detect the primary content
    // area. Used to (a) recommend scoping for HTML output, and (b) auto-scope
    // for text/markdown output so the agent gets clean content in one call.
    let contentRecommendation = null;
    if (!selector) {
      contentRecommendation = await detectMainContent(page);
    }
    const autoScoped = !selector && format !== 'html' && !!contentRecommendation;
    const effectiveSelector = autoScoped ? contentRecommendation.selector : selector;

    const html = await extractAndProcessHtml(page, removeUnnecessaryHTML, effectiveSelector);
    
    // Scan for forms when requested (lightweight, ~50-100ms)
    let formData = null;
    if (detectForms) {
      try {
        formData = await scanPageForms(page);
      } catch (err) {
        logger.debug(`Form scan failed (non-fatal): ${err.message}`);
      }
    }

    // Scan for scrollable areas (lightweight, ~20-50ms)
    let scrollableAreas = [];
    try {
      scrollableAreas = await scanScrollableAreas(page);
    } catch (err) {
      logger.debug(`Scrollable area scan failed (non-fatal): ${err.message}`);
    }
    
    // Detect empty/near-empty HTML extraction (e.g., CSP blocking page.evaluate)
    if (!html || html.trim().length < 100) {
      logger.warn(`browser_get_current_html: HTML extraction returned empty/minimal content from ${currentUrl} (${html ? html.trim().length : 0} chars)`);
      return new InformationalResponse(
        `HTML extraction returned empty content from ${currentUrl}`,
        'The page may be blocking evaluation via Content Security Policy (CSP), the page has not fully rendered, or the page uses a sandboxed context that prevents DOM reading.',
        [
          "Use MCPBrowser's browser_take_screenshot with fullPage=true to verify the page is visually loaded",
          "Use MCPBrowser's browser_execute_javascript with a simple script like 'document.title' to test page accessibility",
          "Try MCPBrowser's browser_fetch_webpage to reload the page",
          "Wait and retry — the page may still be rendering"
        ]
      );
    }
    
    logger.info(`browser_get_current_html completed: got HTML from ${currentUrl}`);
    
    // Convert to the requested output format (html | text | markdown).
    const content = formatContent(html, format);
    
    return new GetCurrentHtmlSuccessResponse(
      currentUrl,
      content,
      [
        ...(format === 'html' ? buildMainContentHint(contentRecommendation) : []),
        ...(autoScoped ? [`Returned only the detected main content (selector: '${effectiveSelector}', format: ${format}). To get the full page instead, call again with selector: 'body'.`] : []),
        ...getLargeHtmlHints(html, effectiveSelector),
        ...getPluginNextSteps(currentUrl, html),
        "Use MCPBrowser's browser_click_element to interact with elements",
        "Use MCPBrowser's browser_type_text to fill forms",
        "Use MCPBrowser's browser_take_screenshot with fullPage=true if page layout or visual content is hard to understand from HTML",
        "Use MCPBrowser's browser_close_tab to free resources when done"
      ],
      getRecommendedPlugins(currentUrl, html),
      formData,
      scrollableAreas
    );
  } catch (err) {
    logger.error(`browser_get_current_html failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to get HTML: ${err.message}`,
      'Could not extract HTML from the page. The page may have navigated away or the connection was lost.',
      [
        "Try MCPBrowser's browser_fetch_webpage to reload the page",
        "Use MCPBrowser's browser_close_tab and start fresh if needed"
      ]
    );
  }
}
