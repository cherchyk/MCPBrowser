/**
 * Chrome browser implementation for MCPBrowser
 * Uses Chrome DevTools Protocol (CDP) via puppeteer-core
 */

import { ChromiumBrowser } from './ChromiumBrowser.js';
import os from "os";

/**
 * Get platform-specific default paths where Chrome is typically installed.
 * @returns {string[]} Array of possible Chrome executable paths for the current platform
 */
function getDefaultChromePaths() {
  const platform = os.platform();
  
  if (platform === "win32") {
    return [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    ];
  } else if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
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

/**
 * Chrome browser class implementation
 * Extends ChromiumBrowser with Chrome-specific configuration
 */
export class ChromeBrowser extends ChromiumBrowser {
  constructor() {
    const config = {
      name: 'Chrome',
      host: process.env.CHROME_REMOTE_DEBUG_HOST || "127.0.0.1",
      port: Number(process.env.CHROME_REMOTE_DEBUG_PORT || 9222),
      wsEndpoint: process.env.CHROME_WS_ENDPOINT,
      executablePath: process.env.CHROME_PATH,
      defaultPaths: getDefaultChromePaths(),
      userDataDirName: 'ChromeDebug'
    };
    super(config);
  }
}

// Legacy exports for backward compatibility
export async function connectChrome() {
  const chrome = new ChromeBrowser();
  return await chrome.connect();
}

export async function disconnectChrome(browser) {
  if (browser && browser.isConnected()) {
    await browser.disconnect();
  }
}
