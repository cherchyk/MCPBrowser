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
const userDataDir = process.env.CHROME_USER_DATA_DIR || path.join(os.homedir(), "AppData/Local/ChromeAuthProfile");
const chromePathEnv = process.env.CHROME_PATH;
const defaultChromePaths = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

let cachedBrowser = null;
let lastKeptPage = null; // reuse the same tab when requested

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
  if (await devtoolsAvailable()) return;

  const chromePath = findChromePath();
  if (!chromePath) {
    throw new Error("Chrome/Edge not found. Set CHROME_PATH to your browser executable.");
  }

  const args = [`--remote-debugging-port=${chromePort}`, `--user-data-dir=${userDataDir}`];
  const child = spawn(chromePath, args, { detached: true, stdio: "ignore" });
  child.unref();

  // Wait for DevTools to come up
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (await devtoolsAvailable()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Chrome did not become available on DevTools port; check CHROME_PATH/port/profile.");
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
    page = await browser.newPage();
  }

  let shouldKeepOpen = keepPageOpen || page === lastKeptPage;
  let wasSuccess = false;
  try {
    await page.goto(url, { waitUntil, timeout: timeoutMs });
    
    // Extract content
    const text = await page.evaluate(() => document.body?.innerText || "");
    const html = await page.evaluate(() => document.documentElement?.outerHTML || "");
    wasSuccess = true;
    if (keepPageOpen && lastKeptPage !== page) {
      // Close old kept page if we're keeping a different one
      if (lastKeptPage && !lastKeptPage.isClosed()) {
        await lastKeptPage.close().catch(() => {});
      }
      lastKeptPage = page;
    }
    return {
      success: true,
      url: page.url(),
      text: truncate(text, 2000000),
      html: truncate(html, 2000000),
    };
  } catch (err) {
    shouldKeepOpen = shouldKeepOpen || keepPageOpen;
    const hint = shouldKeepOpen
      ? "Tab is left open. Complete sign-in there, then call load_and_extract again with just the URL."
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
  const server = new Server({ name: "MCPBrowser", version: "0.2.0" }, { capabilities: { tools: {} } });

  const tools = [
    {
      name: "load_and_extract",
      description: "**FALLBACK MECHANISM**: Use this when normal URL fetching fails due to authentication requirements, login redirects, 401/403 errors, anti-crawler/bot detection, or session requirements. Loads web pages using your authenticated Chrome/Edge browser session via DevTools Protocol, bypassing auth and crawler restrictions. Automatically handles auth redirects, waits for network idle, and supports tab reuse to preserve sessions. Returns both plain text and HTML content.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
          keepPageOpen: { type: "boolean", description: "Keep the tab open after fetching for manual auth or reuse (default: true)" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name !== "load_and_extract") {
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
