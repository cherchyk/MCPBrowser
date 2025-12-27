/**
 * Page management for MCPBrowser
 */

import { domainPages } from './browser.js';
import { cleanHtml, enrichHtml } from './html.js';

/**
 * Get or create a page for the given domain, reusing existing tabs when possible.
 * @param {Browser} browser - The Puppeteer browser instance
 * @param {string} hostname - The hostname to get/create a page for
 * @param {boolean} reuseLastKeptPage - Whether to reuse existing tabs
 * @returns {Promise<Page>} The page for this domain
 */
export async function getOrCreatePage(browser, hostname, reuseLastKeptPage = true) {
  let page = null;
  
  // Check if we have an existing page for this domain
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
 * Navigate to URL with fallback strategy for slow pages.
 * @param {Page} page - The Puppeteer page instance
 * @param {string} url - The URL to navigate to
 * @param {string} waitUntil - Wait condition (networkidle0, load, etc.)
 * @param {number} timeout - Navigation timeout in ms
 * @returns {Promise<void>}
 */
export async function navigateToUrl(page, url, waitUntil, timeout) {
  console.error(`[MCPBrowser] Navigating to: ${url}`);
  
  // Set up listener for JS-based redirects that happen after page load
  let jsRedirectDetected = false;
  let jsRedirectUrl = null;
  const navigationHandler = (frame) => {
    if (frame === page.mainFrame()) {
      jsRedirectUrl = frame.url();
      jsRedirectDetected = true;
    }
  };
  page.on('framenavigated', navigationHandler);
  
  try {
    // Handle slow pages: try networkidle0 first, fallback to load if it takes too long
    try {
      await page.goto(url, { waitUntil, timeout });
    } catch (error) {
      // If networkidle0 times out or page has issues, try with just 'load'
      if (error.message.includes('timeout') || error.message.includes('Navigation')) {
        console.error(`[MCPBrowser] Navigation slow, trying fallback load strategy...`);
        await page.goto(url, { waitUntil: 'load', timeout });
      } else {
        throw error;
      }
    }
    
    // Wait briefly for potential JS redirects
    await new Promise(resolve => setTimeout(resolve, 2000));
  } finally {
    // Remove navigation listener
    page.off('framenavigated', navigationHandler);
  }
  
  console.error(`[MCPBrowser] Navigation completed: ${page.url()}`);
}

/**
 * Wait for page to stabilize after authentication.
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<void>}
 */
export async function waitForPageStability(page) {
  console.error(`[MCPBrowser] Waiting for page to stabilize...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    await page.waitForNetworkIdle({ timeout: 5000 });
  } catch {
    // Ignore timeout - page may have long-polling or websockets
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
