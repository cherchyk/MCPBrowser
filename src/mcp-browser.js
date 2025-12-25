#!/usr/bin/env node
import dotenv from "dotenv";
import puppeteer from "puppeteer-core";
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";

dotenv.config();

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
  const navigationTimeout = 60000; // Initial navigation timeout
  const authCompletionTimeout = 600000; // 10 minutes for user to complete authentication
  const reuseLastKeptPage = true;
  
  if (!url) {
    throw new Error("url parameter is required");
  }

  const browser = await getBrowser();
  let page = null;
  let hostname;
  
  // Parse hostname for domain-based tab reuse
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  
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

  let shouldKeepOpen = true;
  let wasSuccess = false;
  try {
    console.error(`[MCPBrowser] Navigating to: ${url}`);
    await page.goto(url, { waitUntil, timeout: navigationTimeout });
    
    const currentUrl = page.url();
    const currentHostname = new URL(currentUrl).hostname;
    
    console.error(`[MCPBrowser] Navigation completed: ${currentUrl}`);
    
    // Check if we were redirected to a different domain (likely authentication)
    if (currentHostname !== hostname) {
      console.error(`[MCPBrowser] Detected redirect to authentication domain: ${currentHostname}`);
      console.error(`[MCPBrowser] Waiting for user to complete authentication...`);
      console.error(`[MCPBrowser] Will wait up to ${authCompletionTimeout / 1000} seconds for return to ${hostname}`);
      
      // Wait for navigation back to the original domain
      const authDeadline = Date.now() + authCompletionTimeout;
      let authCompleted = false;
      
      while (Date.now() < authDeadline) {
        try {
          // Check current URL
          const checkUrl = page.url();
          const checkHostname = new URL(checkUrl).hostname;
          
          if (checkHostname === hostname) {
            console.error(`[MCPBrowser] Authentication completed! Returned to: ${checkUrl}`);
            authCompleted = true;
            break;
          }
          
          // Wait a bit before checking again
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          // Page might be navigating, continue waiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      if (!authCompleted) {
        const hint = `Authentication timeout. Tab is left open at ${page.url()}. Complete authentication and retry the same URL.`;
        return { success: false, error: "Authentication timeout - user did not complete login", pageKeptOpen: true, hint };
      }
      
      // Wait for page to fully stabilize after auth redirect
      console.error(`[MCPBrowser] Waiting for page to stabilize after authentication...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Give page time to settle
      
      // Ensure page is ready
      try {
        await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 });
      } catch {
        // Ignore timeout - page might already be ready
      }
    }
    
    // Extract HTML content
    const html = await page.evaluate(() => document.documentElement?.outerHTML || "");
    
    // Process HTML based on removeUnnecessaryHTML parameter
    let processedHtml;
    if (removeUnnecessaryHTML) {
      const cleaned = cleanHtml(html);
      processedHtml = enrichHtml(cleaned, page.url());
    } else {
      processedHtml = enrichHtml(html, page.url());
    }
    
    const result = { 
      success: true, 
      url: page.url(),
      html: processedHtml
    };
    
    wasSuccess = true;
    return result;
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
  const server = new Server({ name: "MCPBrowser", version: "0.2.25" }, { capabilities: { tools: {} } });

  const tools = [
    {
      name: "fetch_webpage_protected",
      description: "Fetches web pages by loading them in Chrome/Edge browser. Use for: (1) auth-required pages (401/403, login, SSO, corporate intranets), (2) anti-bot/crawler blocks, CAPTCHA/human verification, (3) JavaScript-heavy sites (SPAs, dynamic content).\n\nAUTH FLOW: If page requires authentication, browser opens and WAITS (up to 10 min) for user to log in, then automatically returns content once loaded. Single call returns correct content, no retry needed.\n\nRULES: (1) ONE URL at a time, never parallel. (2) Wait for full response - may take minutes for auth. (3) Skip only if 404. (4) Returns HTML with clickable links for subpage navigation.",
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
export { fetchPage, getBrowser, prepareHtml, cleanHtml, enrichHtml };

// Run the MCP server
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
