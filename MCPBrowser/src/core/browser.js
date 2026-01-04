/**
 * Browser management for MCPBrowser
 * Generic browser interface that delegates to browser-specific implementations
 */

import { ChromeBrowser } from '../browsers/chrome.js';
import { EdgeBrowser } from '../browsers/edge.js';
import os from 'os';

// Browser state
export let cachedBrowser = null;
export let domainPages = new Map(); // hostname -> page mapping for tab reuse across domains

// Browser instances cache
const browserInstances = new Map();

/**
 * Detect the default browser on the system
 * @returns {Promise<string>} Browser type (chrome, edge)
 */
async function detectDefaultBrowser() {
  const platform = os.platform();
  
  // Priority order: Chrome > Edge
  const browsers = [
    new ChromeBrowser(),
    new EdgeBrowser()
  ];
  
  for (const browser of browsers) {
    if (await browser.isAvailable()) {
      console.error(`[MCPBrowser] Auto-detected ${browser.getType()} as default browser`);
      return browser.getType();
    }
  }
  
  // Fallback to Chrome
  console.error('[MCPBrowser] No browser detected, defaulting to Chrome');
  return 'chrome';
}

/**
 * Get a browser instance by type
 * @param {string} [type] - Browser type (chrome, edge) or empty for auto-detect
 * @returns {Promise<BaseBrowser>} Browser instance
 */
export async function GetBrowser(type = '') {
  // Auto-detect if no type specified
  if (!type || type === '') {
    type = await detectDefaultBrowser();
  }
  
  type = type.toLowerCase();
  
  // Return cached instance if exists
  if (browserInstances.has(type)) {
    return browserInstances.get(type);
  }
  
  // Create new browser instance
  let browser;
  switch (type) {
    case 'chrome':
      browser = new ChromeBrowser();
      break;
    case 'edge':
      browser = new EdgeBrowser();
      break;
    default:
      throw new Error(
        `Unsupported browser type: ${type}. ` +
        `Supported: chrome, edge. ` +
        `Leave empty for auto-detection.`
      );
  }
  
  browserInstances.set(type, browser);
  return browser;
}

/**
 * Rebuild the domain-to-page mapping from existing browser tabs.
 * This enables tab reuse across reconnections by discovering tabs that are already open.
 * Skips internal pages like about:blank and chrome:// URLs.
 * @param {Browser} browser - The puppeteer browser instance
 * @returns {Promise<void>}
 */
export async function rebuildDomainPagesMap(browser) {
  try {
    const pages = await browser.pages();
    console.error(`[MCPBrowser] Reconnected to browser with ${pages.length} existing tabs`);
    
    for (const page of pages) {
      try {
        const pageUrl = page.url();
        // Skip chrome:// pages, about:blank, and other internal pages
        if (!pageUrl || 
            pageUrl === 'about:blank' || 
            pageUrl.startsWith('chrome://') || 
            pageUrl.startsWith('chrome-extension://') ||
            pageUrl.startsWith('devtools://')) {
          continue;
        }
        
        const hostname = new URL(pageUrl).hostname;
        if (hostname && !domainPages.has(hostname)) {
          domainPages.set(hostname, page);
          console.error(`[MCPBrowser] Mapped existing tab for domain: ${hostname} (${pageUrl})`);
        }
      } catch (err) {
        // Skip pages that are inaccessible or have invalid URLs
        continue;
      }
    }
    
    if (domainPages.size > 0) {
      console.error(`[MCPBrowser] Restored ${domainPages.size} domain-to-tab mappings`);
    }
  } catch (err) {
    console.error(`[MCPBrowser] Warning: Could not rebuild domain pages map: ${err.message}`);
  }
}

/**
 * Get or create a connection to the browser.
 * Returns cached browser if still connected, otherwise establishes a new connection.
 * Rebuilds domain-to-page mapping on reconnection to enable tab reuse.
 * @param {string} [browserType] - Browser type or empty for auto-detect
 * @returns {Promise<Browser>} Connected puppeteer browser instance
 */
export async function getBrowser(browserType = '') {
  // Use environment variable if no type specified
  if (!browserType) {
    browserType = process.env.BROWSER_TYPE || '';
  }
  
  // Check if we have a valid cached browser
  if (cachedBrowser) {
    try {
      if (cachedBrowser.isConnected()) {
        return cachedBrowser;
      }
    } catch (err) {
      // Browser is invalid, reconnect
      cachedBrowser = null;
    }
  }
  
  // Get browser instance and connect
  const browserInstance = await GetBrowser(browserType);
  const result = await browserInstance.connect();
  
  cachedBrowser = result.browser;
  
  cachedBrowser.on("disconnected", () => {
    cachedBrowser = null;
    domainPages.clear(); // Clear all domain page mappings
  });
  
  // Rebuild domainPages map from existing tabs to enable reuse across reconnections
  await rebuildDomainPagesMap(cachedBrowser);
  
  return cachedBrowser;
}

/**
 * Close the browser connection and cleanup.
 * This will disconnect from the browser but leave it running.
 * Useful for cleaning up in tests.
 * @returns {Promise<void>}
 */
export async function closeBrowser() {
  if (cachedBrowser) {
    try {
      // Find the browser instance and disconnect
      for (const [type, instance] of browserInstances) {
        if (instance.browser === cachedBrowser) {
          await instance.disconnect();
          break;
        }
      }
    } catch (err) {
      // Ignore errors during cleanup
    }
    cachedBrowser = null;
  }
  domainPages.clear();
}
