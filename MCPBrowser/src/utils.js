/**
 * Utility functions for MCPBrowser
 */

import { readFileSync } from 'fs';
import os from 'os';

// --- WSL Detection & Path Helpers ---

let _isWSL = null;

/**
 * Detect if running inside Windows Subsystem for Linux (WSL).
 * Result is cached after first call.
 * @returns {boolean}
 */
export function isWSL() {
  if (_isWSL === null) {
    if (os.platform() !== 'linux') {
      _isWSL = false;
    } else {
      try {
        const version = readFileSync('/proc/version', 'utf8');
        _isWSL = /microsoft|wsl/i.test(version);
      } catch {
        _isWSL = false;
      }
    }
  }
  return _isWSL;
}

/**
 * Convert a WSL mount path to a Windows path.
 * e.g. /mnt/c/Program Files/Google → C:\Program Files\Google
 * Non-WSL paths are returned unchanged.
 * @param {string} wslPath
 * @returns {string}
 */
export function wslToWindowsPath(wslPath) {
  const match = wslPath.match(/^\/mnt\/([a-zA-Z])\/(.*)/);
  if (match) {
    const drive = match[1].toUpperCase();
    const rest = match[2].replace(/\//g, '\\');
    return `${drive}:\\${rest}`;
  }
  return wslPath;
}

/**
 * Convert a Windows path to a WSL mount path.
 * e.g. C:\Users\foo → /mnt/c/Users/foo
 * @param {string} windowsPath
 * @returns {string}
 */
export function windowsPathToWSL(windowsPath) {
  return windowsPath
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
}

// --- General Utilities ---

/**
 * Truncate a string to a maximum length, adding "... [truncated]" if truncated.
 * @param {string} str - The string to truncate
 * @param {number} max - Maximum length
 * @returns {string} The original or truncated string
 */
export function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}... [truncated]` : str;
}

/**
 * Extract base domain from hostname (e.g., "mail.google.com" → "google.com")
 * @param {string} hostname - The hostname to parse
 * @returns {string} The base domain
 */
export function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}
