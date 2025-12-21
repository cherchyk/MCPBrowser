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

async function fetchPage({ url, waitForSelector, waitUntil = "networkidle2", timeoutMs = 20000, keepPageOpen = false }) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil, timeout: timeoutMs });
    if (waitForSelector) {
      await page.waitForSelector(waitForSelector, { timeout: timeoutMs });
    }
    const text = await page.evaluate(() => document.body?.innerText || "");
    const html = await page.evaluate(() => document.documentElement?.outerHTML || "");
    return {
      success: true,
      url: page.url(),
      text: truncate(text, 200000),
      html: truncate(html, 200000),
    };
  } catch (err) {
    return { success: false, error: err.message || String(err), pageKeptOpen: keepPageOpen };
  } finally {
    if (!keepPageOpen) {
      await page.close().catch(() => {});
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
          keepPageOpen: { type: "boolean", description: "Leave the tab open so you can complete login manually" },
        },
        required: ["url"],
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
    const result = await fetchPage(args || {});
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
