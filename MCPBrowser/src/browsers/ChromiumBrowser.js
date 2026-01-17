/**
 * Chromium-based browser implementation for MCPBrowser
 * Base class for Chrome, Edge, Brave, and other Chromium browsers
 * All Chromium browsers use Chrome DevTools Protocol (CDP)
 */

import { BaseBrowser } from './BaseBrowser.js';
import puppeteer from 'puppeteer-core';
import { existsSync } from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

/**
 * Base class for all Chromium-based browsers
 * Provides common CDP connection and launch logic
 */
export class ChromiumBrowser extends BaseBrowser {
  /**
   * @param {Object} config - Browser configuration
   * @param {string} config.name - Browser name (e.g., 'Chrome', 'Edge')
   * @param {string} config.host - Remote debug host
   * @param {number} config.port - Remote debug port
   * @param {string} [config.wsEndpoint] - Explicit WebSocket endpoint
   * @param {string} [config.executablePath] - Explicit browser executable path
   * @param {string[]} config.defaultPaths - Default executable paths to search
   * @param {string} config.userDataDirName - User data directory name
   */
  constructor(config) {
    super();
    this.config = config;
    this.launchPromise = null;
  }

  getType() {
    return this.config.name.toLowerCase();
  }

  usesCDP() {
    return true;
  }

  /**
   * Get the default user data directory for debugging profile
   * @returns {string}
   */
  getDefaultUserDataDir() {
    const platform = os.platform();
    const home = os.homedir();
    
    if (platform === "win32") {
      return path.join(home, `AppData/Local/MCPBrowser/${this.config.userDataDirName}`);
    } else if (platform === "darwin") {
      return path.join(home, `Library/Application Support/MCPBrowser/${this.config.userDataDirName}`);
    } else {
      return path.join(home, `.config/MCPBrowser/${this.config.userDataDirName}`);
    }
  }

  /**
   * Check if DevTools is available on the configured port
   * @returns {Promise<boolean>}
   */
  async devtoolsAvailable() {
    try {
      const url = `http://${this.config.host}:${this.config.port}/json/version`;
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.webSocketDebuggerUrl);
    } catch {
      return false;
    }
  }

  /**
   * Find the browser executable path
   * @returns {string|undefined}
   */
  findExecutablePath() {
    if (this.config.executablePath && existsSync(this.config.executablePath)) {
      return this.config.executablePath;
    }
    return this.config.defaultPaths.find((p) => existsSync(p));
  }

  async isAvailable() {
    return this.findExecutablePath() !== undefined;
  }

  /**
   * Launch browser with remote debugging if not already running
   * @returns {Promise<void>}
   */
  async launchIfNeeded() {
    if (this.config.wsEndpoint) return; // Explicit endpoint provided
    
    if (await this.devtoolsAvailable()) return; // Already running
    
    if (this.launchPromise) {
      return await this.launchPromise;
    }
    
    this.launchPromise = (async () => {
      const execPath = this.findExecutablePath();
      if (!execPath) {
        throw new Error(`${this.config.name} executable not found. Searched paths: ${this.config.defaultPaths.join(', ')}`);
      }

      const userDataDir = this.getDefaultUserDataDir();
      const args = [
        `--remote-debugging-port=${this.config.port}`,
        `--user-data-dir=${userDataDir}`,
        '--no-first-run',
        '--no-default-browser-check'
      ];

      console.error(`[MCPBrowser] Launching ${this.config.name} with remote debugging on port ${this.config.port}...`);
      
      const child = spawn(execPath, args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      child.unref();

      const maxWaitTime = 20000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < maxWaitTime) {
        if (await this.devtoolsAvailable()) {
          console.error(`[MCPBrowser] ${this.config.name} is ready on port ${this.config.port}`);
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      throw new Error(`${this.config.name} did not become available within ${maxWaitTime}ms`);
    })();
    
    return await this.launchPromise;
  }

  /**
   * Resolve WebSocket endpoint URL
   * @returns {Promise<string>}
   */
  async resolveWSEndpoint() {
    if (this.config.wsEndpoint) return this.config.wsEndpoint;
    
    const url = `http://${this.config.host}:${this.config.port}/json/version`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Unable to reach ${this.config.name} devtools at ${url}: ${res.status}`);
    }
    const data = await res.json();
    if (!data.webSocketDebuggerUrl) {
      throw new Error("No webSocketDebuggerUrl in /json/version response");
    }
    return data.webSocketDebuggerUrl;
  }

  async connect() {
    await this.launchIfNeeded();
    const wsEndpoint = await this.resolveWSEndpoint();
    const browser = await puppeteer.connect({ 
      browserWSEndpoint: wsEndpoint,
      defaultViewport: null // Use full browser window, don't resize
    });
    
    this.browser = browser;
    
    return { browser };
  }

  async disconnect() {
    if (this.browser && this.browser.isConnected()) {
      await this.browser.disconnect();
    }
    this.browser = null;
  }
}
