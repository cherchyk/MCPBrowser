/**
 * Browser management for MCPBrowser
 */

import puppeteer from "puppeteer-core";
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

// Environment configuration
const chromeHost = process.env.CHROME_REMOTE_DEBUG_HOST || "127.0.0.1";
const chromePort = Number(process.env.CHROME_REMOTE_DEBUG_PORT || 9222);
const explicitWSEndpoint = process.env.CHROME_WS_ENDPOINT;
const chromePathEnv = process.env.CHROME_PATH;

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

export const userDataDir = process.env.CHROME_USER_DATA_DIR || getDefaultUserDataDir();

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

// Browser state
export let cachedBrowser = null;
export let domainPages = new Map(); // hostname -> page mapping for tab reuse across domains
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
 * Get or create a connection to the Chrome browser.
 * Returns cached browser if still connected, otherwise establishes a new connection.
 * Rebuilds domain-to-page mapping on reconnection to enable tab reuse.
 * @returns {Promise<Browser>} Connected Puppeteer browser instance
 */
export async function getBrowser() {
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
 * Close the browser connection and cleanup.
 * This will disconnect from the browser but leave Chrome running.
 * Useful for cleaning up in tests.
 * @returns {Promise<void>}
 */
export async function closeBrowser() {
  if (cachedBrowser && cachedBrowser.isConnected()) {
    await cachedBrowser.disconnect();
    cachedBrowser = null;
  }
  domainPages.clear();
}
