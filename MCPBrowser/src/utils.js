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

function byteLength(str) {
  return new TextEncoder().encode(str).length;
}

function safeStringify(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, val) => {
    if (typeof val === 'function' || typeof val === 'symbol') return undefined;
    if (typeof val === 'bigint') return val.toString();
    if (val && typeof val === 'object') {
      if (seen.has(val)) return '[Circular]';
      seen.add(val);
    }
    return val;
  });
}

/**
 * Serialize a JS value for MCP responses with size and safety guards.
 * Returns JSON-safe payload, detected type, and truncation flag.
 * @param {any} value
 * @param {object} options
 * @param {number} [options.maxBytes=100000]
 * @returns {{ result: any, type: string, truncated: boolean }}
 */
export function serializeExecutionResult(value, { maxBytes = 100_000 } = {}) {
  let type = Array.isArray(value) ? 'array' : (value === null ? 'null' : typeof value);
  let jsonString;

  if (type === 'string') {
    jsonString = String(value);
  } else {
    try {
      jsonString = safeStringify(value);
    } catch (err) {
      jsonString = String(value);
      type = 'string';
    }
  }

  let truncated = false;
  if (byteLength(jsonString) > maxBytes) {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const sliced = encoder.encode(jsonString).slice(0, maxBytes);
    jsonString = `${decoder.decode(sliced)}...[truncated]`;
    truncated = true;
    type = 'string';
  }

  let parsed = value;
  if (type === 'object' || type === 'array' || type === 'null') {
    try {
      parsed = JSON.parse(jsonString);
    } catch {
      parsed = jsonString;
      type = 'string';
    }
  } else if (type === 'string') {
    parsed = jsonString;
  }

  return { result: parsed, type, truncated };
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
