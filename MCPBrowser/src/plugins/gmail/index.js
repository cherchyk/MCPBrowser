/**
 * Gmail plugin — Site-specific automation for Gmail (mail.google.com).
 * Implements the MCPBrowser plugin interface (interfaceVersion 2).
 *
 * Uses a tiered interaction strategy (FR-011):
 *   T1: URL hash navigation for folders/search
 *   T2: Keyboard shortcuts for actions (compose, reply, archive, etc.)
 *   T3: ARIA / data attributes / name attrs for data extraction and form filling
 *   T4: CSS class selectors (last resort, centralized in selectors.js)
 */

import { ACTIONS } from './actions/index.js';
import { CorePlugin } from '../../core/plugins.js';

// ============================================================================
// MANIFEST
// ============================================================================

const manifest = {
  name: 'gmail',
  version: '1.0.0',
  description:
    'Gmail plugin for MCPBrowser — email management with hybrid UI resilience (URL navigation, keyboard shortcuts, ARIA selectors, CSS fallback)',
  interfaceVersion: 2,
  urlPatterns: ['mail.google.com'],
  domPatterns: ['div[data-ogsr-up]', '.aH2'],
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
function matchesPage(url, html) {
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
// ============================================================================
// INFO
// ============================================================================

/**
 * Return high-level plugin context for the AI agent.
 * @returns {object} PluginInfo per plugin interface contract
 */
function getInfo() {
  return {
    recommendation:
      'Manage Gmail emails — list, read, search, compose, reply, forward, archive, delete, label, and mark as read/unread.',
    description:
      'Gmail email management with hybrid UI resilience — list, read, search, compose, reply, forward, archive, delete, label, and mark emails using URL navigation (T1), keyboard shortcuts (T2), ARIA selectors (T3), and CSS fallback (T4).',
    targetPages: ['Gmail inbox (mail.google.com)'],
    authFlow:
      'User must be signed into Gmail in the browser before using plugin actions. The plugin does not handle Google account authentication.',
    actions: ACTIONS.map((action) => action.toInfo()),
  };
}

export const GMAIL_PLUGIN = new CorePlugin({ manifest, matchesPage, actions: ACTIONS, getInfo });
