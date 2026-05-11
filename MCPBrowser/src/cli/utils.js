/**
 * cli/utils.js — Shared utilities for CLI output formatting and safe data access.
 */

/**
 * Convert HTML to readable terminal text (lossy preview).
 */
export function htmlToText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Safely get the primary text content from an MCP result.
 * Falls back to empty string if content is missing.
 */
export function getPrimaryText(mcp) {
  return mcp?.content?.[0]?.text ?? '';
}

/**
 * Safely get structuredContent from an MCP result.
 * Returns an empty object if missing, so callers can destructure safely.
 */
export function getStructured(mcp) {
  return mcp?.structuredContent ?? {};
}
