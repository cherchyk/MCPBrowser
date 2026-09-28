/**
 * Google Calendar plugin — Site-specific automation for Google Calendar (calendar.google.com).
 * Implements the MCPBrowser plugin interface (interfaceVersion 2).
 *
 * Uses a tiered interaction strategy (FR-011):
 *   T1: URL path navigation for views/dates
 *   T2: Keyboard shortcuts for actions (create, delete, view switches)
 *   T3: ARIA / data attributes for data extraction and form filling
 *   T4: CSS class selectors (last resort, centralized in selectors.js)
 */

import { ACTIONS } from './actions/index.js';
import { CorePlugin } from '../../core/plugins.js';

const manifest = {
  name: 'gcal',
  version: '1.0.0',
  description:
    'Google Calendar plugin for MCPBrowser — event management, scheduling, and availability with hybrid UI resilience (URL navigation, keyboard shortcuts, ARIA selectors, CSS fallback)',
  interfaceVersion: 2,
  urlPatterns: ['calendar.google.com'],
  domPatterns: ['div[role="main"]', '[data-eventchip]'],
};

function matchesPage(url, html) {
  try {
    if (url && url.includes('calendar.google.com')) {
      return { matched: true, confidence: 1.0 };
    }
    if (html && (html.includes('data-eventchip') || html.includes('data-datekey'))) {
      return { matched: true, confidence: 0.8 };
    }
    return { matched: false };
  } catch {
    return { matched: false };
  }
}

function getInfo() {
  return {
    recommendation:
      'Manage Google Calendar — list, read, create, search, edit, RSVP, delete events and check availability.',
    description:
      'Google Calendar event management with hybrid UI resilience — list, read, create, search, edit, RSVP, delete events and check availability using URL navigation (T1), keyboard shortcuts (T2), ARIA selectors (T3), and CSS fallback (T4).',
    targetPages: ['Google Calendar (calendar.google.com)'],
    authFlow:
      'User must be signed into Google Calendar in the browser before using plugin actions. Keyboard shortcuts must be enabled in Calendar Settings.',
    actions: ACTIONS.map((action) => action.toInfo()),
  };
}

export const GCAL_PLUGIN = new CorePlugin({ manifest, matchesPage, actions: ACTIONS, getInfo });
