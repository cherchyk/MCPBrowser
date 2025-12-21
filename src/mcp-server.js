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
  });
  return cachedBrowser;
}

async function fetchPage({
  url,
  waitForSelector,
  waitUntil = "networkidle2",
  timeoutMs = 20000,
  keepPageOpen = true,
  closeAfterSuccess = false,
  autoCloseMs = 300000,
  authWaitSelector,
  authWaitTimeoutMs,
  reuseLastKeptPage = true,
  waitForUrlPattern,
  urlPatternTimeoutMs,
  urlPatternPollMs = 1000,
}) {
  const browser = await getBrowser();
  let page = null;
  if (reuseLastKeptPage && lastKeptPage && !lastKeptPage.isClosed()) {
    page = lastKeptPage;
    await page.bringToFront().catch(() => {});
  } else {
    page = await browser.newPage();
  }

  let shouldKeepOpen = keepPageOpen || page === lastKeptPage;
  let wasSuccess = false;
  let autoCloseTimer = null;
  const scheduleAutoClose = () => {
    if (autoCloseMs && autoCloseMs > 0) {
      autoCloseTimer = setTimeout(async () => {
        try {
          await page.close();
        } catch {
          // ignore errors on timed auto-close
        }
      }, autoCloseMs);
    }
  };
  scheduleAutoClose();
  try {
    await page.goto(url, { waitUntil, timeout: timeoutMs });
    
    // Auto-detect auth redirects: if we're not on the target domain, wait for redirect back
    const targetHostname = new URL(url).hostname;
    const currentHostname = new URL(page.url()).hostname;
    const authDomains = ['login.microsoftonline.com', 'login.live.com', 'account.microsoft.com'];
    const isOnAuthPage = authDomains.some(domain => page.url().includes(domain));
    
    if (isOnAuthPage || (waitForUrlPattern && !new RegExp(waitForUrlPattern).test(page.url()))) {
      // We hit an auth page or don't match target pattern - wait for redirect
      const pattern = waitForUrlPattern ? new RegExp(waitForUrlPattern) : null;
      const pollTimeout = urlPatternTimeoutMs || 180000; // default 3 minutes
      const pollInterval = urlPatternPollMs;
      const deadline = Date.now() + pollTimeout;
      
      let matched = false;
      while (Date.now() < deadline) {
        const currentUrl = page.url();
        const currentHost = new URL(currentUrl).hostname;
        
        // Check if we're back on target domain or match the pattern
        if (pattern ? pattern.test(currentUrl) : currentHost === targetHostname) {
          matched = true;
          break;
        }
        await new Promise((r) => setTimeout(r, pollInterval));
      }
      
      if (!matched) {
        shouldKeepOpen = true;
        return {
          success: false,
          error: `Timed out waiting for authentication redirect. Current URL: ${page.url()}. Complete sign-in in the tab and re-run.`,
          pageKeptOpen: true,
          currentUrl: page.url(),
        };
      }
    }
    
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: timeoutMs });
    }
    
    if (authWaitSelector) {
      const waitTimeout = authWaitTimeoutMs || 180000; // default 3 minutes to allow manual auth
      try {
        await page.waitForSelector(authWaitSelector, { timeout: waitTimeout });
      } catch (err) {
        shouldKeepOpen = true;
        const isTimeout = puppeteer.errors?.TimeoutError && err instanceof puppeteer.errors.TimeoutError;
        if (isTimeout) {
          return {
            success: false,
            error: `Timed out waiting for auth selector '${authWaitSelector}'. Complete sign-in in the open tab, then re-run.` ,
            pageKeptOpen: true,
          };
        }
        throw err;
      }
    }
    const text = await page.evaluate(() => document.body?.innerText || "");
    const html = await page.evaluate(() => document.documentElement?.outerHTML || "");
    wasSuccess = true;
    if (keepPageOpen) {
      lastKeptPage = page;
    }
    return {
      success: true,
      url: page.url(),
      text: truncate(text, 200000),
      html: truncate(html, 200000),
    };
  } catch (err) {
    shouldKeepOpen = shouldKeepOpen || keepPageOpen;
    const hint = shouldKeepOpen
      ? "Tab is left open. Complete sign-in there, then call fetch_and_extract again with just the URL."
      : undefined;
    return { success: false, error: err.message || String(err), pageKeptOpen: shouldKeepOpen, hint };
  } finally {
    if (wasSuccess && closeAfterSuccess) {
      shouldKeepOpen = false;
    }
    if (!shouldKeepOpen && lastKeptPage === page) {
      lastKeptPage = null;
    }
    if (!shouldKeepOpen) {
      if (autoCloseTimer) clearTimeout(autoCloseTimer);
      await page.close().catch(() => {});
    } else {
      // keep tab open; autoCloseTimer will close after the configured window
    }
  }
}

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}... [truncated]` : str;
}

async function main() {
  const server = new Server({ name: "waagent-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

  const tools = [
    {
      name: "fetch_and_extract",
      description: "Fetch an authenticated page via local Chrome (DevTools) and return text+html",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string" },
          waitForSelector: { type: "string" },
          waitUntil: {
            type: "string",
            description: "Puppeteer goto waitUntil option (load, domcontentloaded, networkidle0, networkidle2)",
          },
          timeoutMs: { type: "number" },
          waitForUrlPattern: { type: "string", description: "Regex pattern for target URL; polls until URL matches (for auth redirects)" },
          urlPatternTimeoutMs: { type: "number", description: "Timeout in ms to wait for URL pattern match (default 180000)" },
          urlPatternPollMs: { type: "number", description: "Polling interval in ms when waiting for URL pattern (default 1000)" },
          authWaitSelector: { type: "string", description: "Selector that indicates you are authenticated/content ready" },
          authWaitTimeoutMs: { type: "number", description: "Timeout in ms to wait for auth selector (default 180000)" },
          keepPageOpen: { type: "boolean", description: "Leave the tab open so you can complete login manually (default: true)" },
          closeAfterSuccess: { type: "boolean", description: "Close the tab after successful fetch (default: false); failures keep the tab open" },
          autoCloseMs: { type: "number", description: "Auto-close tab after this many ms even if kept open (default: 300000 = 5 minutes)" },
          reuseLastKeptPage: { type: "boolean", description: "Reuse the last kept-open tab instead of opening a new one (default: true)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    if (name !== "fetch_and_extract") {
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
