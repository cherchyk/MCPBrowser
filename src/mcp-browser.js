#!/usr/bin/env node
import puppeteer from "puppeteer-core";
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const chromeHost = process.env.CHROME_REMOTE_DEBUG_HOST || "127.0.0.1";
const chromePort = Number(process.env.CHROME_REMOTE_DEBUG_PORT || 9222);
const explicitWSEndpoint = process.env.CHROME_WS_ENDPOINT;

/**
 * Get the default user data directory for Chrome debugging profile.
 * Creates a dedicated profile directory to avoid conflicts with the user's main Chrome profile.
 * @returns {string} The platform-specific path to the Chrome debug profile directory
 */
function getDefaultUserDataDir() {
  const platform = os.platform();
  const home = os.homedir();
  
  // Use a dedicated debugging profile directory
  if (platform === "win32") {
    return path.join(home, "AppData/Local/MCPBrowser/ChromeDebug");
  } else if (platform === "darwin") {
    return path.join(home, "Library/Application Support/MCPBrowser/ChromeDebug");
  } else {
    return path.join(home, ".config/MCPBrowser/ChromeDebug");
  }
}

const userDataDir = process.env.CHROME_USER_DATA_DIR || getDefaultUserDataDir();
const chromePathEnv = process.env.CHROME_PATH;

/**
 * Get platform-specific default paths where Chrome/Edge browsers are typically installed.
 * @returns {string[]} Array of possible browser executable paths for the current platform
 */
function getDefaultChromePaths() {
  const platform = os.platform();
  
  if (platform === "win32") {
    return [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
      "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ];
  } else if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ];
  } else {
    return [
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
      "/usr/bin/microsoft-edge",
      "/opt/microsoft/msedge/msedge",
    ];
  }
}

const defaultChromePaths = getDefaultChromePaths();

let cachedBrowser = null;
let domainPages = new Map(); // hostname -> page mapping for tab reuse across domains
let chromeLaunchPromise = null; // prevent multiple simultaneous launches

/**
 * Check if Chrome DevTools Protocol endpoint is available and responding.
 * @returns {Promise<boolean>} True if DevTools endpoint is accessible, false otherwise
 */
async function devtoolsAvailable() {
  try {
    const url = `http://${chromeHost}:${chromePort}/json/version`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.webSocketDebuggerUrl);
  } catch {
    return false;
  }
}

/**
 * Find the Chrome/Edge executable path, checking environment variable first, then default locations.
 * @returns {string|undefined} Path to the browser executable, or undefined if not found
 */
function findChromePath() {
  if (chromePathEnv && existsSync(chromePathEnv)) return chromePathEnv;
  return defaultChromePaths.find((p) => existsSync(p));
}

/**
 * Launch Chrome with remote debugging enabled if not already running.
 * Uses a singleton pattern to prevent multiple simultaneous launches.
 * Waits up to 20 seconds for Chrome to become available on the DevTools port.
 * @returns {Promise<void>}
 * @throws {Error} If Chrome cannot be found or fails to start within timeout
 */
async function launchChromeIfNeeded() {
  if (explicitWSEndpoint) return; // user provided explicit endpoint; assume managed externally
  
  // If Chrome is already available, don't launch
  if (await devtoolsAvailable()) return;
  
  // If a launch is already in progress, wait for it
  if (chromeLaunchPromise) {
    return await chromeLaunchPromise;
  }
  
  // Create a new launch promise to prevent multiple simultaneous launches
  chromeLaunchPromise = (async () => {
    try {
      // Double-check after acquiring the launch lock
      if (await devtoolsAvailable()) return;

      const chromePath = findChromePath();
      if (!chromePath) {
        throw new Error("Chrome/Edge not found. Set CHROME_PATH to your browser executable.");
      }

      const args = [
        `--remote-debugging-port=${chromePort}`, 
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',              // Skip first run experience
        '--no-default-browser-check',  // Skip default browser check
        '--disable-sync',              // Disable Chrome sync prompts
        'about:blank'                  // Open with a blank page
      ];
      const child = spawn(chromePath, args, { detached: true, stdio: "ignore" });
      child.unref();

      // Wait for DevTools to come up
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (await devtoolsAvailable()) return;
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new Error("Chrome did not become available on DevTools port; check CHROME_PATH/port/profile.");
    } finally {
      chromeLaunchPromise = null;
    }
  })();
  
  return await chromeLaunchPromise;
}

/**
 * Resolve the WebSocket endpoint URL for connecting to Chrome DevTools Protocol.
 * Either returns the explicitly configured endpoint or queries it from the DevTools JSON API.
 * @returns {Promise<string>} The WebSocket URL for connecting to Chrome
 * @throws {Error} If unable to reach DevTools or no WebSocket URL is available
 */
async function resolveWSEndpoint() {
  if (explicitWSEndpoint) return explicitWSEndpoint;
  const url = `http://${chromeHost}:${chromePort}/json/version`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Unable to reach Chrome devtools at ${url}: ${res.status}`);
  }
  const data = await res.json();
  if (!data.webSocketDebuggerUrl) {
    throw new Error("No webSocketDebuggerUrl in /json/version response");
  }
  return data.webSocketDebuggerUrl;
}

/**
 * Rebuild the domain-to-page mapping from existing browser tabs.
 * This enables tab reuse across reconnections by discovering tabs that are already open.
 * Skips internal pages like about:blank and chrome:// URLs.
 * @param {Browser} browser - The Puppeteer browser instance
 * @returns {Promise<void>}
 */
async function rebuildDomainPagesMap(browser) {
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
 * Get or create a connection to the Chrome browser.
 * Returns cached browser if still connected, otherwise establishes a new connection.
 * Rebuilds domain-to-page mapping on reconnection to enable tab reuse.
 * @returns {Promise<Browser>} Connected Puppeteer browser instance
 */
async function getBrowser() {
  await launchChromeIfNeeded();
  if (cachedBrowser && cachedBrowser.isConnected()) return cachedBrowser;
  const wsEndpoint = await resolveWSEndpoint();
  cachedBrowser = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
    defaultViewport: null,
  });
  cachedBrowser.on("disconnected", () => {
    cachedBrowser = null;
    domainPages.clear(); // Clear all domain page mappings
  });
  
  // Rebuild domainPages map from existing tabs to enable reuse across reconnections
  await rebuildDomainPagesMap(cachedBrowser);
  
  return cachedBrowser;
}

/**
 * Extract base domain from hostname (e.g., "mail.google.com" → "google.com")
 * @param {string} hostname - The hostname to parse
 * @returns {string} The base domain
 */
function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

/**
 * Detect if URL contains authentication patterns
 * @param {string} url - The URL to check
 * @returns {boolean} True if URL appears to be auth-related
 */
function isLikelyAuthUrl(url) {
  const lowerUrl = url.toLowerCase();
  
  // Path-based patterns (more strict - require / boundaries or end of path)
  const pathPatterns = [
    '/login', '/signin', '/sign-in', '/auth', '/sso', '/oauth', 
    '/authenticate', '/saml', '/openid'
  ];
  
  // Subdomain patterns (require as subdomain at start)
  const subdomainPatterns = [
    'login.', 'auth.', 'sso.', 'accounts.', 'id.', 'identity.',
    'signin.', 'authentication.', 'idp.'
  ];
  
  // Extract path from URL
  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    // If URL parsing fails, check if any pattern exists in the string
    pathname = lowerUrl;
  }
  
  // Check path patterns - ensure they're at path boundaries
  const hasAuthPath = pathPatterns.some(pattern => {
    // Check if pattern appears at start of path, followed by nothing, /, ?, or #
    return pathname === pattern || 
           pathname.startsWith(pattern + '/') ||
           pathname.startsWith(pattern + '?') ||
           lowerUrl.includes(pattern + '#');
  });
  
  // Check subdomain patterns (must be at start of hostname)
  const hostname = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const hasAuthSubdomain = subdomainPatterns.some(pattern => hostname.startsWith(pattern));
  
  return hasAuthPath || hasAuthSubdomain;
}

/**
 * Get or create a page for the given domain, reusing existing tabs when possible.
 * @param {Browser} browser - The Puppeteer browser instance
 * @param {string} hostname - The hostname to get/create a page for
 * @param {boolean} reuseLastKeptPage - Whether to reuse existing tabs
 * @returns {Promise<Page>} The page for this domain
 */
async function getOrCreatePage(browser, hostname, reuseLastKeptPage = true) {
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
async function navigateToUrl(page, url, waitUntil, timeout) {
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
}

/**
 * Detect redirect type: permanent redirect, auth flow, or same-domain auth path change.
 * @param {string} url - Original requested URL
 * @param {string} hostname - Original hostname
 * @param {string} currentUrl - Current page URL
 * @param {string} currentHostname - Current page hostname
 * @returns {Object} Object with redirect type and related info
 */
function detectRedirectType(url, hostname, currentUrl, currentHostname) {
  const isDifferentDomain = currentHostname !== hostname;
  const requestedAuthPage = isLikelyAuthUrl(url);
  const currentIsAuthPage = isLikelyAuthUrl(currentUrl);
  const isSameDomainAuthPath = !isDifferentDomain && currentIsAuthPage && !requestedAuthPage;
  
  // If user requested auth page directly and landed on it (same domain), return content
  if (requestedAuthPage && currentHostname === hostname && !isDifferentDomain) {
    return { type: 'requested_auth', currentHostname };
  }
  
  // No redirect scenario
  if (!isDifferentDomain && !isSameDomainAuthPath) {
    return { type: 'none' };
  }
  
  const originalBase = getBaseDomain(hostname);
  const currentBase = getBaseDomain(currentHostname);
  
  // Permanent redirect: Different domain without auth patterns
  if (!currentIsAuthPage) {
    return { type: 'permanent', currentHostname };
  }
  
  // Authentication flow
  const flowType = isSameDomainAuthPath ? 'same-domain path change' : 'cross-domain redirect';
  return { 
    type: 'auth', 
    flowType, 
    originalBase, 
    currentBase, 
    currentUrl,
    hostname,
    currentHostname
  };
}

/**
 * Check if authentication auto-completes quickly (valid session/cookies).
 * @param {Page} page - The Puppeteer page instance
 * @param {string} hostname - Original hostname
 * @param {string} originalBase - Original base domain
 * @param {number} timeoutMs - How long to wait for auto-auth
 * @returns {Promise<Object>} Object with success status and final hostname
 */
async function waitForAutoAuth(page, hostname, originalBase, timeoutMs = 5000) {
  console.error(`[MCPBrowser] Checking for auto-authentication (${timeoutMs / 1000} sec)...`);
  
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    try {
      const checkUrl = page.url();
      const checkHostname = new URL(checkUrl).hostname;
      const checkBase = getBaseDomain(checkHostname);
      
      // Check if returned to original domain/base and no longer on auth URL
      if ((checkHostname === hostname || checkBase === originalBase) && !isLikelyAuthUrl(checkUrl)) {
        console.error(`[MCPBrowser] Auto-authentication successful! Now at: ${checkUrl}`);
        return { success: true, hostname: checkHostname };
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return { success: false };
}

/**
 * Wait for user to complete manual authentication.
 * @param {Page} page - The Puppeteer page instance
 * @param {string} hostname - Original hostname
 * @param {string} originalBase - Original base domain
 * @param {number} timeoutMs - How long to wait for manual auth
 * @returns {Promise<Object>} Object with success status, final hostname, and optional error
 */
async function waitForManualAuth(page, hostname, originalBase, timeoutMs = 600000) {
  console.error(`[MCPBrowser] Auto-authentication did not complete. Waiting for user...`);
  console.error(`[MCPBrowser] Will wait for return to ${hostname} or same base domain (${originalBase})`);
  
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    try {
      const checkUrl = page.url();
      const checkHostname = new URL(checkUrl).hostname;
      const checkBase = getBaseDomain(checkHostname);
      
      // Auth complete if back to original domain OR same base domain AND not on auth page
      if ((checkHostname === hostname || checkBase === originalBase) && !isLikelyAuthUrl(checkUrl)) {
        console.error(`[MCPBrowser] Authentication completed! Now at: ${checkUrl}`);
        
        if (checkHostname !== hostname) {
          console.error(`[MCPBrowser] Landed on different subdomain: ${checkHostname}`);
        }
        
        return { success: true, hostname: checkHostname };
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const currentUrl = page.url();
  const hint = `Authentication timeout. Tab is left open at ${currentUrl}. Complete authentication and retry the same URL.`;
  return { 
    success: false, 
    error: "Authentication timeout - user did not complete login",
    hint 
  };
}

/**
 * Wait for page to stabilize after authentication.
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<void>}
 */
async function waitForPageStability(page) {
  console.error(`[MCPBrowser] Waiting for page to stabilize...`);
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
  } catch {
    // Ignore timeout - page might already be ready
  }
}

/**
 * Extract and process HTML from the page.
 * @param {Page} page - The Puppeteer page instance
 * @param {boolean} removeUnnecessaryHTML - Whether to clean the HTML
 * @returns {Promise<string>} The processed HTML
 */
async function extractAndProcessHtml(page, removeUnnecessaryHTML) {
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

/**
 * Fetch a web page using Chrome browser, with support for authentication flows and tab reuse.
 * Reuses existing tabs per domain when possible. Handles authentication redirects by waiting
 * for user to complete login (up to 10 minutes). Processes HTML to remove unnecessary elements
 * and convert relative URLs to absolute.
 * @param {Object} params - Fetch parameters
 * @param {string} params.url - The URL to fetch
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML (removes scripts, styles, etc.)
 * @returns {Promise<Object>} Result object with success status, URL, HTML content, or error details
 */
async function fetchPage({ url, removeUnnecessaryHTML = true }) {
  // Hardcoded smart defaults
  const waitUntil = "networkidle0";
  const navigationTimeout = 60000;
  const authCompletionTimeout = 600000;
  const reuseLastKeptPage = true;
  
  if (!url) {
    throw new Error("url parameter is required");
  }

  // Parse hostname for domain-based tab reuse
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const browser = await getBrowser();
  let page = null;
  
  try {
    // Get or create page for this domain
    page = await getOrCreatePage(browser, hostname, reuseLastKeptPage);
    
    // Navigate to URL with fallback strategy
    await navigateToUrl(page, url, waitUntil, navigationTimeout);
    
    const currentUrl = page.url();
    const currentHostname = new URL(currentUrl).hostname;
    console.error(`[MCPBrowser] Navigation completed: ${currentUrl}`);
    
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
      console.error(`[MCPBrowser] Accepting redirect and updating domain mapping`);
      domainPages.delete(hostname);
      domainPages.set(redirectInfo.currentHostname, page);
      hostname = redirectInfo.currentHostname;
    } else if (redirectInfo.type === 'auth') {
      console.error(`[MCPBrowser] Authentication flow detected (${redirectInfo.flowType})`);
      console.error(`[MCPBrowser] Current location: ${redirectInfo.currentUrl}`);
      
      // Try auto-auth first
      const autoAuthResult = await waitForAutoAuth(page, redirectInfo.hostname, redirectInfo.originalBase);
      
      if (autoAuthResult.success) {
        // Update hostname if changed
        if (autoAuthResult.hostname !== hostname) {
          domainPages.delete(hostname);
          domainPages.set(autoAuthResult.hostname, page);
          hostname = autoAuthResult.hostname;
        }
      } else {
        // Wait for manual auth
        const manualAuthResult = await waitForManualAuth(page, redirectInfo.hostname, redirectInfo.originalBase, authCompletionTimeout);
        
        if (!manualAuthResult.success) {
          return { 
            success: false, 
            error: manualAuthResult.error, 
            pageKeptOpen: true, 
            hint: manualAuthResult.hint 
          };
        }
        
        // Update hostname if changed
        if (manualAuthResult.hostname !== hostname) {
          domainPages.delete(hostname);
          domainPages.set(manualAuthResult.hostname, page);
          hostname = manualAuthResult.hostname;
        }
      }
      
      // Wait for page stability after auth
      await waitForPageStability(page);
    }
    
    // Extract and process HTML
    const processedHtml = await extractAndProcessHtml(page, removeUnnecessaryHTML);
    
    return { 
      success: true, 
      url: page.url(),
      html: processedHtml
    };
  } catch (err) {
    const hint = "Tab is left open. Complete sign-in there, then call fetch_webpage_protected again with just the URL.";
    return { success: false, error: err.message || String(err), pageKeptOpen: true, hint };
  } finally {
    // Tab always stays open - domain-aware reuse handles cleanup
  }
}

/**
 * Truncate a string to a maximum length, adding "... [truncated]" if truncated.
 * @param {string} str - The string to truncate
 * @param {number} max - Maximum length
 * @returns {string} The original or truncated string
 */
function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}... [truncated]` : str;
}

/**
 * Removes non-content elements and attributes from HTML:
 * 1. Removing non-content elements (scripts, styles, meta tags, comments)
 * 2. Removing code-related attributes (class, id, style, data-*, event handlers)
 * 3. Removing SVG graphics and other non-text elements
 * 4. Collapsing excessive whitespace
 */
function cleanHtml(html) {
  if (!html) return "";
  
  let cleaned = html;
  
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove script tags and their content
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their content
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove noscript tags and their content
  cleaned = cleaned.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  
  // Remove SVG tags and their content (often large, not useful for text)
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  
  // Remove meta tags
  cleaned = cleaned.replace(/<meta\b[^>]*>/gi, '');
  
  // Remove link tags (stylesheets, preload, etc.)
  cleaned = cleaned.replace(/<link\b[^>]*>/gi, '');
  
  // Remove inline style attributes
  cleaned = cleaned.replace(/\s+style=["'][^"']*["']/gi, '');
  
  // Remove class attributes
  cleaned = cleaned.replace(/\s+class=["'][^"']*["']/gi, '');
  
  // Remove id attributes
  cleaned = cleaned.replace(/\s+id=["'][^"']*["']/gi, '');
  
  // Remove data-* attributes
  cleaned = cleaned.replace(/\s+data-[a-z0-9-]+=["'][^"']*["']/gi, '');
  
  // Remove event handler attributes (onclick, onload, etc.)
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove role attributes
  cleaned = cleaned.replace(/\s+role=["'][^"']*["']/gi, '');
  
  // Remove aria-* attributes
  cleaned = cleaned.replace(/\s+aria-[a-z0-9-]+=["'][^"']*["']/gi, '');
  
  // Collapse multiple whitespace/newlines into single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Remove spaces between tags
  cleaned = cleaned.replace(/>\s+</g, '><');
  
  return cleaned;
}

/**
 * Enriches HTML by converting relative URLs to absolute URLs
 */
function enrichHtml(html, baseUrl) {
  if (!html) return "";
  
  let enriched = html;
  
  // Convert relative URLs to absolute in href attributes
  enriched = enriched.replace(/href=["']([^"']+)["']/gi, (match, url) => {
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return match;
    }
    try {
      const absoluteUrl = new URL(url, baseUrl).href;
      return `href="${absoluteUrl}"`;
    } catch {
      return match;
    }
  });
  
  // Convert relative URLs to absolute in src attributes
  enriched = enriched.replace(/src=["']([^"']+)["']/gi, (match, url) => {
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('data:')) {
      return match;
    }
    try {
      const absoluteUrl = new URL(url, baseUrl).href;
      return `src="${absoluteUrl}"`;
    } catch {
      return match;
    }
  });
  
  return enriched;
}

/**
 * Prepares HTML for consumption by cleaning and enriching it.
 * @deprecated Use cleanHtml and enrichHtml separately for better control
 */
function prepareHtml(html, baseUrl) {
  if (!html) return "";
  const cleaned = cleanHtml(html);
  return enrichHtml(cleaned, baseUrl);
}

/**
 * Main entry point for the MCP server.
 * Sets up the Model Context Protocol server with fetch_webpage_protected tool,
 * configures request handlers, and starts the stdio transport.
 * @returns {Promise<void>}
 */
async function main() {
  const server = new Server({ name: "MCPBrowser", version: "0.2.26" }, { capabilities: { tools: {} } });

  const tools = [
    {
      name: "fetch_webpage_protected",
      description: "Fetches web pages using Chrome/Edge browser. Handles auth-required pages, CAPTCHA, SSO, anti-bot protection, and JavaScript-heavy sites.\n\nWaits for user interaction (login, CAPTCHA) if needed, then returns content automatically.\n\nIMPORTANT: Call ONE URL at a time only. Never parallel - causes conflicts. Wait for completion before next URL.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
          removeUnnecessaryHTML: { type: "boolean", description: "Remove Unnecessary HTML for size reduction by 90%.", default: true }
        },
        required: ["url"],
        additionalProperties: false,
      },
      annotations: {
        title: "Fetch Protected Web Page"
      }
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name !== "fetch_webpage_protected") {
      throw new Error(`Unknown tool: ${name}`);
    }
    const safeArgs = args || {};
    const fallbackUrl = process.env.DEFAULT_FETCH_URL || process.env.MCP_DEFAULT_FETCH_URL;
    if (!safeArgs.url) {
      if (fallbackUrl) {
        safeArgs.url = fallbackUrl;
      } else {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: false, error: "Missing url and no DEFAULT_FETCH_URL/MCP_DEFAULT_FETCH_URL configured" }),
            },
          ],
        };
      }
    }

    const result = await fetchPage(safeArgs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Export for testing
export { 
  fetchPage, 
  getBrowser, 
  prepareHtml, 
  cleanHtml, 
  enrichHtml,
  getOrCreatePage,
  navigateToUrl,
  detectRedirectType,
  waitForAutoAuth,
  waitForManualAuth,
  waitForPageStability,
  extractAndProcessHtml,
  getBaseDomain,
  isLikelyAuthUrl
};

// Run the MCP server only if this is the main module (not imported for testing)
import { fileURLToPath } from 'url';
if (import.meta.url === new URL(process.argv[1], 'file://').href || 
    fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
