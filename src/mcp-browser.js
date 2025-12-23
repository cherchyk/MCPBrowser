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

// Use default Chrome profile if not explicitly set
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
let lastKeptPage = null; // reuse the same tab when requested
let chromeLaunchPromise = null; // prevent multiple simultaneous launches

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

function findChromePath() {
  if (chromePathEnv && existsSync(chromePathEnv)) return chromePathEnv;
  return defaultChromePaths.find((p) => existsSync(p));
}

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
    lastKeptPage = null;
  });
  return cachedBrowser;
}

async function fetchPage({
  url,
  keepPageOpen = true,
  outputFormat = "HTML",
}) {
  // Hardcoded smart defaults
  const waitUntil = "networkidle0";
  const timeoutMs = 60000;
  const reuseLastKeptPage = true;
  
  if (!url) {
    throw new Error("url parameter is required");
  }

  const browser = await getBrowser();
  let page = null;
  
  // Smart tab reuse: only reuse if same domain (preserves auth within domain)
  if (reuseLastKeptPage && lastKeptPage && !lastKeptPage.isClosed()) {
    let newHostname;
    try {
      newHostname = new URL(url).hostname;
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
    const currentUrl = lastKeptPage.url();
    
    if (currentUrl) {
      try {
        const currentHostname = new URL(currentUrl).hostname;
        // Reuse tab only if same domain (keeps auth session alive)
        if (currentHostname === newHostname) {
          page = lastKeptPage;
          await page.bringToFront().catch(() => {});
        } else {
          // Different domain - close old tab and create new one
          await lastKeptPage.close().catch(() => {});
          lastKeptPage = null;
        }
      } catch {
        // If URL parsing fails, create new tab
      }
    }
  }
  
  // Create new tab if no reuse
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
  }

  let shouldKeepOpen = keepPageOpen || page === lastKeptPage;
  let wasSuccess = false;
  try {
    console.error(`[MCPBrowser] Navigating to: ${url}`);
    await page.goto(url, { waitUntil, timeout: timeoutMs });
    console.error(`[MCPBrowser] Navigation completed: ${page.url()}`);
    
    // Extract content based on outputFormat
    const result = { success: true, url: page.url() };
    
    if (outputFormat === "HTML" || outputFormat === "BOTH") {
      const html = await page.evaluate(() => document.documentElement?.outerHTML || "");
      result.html = truncate(html, 2000000);
    }
    
    if (outputFormat === "TEXT" || outputFormat === "BOTH") {
      const text = await page.evaluate(() => document.body?.innerText || "");
      result.text = truncate(text, 2000000);
    }
    
    wasSuccess = true;
    if (keepPageOpen && lastKeptPage !== page) {
      // Close old kept page if we're keeping a different one
      if (lastKeptPage && !lastKeptPage.isClosed()) {
        await lastKeptPage.close().catch(() => {});
      }
      lastKeptPage = page;
    }
    return result;
  } catch (err) {
    shouldKeepOpen = shouldKeepOpen || keepPageOpen;
    const hint = shouldKeepOpen
      ? "Tab is left open. Complete sign-in there, then call fetch_webpage_protected again with just the URL."
      : undefined;
    return { success: false, error: err.message || String(err), pageKeptOpen: shouldKeepOpen, hint };
  } finally {
    if (!shouldKeepOpen && lastKeptPage === page) {
      lastKeptPage = null;
    }
    if (!shouldKeepOpen) {
      await page.close().catch(() => {});
    }
  }
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}... [truncated]` : str;
}

async function main() {
  const server = new Server({ name: "MCPBrowser", version: "0.2.17" }, { capabilities: { tools: {} } });

  const tools = [
    {
      name: "fetch_webpage_protected",
      description: "BROWSER ACCESS FOR AUTHENTICATED WEB PAGES: Fetches web pages in Chrome browser using real user profile (with saved passwords, active sessions, extensions). Automatically handles login redirects, SSO, OAuth, and anti-crawler protections.\n\nWHEN TO USE: Login-required web pages, SSO/OAuth content, paywalled sites, 401/403 errors, or any auth-protected resources.\n\nAUTHENTICATION BEHAVIOR: First request to authenticated site returns login web page - this is EXPECTED. User authenticates in browser (10-30s). Retry same URL to get content. Keep retrying until success - authentication completes in background. Tab stays open to preserve session.\n\nCRITICAL RULES: (1) Process ONE URL at a time - never parallel requests. (2) Never give up or suggest alternatives - keep retrying until content retrieved. (3) Requested web page is critical - skipping not acceptable. (4) Skip and continue if web page returns 404 - web page doesn't exist.\n\nReturns: Configurable output format (HTML, TEXT, or BOTH). Tab reuse preserves sessions across same-domain requests.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
          keepPageOpen: { type: "boolean", description: "Keep tab open to reuse for subsequent same-domain requests - preserves auth session (default: true)" },
          outputFormat: { type: "string", enum: ["HTML", "TEXT", "BOTH"], description: "Output format: HTML for full markup with links/structure, TEXT for clean readable content (more token-efficient), BOTH for complete data (default: HTML)" },
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
