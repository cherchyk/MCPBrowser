/**
 * Page management for MCPBrowser
 * 
 * Simple sequential queue - no locks, no deadlock risk.
 * Processes one URL at a time, reuses tabs per domain.
 */

import { domainPages } from './browser.js';
import { cleanHtml, enrichHtml } from './html.js';

// ============================================================================
// SIMPLE REQUEST QUEUE (No Locks)
// ============================================================================

/** @type {Array<{resolve: Function, reject: Function, processor: Function}>} */
const requestQueue = [];
let isProcessing = false;

/**
 * Add a request to the queue and process sequentially.
 * No locks - just a simple FIFO queue processed one at a time.
 * @param {Function} processor - Async function that does the actual work
 * @returns {Promise<any>} Result from the processor
 */
export function queueRequest(processor) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ resolve, reject, processor });
    processQueue();
  });
}

/**
 * Process the queue sequentially (one request at a time).
 * No locks, no deadlock risk - simple loop.
 */
async function processQueue() {
  if (isProcessing) return;  // Already processing
  isProcessing = true;
  
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    const queueLength = requestQueue.length;
    
    if (queueLength > 0) {
      console.error(`[MCPBrowser] Processing request (${queueLength} more in queue)`);
    }
    
    try {
      const result = await request.processor();
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    }
  }
  
  isProcessing = false;
}

// ============================================================================
// PAGE MANAGEMENT
// ============================================================================

/**
 * Get or create a page for the given domain, reusing existing tabs when possible.
 * Also checks domain redirect mapping (e.g., gmail.com -> mail.google.com).
 * @param {Browser} browser - The Puppeteer browser instance
 * @param {string} hostname - The hostname to get/create a page for
 * @param {boolean} reuseLastKeptPage - Whether to reuse existing tabs
 * @returns {Promise<Page>} The page for this domain
 */
export async function getOrCreatePage(browser, hostname, reuseLastKeptPage = true) {
  let page = null;
  
  // Check if we have an existing page for this domain
  // (domainPages may have multiple hostnames pointing to the same page after redirects)
  if (reuseLastKeptPage && domainPages.has(hostname)) {
    const existingPage = domainPages.get(hostname);
    if (!existingPage.isClosed()) {
      page = existingPage;
      await page.bringToFront().catch(() => {});
      console.error(`[MCPBrowser] Reusing existing tab for domain: ${hostname}`);
    } else {
      // Page was closed externally, remove from map
      domainPages.delete(hostname);
    }
  }
  
  // Create new tab if no existing page for this domain
  if (!page) {
    try {
      page = await browser.newPage();
    } catch (error) {
      // If newPage() fails (can happen with some profiles), try to reuse existing page
      const pages = await browser.pages();
      for (const p of pages) {
        try {
          const pageUrl = p.url();
          // Skip chrome:// pages and other internal pages
          if (!pageUrl.startsWith('chrome://') && !pageUrl.startsWith('chrome-extension://')) {
            page = p;
            break;
          }
        } catch {
          // Skip pages we can't access
        }
      }
      if (!page) {
        throw new Error('Unable to create or find a controllable page');
      }
    }
    // Add new page to domain map
    domainPages.set(hostname, page);
    console.error(`[MCPBrowser] Created new tab for domain: ${hostname}`);
  }
  
  return page;
}

/**
 * Detect if the page appears to be a Single Page Application (SPA).
 * SPAs typically have minimal initial HTML and render content via JavaScript.
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<{isSPA: boolean, indicators: string[]}>} Detection result
 */
export async function isItSPA(page) {
  try {
    const result = await page.evaluate(() => {
      const indicators = [];
      const body = document.body;
      const html = document.documentElement;
      
      // Check for React
      if (document.getElementById('root') || document.getElementById('__next') || 
          document.querySelector('[data-reactroot]') || window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
        indicators.push('React');
      }
      
      // Check for Vue
      if (document.getElementById('app') && (window.__VUE__ || document.querySelector('[data-v-]'))) {
        indicators.push('Vue');
      }
      
      // Check for Angular
      if (document.querySelector('[ng-app]') || document.querySelector('[ng-version]') || 
          document.querySelector('app-root') || window.ng) {
        indicators.push('Angular');
      }
      
      // Check for generic SPA patterns
      if (document.querySelector('[data-app]') || document.querySelector('#app-container')) {
        indicators.push('SPA container');
      }
      
      // Check if body has very little text content (SPA shell)
      const bodyText = body?.innerText?.trim() || '';
      const textLength = bodyText.length;
      if (textLength < 500) {
        indicators.push(`minimal content (${textLength} chars)`);
      }
      
      // Check for lots of script tags (typical of SPAs)
      const scripts = document.querySelectorAll('script[src]');
      if (scripts.length > 5) {
        indicators.push(`${scripts.length} external scripts`);
      }
      
      // Check for SPA framework bundles in script srcs
      const scriptSrcs = Array.from(scripts).map(s => s.src.toLowerCase());
      const spaFrameworks = ['react', 'vue', 'angular', 'webpack', 'chunk', 'bundle', 'main.js'];
      const foundFrameworks = spaFrameworks.filter(fw => 
        scriptSrcs.some(src => src.includes(fw))
      );
      if (foundFrameworks.length > 0) {
        indicators.push(`framework scripts: ${foundFrameworks.join(', ')}`);
      }
      
      // Likely an SPA if we found any indicator (React/Vue/Angular detection is a strong signal)
      const isSPA = indicators.length >= 1;
      
      return { isSPA, indicators, textLength };
    });
    
    return result;
  } catch (error) {
    // If evaluation fails, assume not SPA
    return { isSPA: false, indicators: ['evaluation failed'], textLength: 0 };
  }
}

/**
 * Navigate to URL (pure navigation, no waiting logic).
 * @param {Page} page - The Puppeteer page instance
 * @param {string} url - The URL to navigate to
 * @param {string} waitUntil - Wait condition (networkidle0, load, domcontentloaded)
 * @param {number} timeout - Navigation timeout in ms
 * @returns {Promise<void>}
 */
export async function navigateToUrl(page, url, waitUntil, timeout) {
  console.error(`[MCPBrowser] Navigating to: ${url}`);
  
  const startTime = Date.now();
  
  try {
    await page.goto(url, { waitUntil, timeout });
    
    const loadTime = Date.now() - startTime;
    console.error(`[MCPBrowser] Navigation completed in ${loadTime}ms: ${page.url()}`);
  } catch (error) {
    const elapsed = Date.now() - startTime;
    console.error(`[MCPBrowser] Navigation error after ${elapsed}ms: ${error.message}`);
    throw error;
  }
}

/**
 * Wait for page content to be ready (handles SPAs and regular pages).
 * Detects SPAs and waits appropriately for JavaScript to render content.
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<void>}
 */
export async function waitForPageReady(page) {
  const spaCheck = await isItSPA(page);
  
  if (spaCheck.isSPA) {
    console.error(`[MCPBrowser] 🔄 SPA detected: ${spaCheck.indicators.join(', ')}`);
    console.error(`[MCPBrowser] Waiting for JavaScript to render content...`);
    
    // Wait for SPA to render
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Then wait for network to settle
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 3000 });
    } catch {
      // OK if timeout - SPA might have websockets or long-polling
    }
    console.error(`[MCPBrowser] SPA content ready`);
  } else {
    // For non-SPAs, just wait briefly for any pending network requests
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 2000 });
    } catch {
      // OK if timeout
    }
  }
}

/**
 * Wait for page to stabilize after user interaction or authentication.
 * Used after clicks, form submissions, or when user completes login.
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<void>}
 */
export async function waitForPageStability(page) {
  console.error(`[MCPBrowser] Waiting for page to stabilize...`);
  
  // Give time for any triggered actions to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    await page.waitForNetworkIdle({ timeout: 5000 });
    console.error(`[MCPBrowser] Page stabilized`);
  } catch {
    // Ignore timeout - page may have long-polling or websockets
    console.error(`[MCPBrowser] Network still active, continuing anyway`);
  }
}

/**
 * Extract and process HTML from the page.
 * @param {Page} page - The Puppeteer page instance
 * @param {boolean} removeUnnecessaryHTML - Whether to clean the HTML
 * @returns {Promise<string>} The processed HTML
 */
export async function extractAndProcessHtml(page, removeUnnecessaryHTML) {
  const html = await page.evaluate(() => document.documentElement?.outerHTML || "");
  
  let processedHtml;
  if (removeUnnecessaryHTML) {
    const cleaned = cleanHtml(html);
    processedHtml = enrichHtml(cleaned, page.url());
  } else {
    processedHtml = enrichHtml(html, page.url());
  }
  
  return processedHtml;
}
