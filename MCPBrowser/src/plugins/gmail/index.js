/**
 * Gmail plugin — Site-specific automation for Gmail (mail.google.com).
 * Implements the MCPBrowser plugin interface (interfaceVersion 1).
 *
 * Uses a tiered interaction strategy (FR-011):
 *   T1: URL hash navigation for folders/search
 *   T2: Keyboard shortcuts for actions (compose, reply, archive, etc.)
 *   T3: ARIA / data attributes / name attrs for data extraction and form filling
 *   T4: CSS class selectors (last resort, centralized in selectors.js)
 */

import { listEmails } from './actions/list-emails.js';
import { readEmail } from './actions/read-email.js';
import { searchEmails } from './actions/search-emails.js';
import { composeEmail } from './actions/compose-email.js';
import { replyEmail } from './actions/reply-email.js';
import { forwardEmail } from './actions/forward-email.js';
import { archiveEmail } from './actions/archive-email.js';
import { deleteEmail } from './actions/delete-email.js';
import { labelEmail } from './actions/label-email.js';
import { markRead } from './actions/mark-read.js';
import { markUnread } from './actions/mark-unread.js';

// ============================================================================
// MANIFEST
// ============================================================================

export const manifest = {
  name: "gmail",
  version: "1.0.0",
  description: "Gmail plugin for MCPBrowser — email management with hybrid UI resilience (URL navigation, keyboard shortcuts, ARIA selectors, CSS fallback)",
  interfaceVersion: 1,
  urlPatterns: ["mail.google.com"],
  domPatterns: ["div[data-ogsr-up]", ".aH2"]
};

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Detect whether this plugin is applicable for the given page.
 * @param {string} url - Current page URL
 * @param {string} html - Extracted page HTML
 * @returns {{ matched: boolean, confidence?: number }}
 */
export function matchesPage(url, html) {
  try {
    if (url && url.includes('mail.google.com')) {
      return { matched: true, confidence: 1.0 };
    }
    if (html && (html.includes('data-ogsr-up') || html.includes('aH2'))) {
      return { matched: true, confidence: 0.8 };
    }
    return { matched: false };
  } catch {
    return { matched: false };
  }
}

// ============================================================================
// ACTIONS
// ============================================================================

/**
 * Return the complete list of actions this plugin provides.
 * @returns {Array} ActionDescriptor[] per plugin interface contract
 */
export function getActions() {
  return [
    {
      name: "list_emails",
      description: "List visible emails from the current Gmail folder/view",
      params: [
        { name: "folder", type: "string", description: "Gmail folder: inbox, sent, drafts, trash, spam, or a label name", required: false },
        { name: "limit", type: "number", description: "Maximum number of emails to return (default: 25)", required: false, default: 25 }
      ],
      execute: listEmails
    },
    {
      name: "read_email",
      description: "Open and read a specific email by index or ID",
      params: [
        { name: "index", type: "number", description: "0-based position in current email list", required: false },
        { name: "id", type: "string", description: "Gmail internal message/thread ID", required: false }
      ],
      execute: readEmail
    },
    {
      name: "search_emails",
      description: "Search Gmail using URL hash navigation and return matching emails",
      params: [
        { name: "query", type: "string", description: "Gmail search query (supports from:, to:, subject:, has:attachment, etc.)", required: true },
        { name: "limit", type: "number", description: "Maximum results to return (default: 25)", required: false, default: 25 }
      ],
      execute: searchEmails
    },
    {
      name: "compose_email",
      description: "Open Gmail compose window via keyboard shortcut and fill in email fields",
      params: [
        { name: "to", type: "string", description: "Recipient email address", required: true },
        { name: "subject", type: "string", description: "Email subject", required: false, default: "" },
        { name: "body", type: "string", description: "Email body text", required: false, default: "" },
        { name: "cc", type: "string", description: "CC recipient email address", required: false },
        { name: "send", type: "boolean", description: "If true, send immediately via Ctrl+Enter. Default: leave as draft", required: false, default: false }
      ],
      execute: composeEmail
    },
    {
      name: "reply_email",
      description: "Reply to the currently open email thread via keyboard shortcut",
      params: [
        { name: "body", type: "string", description: "Reply body text", required: true },
        { name: "replyAll", type: "boolean", description: "If true, reply to all participants (keyboard 'a')", required: false, default: false },
        { name: "send", type: "boolean", description: "If true, send immediately via Ctrl+Enter. Default: leave as draft", required: false, default: false }
      ],
      execute: replyEmail
    },
    {
      name: "forward_email",
      description: "Forward the currently open email thread via keyboard shortcut",
      params: [
        { name: "to", type: "string", description: "Recipient email address to forward to", required: true },
        { name: "body", type: "string", description: "Additional body text above forwarded content", required: false, default: "" },
        { name: "send", type: "boolean", description: "If true, send immediately via Ctrl+Enter. Default: leave as draft", required: false, default: false }
      ],
      execute: forwardEmail
    },
    {
      name: "archive_email",
      description: "Archive an email via keyboard shortcut (remove from inbox, keep in All Mail)",
      params: [
        { name: "index", type: "number", description: "0-based index in email list", required: false },
        { name: "id", type: "string", description: "Gmail message/thread ID", required: false }
      ],
      execute: archiveEmail
    },
    {
      name: "delete_email",
      description: "Move an email to Trash via keyboard shortcut",
      params: [
        { name: "index", type: "number", description: "0-based index in email list", required: false },
        { name: "id", type: "string", description: "Gmail message/thread ID", required: false }
      ],
      execute: deleteEmail
    },
    {
      name: "label_email",
      description: "Apply a Gmail label to an email via keyboard shortcut",
      params: [
        { name: "index", type: "number", description: "0-based index in email list", required: false },
        { name: "id", type: "string", description: "Gmail message/thread ID", required: false },
        { name: "label", type: "string", description: "Label name to apply", required: true }
      ],
      execute: labelEmail
    },
    {
      name: "mark_read",
      description: "Mark an email as read via keyboard shortcut (Shift+i)",
      params: [
        { name: "index", type: "number", description: "0-based index in email list", required: false },
        { name: "id", type: "string", description: "Gmail message/thread ID", required: false }
      ],
      execute: markRead
    },
    {
      name: "mark_unread",
      description: "Mark an email as unread via keyboard shortcut (Shift+u)",
      params: [
        { name: "index", type: "number", description: "0-based index in email list", required: false },
        { name: "id", type: "string", description: "Gmail message/thread ID", required: false }
      ],
      execute: markUnread
    }
  ];
}

// ============================================================================
// INFO
// ============================================================================

/**
 * Return high-level plugin context for the AI agent.
 * @returns {object} PluginInfo per plugin interface contract
 */
export function getInfo() {
  return {
    description: "Gmail email management with hybrid UI resilience — list, read, search, compose, reply, forward, archive, delete, label, and mark emails using URL navigation (T1), keyboard shortcuts (T2), ARIA selectors (T3), and CSS fallback (T4).",
    targetPages: ["Gmail inbox (mail.google.com)"],
    authFlow: "User must be signed into Gmail in the browser before using plugin actions. The plugin does not handle Google account authentication.",
    actions: getActions().map(({ name, description, params }) => ({ name, description, params }))
  };
}
