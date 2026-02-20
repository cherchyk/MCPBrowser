/**
 * Brave browser implementation for MCPBrowser
 * Brave is Chromium-based and uses the same CDP protocol as Chrome
 */

import { ChromiumBrowser } from './ChromiumBrowser.js';
import os from "os";
import { isWSL } from '../utils.js';

/**
 * Get platform-specific default paths where Brave browser is typically installed.
 * When running under WSL, Windows-side paths (via /mnt/c/) are also included.
 * @returns {string[]} Array of possible Brave executable paths for the current platform
 */
function getDefaultBravePaths() {
  const platform = os.platform();
  
  if (platform === "win32") {
    return [
      "C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
      "C:/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
      `${os.homedir()}/AppData/Local/BraveSoftware/Brave-Browser/Application/brave.exe`,
    ];
  } else if (platform === "darwin") {
    return [
      "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    ];
  } else {
    const paths = [
      "/usr/bin/brave",
      "/usr/bin/brave-browser",
      "/usr/bin/brave-browser-stable",
      "/opt/brave.com/brave/brave-browser",
      "/snap/bin/brave",
    ];
    // In WSL, also look for Windows-side Brave via /mnt/c/
    if (isWSL()) {
      paths.push(
        "/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe",
        "/mnt/c/Program Files (x86)/BraveSoftware/Brave-Browser/Application/brave.exe",
      );
    }
    return paths;
  }
}

/**
 * Brave browser class implementation
 * Extends ChromiumBrowser with Brave-specific configuration
 */
export class BraveBrowser extends ChromiumBrowser {
  constructor() {
    const config = {
      name: 'Brave',
      host: process.env.BRAVE_REMOTE_DEBUG_HOST || "127.0.0.1",
      port: Number(process.env.BRAVE_REMOTE_DEBUG_PORT || 9224),
      wsEndpoint: process.env.BRAVE_WS_ENDPOINT,
      executablePath: process.env.BRAVE_PATH,
      defaultPaths: getDefaultBravePaths(),
      userDataDirName: 'BraveDebug'
    };
    super(config);
  }
}

// Legacy exports for backward compatibility
export async function connectBrave() {
  const brave = new BraveBrowser();
  return await brave.connect();
}

export async function disconnectBrave(browser) {
  if (browser && browser.isConnected()) {
    await browser.disconnect();
  }
}
