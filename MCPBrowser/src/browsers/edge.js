/**
 * Microsoft Edge browser implementation for MCPBrowser
 * Edge is Chromium-based and uses the same CDP protocol as Chrome
 */

import { ChromiumBrowser } from './ChromiumBrowser.js';
import os from "os";

/**
 * Get platform-specific default paths where Edge browser is typically installed.
 * @returns {string[]} Array of possible Edge executable paths for the current platform
 */
function getDefaultEdgePaths() {
  const platform = os.platform();
  
  if (platform === "win32") {
    return [
      "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ];
  } else if (platform === "darwin") {
    return [
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];
  } else {
    return [
      "/usr/bin/microsoft-edge",
      "/usr/bin/microsoft-edge-stable",
      "/usr/bin/microsoft-edge-beta",
      "/usr/bin/microsoft-edge-dev",
      "/opt/microsoft/msedge/msedge",
    ];
  }
}

/**
 * Edge browser class implementation
 * Extends ChromiumBrowser with Edge-specific configuration
 */
export class EdgeBrowser extends ChromiumBrowser {
  constructor() {
    const config = {
      name: 'Edge',
      host: process.env.EDGE_REMOTE_DEBUG_HOST || "127.0.0.1",
      port: Number(process.env.EDGE_REMOTE_DEBUG_PORT || 9223),
      wsEndpoint: process.env.EDGE_WS_ENDPOINT,
      executablePath: process.env.EDGE_PATH,
      defaultPaths: getDefaultEdgePaths(),
      userDataDirName: 'EdgeDebug'
    };
    super(config);
  }
}

// Legacy exports for backward compatibility
export async function connectEdge() {
  const edge = new EdgeBrowser();
  return await edge.connect();
}

export async function disconnectEdge(browser) {
  if (browser && browser.isConnected()) {
    await browser.disconnect();
  }
}
