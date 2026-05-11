/**
 * Page management for MCPBrowser
 * 
 * Simple sequential queue - no locks, no deadlock risk.
 * Processes one URL at a time, reuses tabs per domain.
 */

import { domainPages } from './browser.js';
import { cleanHtml, enrichHtml } from './html.js';
import logger from './logger.js';

// Minimum body text length that suggests meaningful content is present
const MIN_BODY_TEXT_LENGTH = 500;

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
      logger.debug(`Queue: ${queueLength} requests waiting`);
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
 * @returns {Promise<Page>} The page for this domain
 */
export async function getOrCreatePage(browser, hostname) {
  const existingPage = domainPages.get(hostname);
  if (existingPage) {
    if (!existingPage.isClosed()) {
      await existingPage.bringToFront().catch(() => {});
      logger.info(`Tab reused: ${hostname}`);
      return existingPage;
    }
    // Page was closed externally — clean up stale mapping
    domainPages.delete(hostname);
  }

  // Create new tab (with fallback reuse if creation fails)
  let page = null;
  try {
    page = await browser.newPage();
  } catch (error) {
    // Some profiles may block new tabs; fallback to any existing controllable page
    const pages = await browser.pages();
    for (const p of pages) {
      try {
        const pageUrl = p.url();
        if (!pageUrl.startsWith('chrome://') && !pageUrl.startsWith('chrome-extension://')) {
          page = p;
          logger.info('Reusing existing page after newPage() failure');
          break;
        }
      } catch {
        // Ignore pages we cannot access
      }
    }
    if (!page) throw new Error('Unable to create or find a controllable page');
  }

  domainPages.set(hostname, page);
  logger.info(`Tab created: ${hostname}`);
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
      let strongIndicatorCount = 0;  // Count definite SPA signals
      let weakIndicatorCount = 0;    // Count possible SPA signals
      const body = document.body;
      
      // Check for React (strong indicator - require multiple signals or definitive marker)
      const hasReactRoot = document.querySelector('[data-reactroot]') || document.querySelector('[data-react-root]');
      const hasNextJs = document.getElementById('__next');
      const hasReactFiber = document.querySelector('[data-reactid]');
      // Only count generic #root if combined with React-specific markers
      const hasGenericRoot = document.getElementById('root');
      const hasReactInternals = typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined' && 
                                 window.__REACT_DEVTOOLS_GLOBAL_HOOK__?.renderers?.size > 0;
      const hasRootSpinner = hasGenericRoot && !!document.querySelector('.request-status-spinner, .ms-Spinner, [role="progressbar"], .spinner, .loading');
      
      if (hasReactRoot || hasNextJs || hasReactFiber || hasReactInternals) {
        indicators.push('React');
        strongIndicatorCount++;
      } else if (hasGenericRoot && (body?.children?.length <= 3 || hasRootSpinner)) {
        // Generic #root with minimal DOM children suggests SPA mounting point
        indicators.push('React (probable)');
        // If spinner exists under root, treat as stronger signal
        if (hasRootSpinner) {
          strongIndicatorCount++;
        } else {
          weakIndicatorCount++;
        }
      }
      
      // Check for Vue / Nuxt (strong indicator - check for Vue-specific markers)
      const hasNuxt = document.getElementById('__nuxt');
      const hasVueDevtools = typeof window.__VUE__ !== 'undefined' || typeof window.__VUE_DEVTOOLS_GLOBAL_HOOK__ !== 'undefined';
      // Vue scoped styles add data-v-xxxx attributes; querySelector('[data-v-]') only
      // matches a literal "data-v-" attribute, so scan a sample of elements instead
      const hasVueScoped = Array.from(document.body?.querySelectorAll('*') || [])
        .slice(0, 50)
        .some(el => Array.from(el.attributes).some(attr => /^data-v-./.test(attr.name)));
      const hasVue3App = document.querySelector('[data-v-app]') !== null;
      
      if (hasNuxt || hasVueDevtools || hasVueScoped || hasVue3App) {
        indicators.push('Vue');
        strongIndicatorCount++;
      }
      
      // Check for Angular (strong indicator)
      const hasAngularMarker = document.querySelector('[ng-version]') || 
                               document.querySelector('app-root') || 
                               typeof window.ng !== 'undefined';
      const hasAngularJS = document.querySelector('[ng-app]');  // AngularJS (legacy)
      
      if (hasAngularMarker) {
        indicators.push('Angular');
        strongIndicatorCount++;
      } else if (hasAngularJS) {
        indicators.push('AngularJS');
        weakIndicatorCount++;
      }
      
      // Check for Svelte
      const hasSvelte = document.querySelector('[class*="svelte-"]') !== null;
      if (hasSvelte) {
        indicators.push('Svelte');
        strongIndicatorCount++;
      }
      
      // Check for Ember
      const hasEmber = document.querySelector('[id^="ember"]') !== null || typeof window.Ember !== 'undefined';
      if (hasEmber) {
        indicators.push('Ember');
        strongIndicatorCount++;
      }
      
      // Check if body has very little text content (weak indicator)
      const bodyText = body?.innerText?.trim() || '';
      const textLength = bodyText.length;
      const hasMinimalContent = textLength < 200;  // Stricter threshold
      const hasShellOnlyContent = hasGenericRoot && textLength < 800; // shell + spinner, main not rendered yet
      if (hasMinimalContent) {
        indicators.push(`minimal content (${textLength} chars)`);
        weakIndicatorCount++;
      } else if (hasShellOnlyContent) {
        indicators.push(`root shell with limited content (${textLength} chars)`);
        weakIndicatorCount++;
      }
      
      // Check for lots of script tags (weak indicator on its own)
      const scripts = document.querySelectorAll('script[src]');
      const hasManyScripts = scripts.length > 8;  // Raised threshold
      if (hasManyScripts) {
        indicators.push(`${scripts.length} external scripts`);
        weakIndicatorCount++;
      }
      
      // Check for SPA framework bundles in script srcs (use specific patterns only)
      const scriptSrcs = Array.from(scripts).map(s => s.src.toLowerCase());
      // More specific patterns - avoid generic terms
      const spaPatterns = [
        /react[.-]dom/,      // react-dom.js, react.dom.min.js
        /vue[.-]?router/,    // vue-router
        /@vue\//,            // @vue/ scoped packages
        /angular[.-]core/,   // angular-core
        /svelte/,            // svelte runtime
        /next[.-]?static/,   // Next.js static files
        /nuxt/,              // Nuxt.js
        /gatsby/,            // Gatsby
        /remix/,             // Remix
        /webpack.*runtime/,  // webpack runtime (not just 'webpack')
      ];
      
      const foundPatterns = spaPatterns.filter(pattern => 
        scriptSrcs.some(src => pattern.test(src))
      );
      
      if (foundPatterns.length > 0) {
        indicators.push(`framework scripts detected`);
        strongIndicatorCount++;
      }
      
      // Decision logic:
      // - Any strong indicator = definitely SPA
      // - Multiple weak indicators (3+) = probably SPA  
      // - Minimal content alone is NOT enough (could be simple landing page)
      const isSPA = strongIndicatorCount > 0 || weakIndicatorCount >= 3;
      
      return { isSPA, indicators };
    });
    
    return result;
  } catch (error) {
    // If evaluation fails, assume not SPA
    return { isSPA: false, indicators: ['evaluation failed'] };
  }
}

/**
 * Navigate to URL (pure navigation, no waiting logic).
 * @param {Page} page - The Puppeteer page instance
 * @param {string} url - The URL to navigate to
 * @param {string} waitUntil - Wait condition (networkidle0, load, domcontentloaded)
 * @param {number} timeout - Navigation timeout in ms
 * @returns {Promise<{statusCode: number|null, statusText: string}>} HTTP response info
 */
export async function navigateToUrl(page, url, waitUntil, timeout) {
  logger.info(`Navigating to: ${url}`);
  
  const startTime = Date.now();
  
  try {
    const response = await page.goto(url, { waitUntil, timeout });
    
    const loadTime = Date.now() - startTime;
    const statusCode = response?.status() || null;
    const statusText = response?.statusText() || '';
    
    logger.info(`Navigation complete: ${page.url()} (${loadTime}ms, HTTP ${statusCode})`);
    
    return { statusCode, statusText };
  } catch (error) {
    const elapsed = Date.now() - startTime;
    logger.error(`Navigation failed: ${error.message} after ${elapsed}ms`);
    throw error;
  }
}

/**
 * Wait for page to be ready after navigation or user interaction.
 * Handles SPAs by polling DOM content until it renders and stabilizes.
 * Unified wait function — replaces separate "stability" and "ready" calls.
 * 
 * @param {Page} page - The Puppeteer page instance
 * @param {Object} [options] - Wait options
 * @param {boolean} [options.afterInteraction=false] - Add initial delay for JS to
 *   process a user interaction (click, type, auth). Skipped for plain navigation.
 * @returns {Promise<void>}
 */
export async function waitForPageReady(page, { afterInteraction = false } = {}) {
  // After interactions (click, type, auth redirect), give JS time to react
  if (afterInteraction) {
    logger.debug('Post-interaction settle (2s)...');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Ensure any JS-driven redirect chain has settled before evaluating content.
  // Common case (no redirect): one fast evaluate() succeeds → ~0ms overhead.
  // Redirect case: polls until URL + context stabilize (max 10s).
  await waitForNavigationToSettle(page);

  const initialContentLength = await getPageContentLength(page);

  // Check for SPA indicators (always — SPAs can render a shell/navbar
  // with substantial text while main content is still loading)
  const spaCheck = await isItSPA(page);

  const shouldWaitForRender = spaCheck.isSPA || initialContentLength < MIN_BODY_TEXT_LENGTH;

  if (!shouldWaitForRender) {
    logger.debug(`Page has some content (${initialContentLength} chars), not SPA`);
    try {
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 2000 });
    } catch {
      // OK if timeout
    }
    return;
  }

  const reasons = [];
  if (spaCheck.isSPA) reasons.push(`SPA detected (${spaCheck.indicators.join(', ')})`);
  if (initialContentLength < MIN_BODY_TEXT_LENGTH) reasons.push(`minimal body text (${initialContentLength} chars)`);
  logger.debug(`Waiting for JS-rendered content: ${reasons.join('; ')}`);

  // For non-SPA minimal pages (e.g., example.com), use a short settle to avoid long waits.
  const maxWait = spaCheck.isSPA ? 10_000 : 2_000;

  // Delegate to content renderer — polls DOM until content appears and stabilizes
  await waitForContentToRender(page, initialContentLength, { maxWait });
}

/**
 * Poll DOM until content appears and stabilizes.
 * Used after SPA or JS-rendered page is detected with minimal content.
 * @param {Page} page - The Puppeteer page instance
 * @param {number} initialContentLength - Content length at start of wait
 * @returns {Promise<void>}
 */
async function waitForContentToRender(page, initialContentLength, { maxWait = 10_000 } = {}) {
  // maxWait is overridable to allow short-settle paths for non-SPA minimal pages.
  const pollInterval = 500;    // Check every 500ms
  const stableTime = 1000;     // Content must be stable for 1 second

  const startTime = Date.now();
  let lastLength = initialContentLength;
  let lastChangeTime = startTime;

  while (Date.now() - startTime < maxWait) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const currentLength = await getPageContentLength(page);

    if (currentLength !== lastLength) {
      lastLength = currentLength;
      lastChangeTime = Date.now();
    }

    const contentIsSubstantial = currentLength >= MIN_BODY_TEXT_LENGTH;
    const isStable = (Date.now() - lastChangeTime) >= stableTime;

    // Content is substantial and stable
    if (contentIsSubstantial && isStable) {
      logger.debug(`Content rendered: body ${currentLength} chars in ${Date.now() - startTime}ms`);
      break;
    }
  }

  if (Date.now() - startTime >= maxWait) {
    logger.debug(`Content wait timed out after ${maxWait}ms (${lastLength} chars)`);
  }

  // Final network settle
  try {
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 3000 });
  } catch {
    // OK if timeout - SPA might have websockets or long-polling
  }

  logger.debug(`Page ready: ${lastLength} chars total, ${Date.now() - startTime}ms elapsed`);
}

/**
 * Get the length of visible text content on the page.
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<number>} Text content length
 */
async function getPageContentLength(page) {
  try {
    return await page.evaluate(() => (document.body?.innerText?.trim() || '').length);
  } catch {
    return 0;
  }
}

// ============================================================================
// NAVIGATION SETTLE & RETRY HELPERS
// ============================================================================

/**
 * Check if an error indicates the page navigated away (context destroyed).
 * @param {Error} err - The error to check
 * @returns {boolean}
 */
function isNavigationError(err) {
  const msg = err?.message || '';
  return msg.includes('Execution context was destroyed') ||
         msg.includes('Cannot find context') ||
         msg.includes('frame was detached') ||
         msg.includes('Target closed') ||
         msg.includes('Session closed');
}

/**
 * Wait for any in-progress JS-driven redirect to finish.
 *
 * Strategy: try a lightweight evaluate(). If it succeeds the page is stable
 * (common case — zero overhead). If it throws a navigation error, a redirect
 * is in progress — poll URL + retry evaluate every 300ms until both the URL and
 * context are stable for 1 second (max 10s).
 *
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<void>}
 */
async function waitForNavigationToSettle(page) {
  // Fast path: context is alive → no redirect in progress
  try {
    await page.evaluate(() => document.readyState);
    return;
  } catch (err) {
    if (!isNavigationError(err)) throw err;
    logger.debug('Navigation detected, waiting for redirect chain...');
  }

  // Slow path: poll until URL + context stable for 1s (max 10s)
  const startTime = Date.now();
  let lastUrl = '';
  let stableSince = startTime;

  while (Date.now() - startTime < 10_000) {
    await new Promise(r => setTimeout(r, 300));

    try {
      const currentUrl = page.url();
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        stableSince = Date.now();
        continue;
      }
      await page.evaluate(() => document.readyState);
    } catch (err) {
      if (!isNavigationError(err)) throw err;
      stableSince = Date.now();
      continue;
    }

    if (Date.now() - stableSince >= 1000) {
      logger.debug(`Navigation settled on ${lastUrl} (${Date.now() - startTime}ms)`);
      return;
    }
  }

  logger.debug(`Navigation settle timed out after 10s (last URL: ${lastUrl})`);
}

/**
 * Extract and process HTML from the page.
 * If a late redirect destroys the execution context, waits for navigation to
 * settle and retries once.
 * @param {Page} page - The Puppeteer page instance
 * @param {boolean} removeUnnecessaryHTML - Whether to clean the HTML
 * @param {string|null} [selector=null] - CSS selector to extract a DOM subtree instead of full page
 * @returns {Promise<string>} The processed HTML
 */
export async function extractAndProcessHtml(page, removeUnnecessaryHTML, selector = null) {
  let html;

  const extractFn = selector
    ? (sel) => {
        const els = document.querySelectorAll(sel);
        if (!els.length) return null;
        return Array.from(els).map(el => el.outerHTML).join('\n');
      }
    : () => document.documentElement?.outerHTML || "";

  const extractArg = selector || undefined;

  try {
    html = await page.evaluate(extractFn, extractArg);
  } catch (err) {
    if (isNavigationError(err)) {
      logger.debug('Late navigation during HTML extraction, waiting for settle...');
      await waitForNavigationToSettle(page);
      // Re-run page readiness — the new page may be a SPA that needs rendering time
      await waitForPageReady(page);
      html = await page.evaluate(extractFn, extractArg);
    } else {
      throw err;
    }
  }

  // If selector matched nothing, fall back to full page with a note
  if (selector && html === null) {
    logger.debug(`Selector "${selector}" matched no elements, falling back to full page`);
    try {
      html = await page.evaluate(() => document.documentElement?.outerHTML || "");
    } catch (err) {
      if (isNavigationError(err)) {
        await waitForNavigationToSettle(page);
        await waitForPageReady(page);
        html = await page.evaluate(() => document.documentElement?.outerHTML || "");
      } else {
        throw err;
      }
    }
    html = `<!-- selector "${selector}" matched no elements; returning full page -->\n` + html;
  }
  
  let processedHtml;
  if (removeUnnecessaryHTML) {
    const cleaned = cleanHtml(html);
    processedHtml = enrichHtml(cleaned, page.url());
  } else {
    processedHtml = enrichHtml(html, page.url());
  }
  
  // Warn when response is very large — the agent should use the selector parameter
  // to scope extraction to a DOM subtree instead of fetching the entire page.
  const htmlByteLength = new TextEncoder().encode(processedHtml).length;
  if (htmlByteLength > 500_000) {
    logger.warn(`Large HTML response (${(htmlByteLength / 1024).toFixed(0)}KB). Consider using the "selector" parameter to extract a specific DOM subtree instead of the full page.`);
  }
  
  return processedHtml;
}
