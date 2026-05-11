/**
 * helpers.js — Shared tiered utilities for the Google Calendar plugin.
 *
 * Provides URL-based navigation (T1), keyboard shortcut verification (T2),
 * ARIA/data-attr DOM utilities (T3), and CSS-selector data extraction (T4).
 *
 * All helpers are stateless — they inspect the page at invocation time
 * per FR-017. No internal state is maintained between calls.
 */

import { MCPResponse } from '../../core/responses.js';
import * as sel from './selectors.js';
import logger from '../../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum wait time for dynamic content (FR-012). */
export const DEFAULT_TIMEOUT = 10_000;

/** Calendar view states detected by detectView(). */
export const VIEW = Object.freeze({
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
  SCHEDULE: 'schedule',
  CUSTOM: 'custom',
  EVENT_DETAIL: 'event_detail',
  EVENT_FORM: 'event_form',
  SEARCH_RESULTS: 'search_results',
  LOADING: 'loading',
  NOT_CALENDAR: 'not_calendar',
  NOT_READY: 'not_ready'
});

/** Map param view names to URL path segments. */
const VIEW_TO_PATH = {
  day: 'day',
  week: 'week',
  month: 'month',
  schedule: 'agenda',
  custom: 'customday'
};

// ============================================================================
// T1: URL-BASED NAVIGATION (FR-019)
// ============================================================================

/**
 * Extract the Google account index (/u/N/) from a URL.
 * Returns '0' if not found. Shared with Gmail plugin pattern.
 */
export function getAccountIndex(url) {
  const match = url.match(/\/u\/(\d+)\//);
  return match ? match[1] : '0';
}

/**
 * Navigate Google Calendar to a specific path while preserving account index.
 * @param {import('puppeteer').Page} page
 * @param {string} path — e.g. 'r/day/2026/4/6', 'r/week', 'r/search'
 */
export async function calendarNavigate(page, path) {
  const currentUrl = page.url();
  const accountIndex = getAccountIndex(currentUrl);
  const targetUrl = `https://calendar.google.com/calendar/u/${accountIndex}/${path}`;
  logger.debug(`calendarNavigate: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });
}

/**
 * Build url path for a date in a given view.
 * @param {string} view — 'day', 'week', 'month'
 * @param {string} [date] — ISO date string, e.g. '2026-04-10'
 * @returns {string} path segment, e.g. 'r/day/2026/4/10'
 */
export function buildViewPath(view, date) {
  const pathView = VIEW_TO_PATH[view] || view;
  if (date) {
    // Parse ISO date string directly to avoid timezone issues
    const parts = date.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    return `r/${pathView}/${y}/${m}/${day}`;
  }
  return `r/${pathView}`;
}

// ============================================================================
// VIEW DETECTION (FR-017, FR-024 — URL path primary, DOM fallback)
// ============================================================================

/**
 * Detect the current Google Calendar view from URL and DOM.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<string>} One of the VIEW enum values.
 */
export async function detectView(page) {
  const url = page.url();

  if (!url.includes('calendar.google.com')) {
    logger.debug('detectView: not Calendar');
    return VIEW.NOT_CALENDAR;
  }

  // Check for interstitials / CAPTCHAs
  const hasInterstitial = await page.evaluate(() => {
    const body = document.body?.textContent || '';
    return body.includes('Confirm it') ||
           !!document.querySelector('iframe[src*="accounts.google.com"]') ||
           !!document.querySelector('#captcha');
  });
  if (hasInterstitial) {
    logger.debug('detectView: not_ready (interstitial/CAPTCHA)');
    return VIEW.NOT_READY;
  }

  // URL path-based detection (primary signal)
  const pathMatch = url.match(/\/r\/([a-z]+)/i);
  const pathSegment = pathMatch ? pathMatch[1].toLowerCase() : '';

  if (pathSegment === 'eventedit') {
    logger.debug('detectView: event_form');
    return VIEW.EVENT_FORM;
  }
  if (pathSegment === 'search') {
    logger.debug('detectView: search_results');
    return VIEW.SEARCH_RESULTS;
  }
  if (pathSegment === 'day') {
    logger.debug('detectView: day');
    return VIEW.DAY;
  }
  if (pathSegment === 'week') {
    logger.debug('detectView: week');
    return VIEW.WEEK;
  }
  if (pathSegment === 'month') {
    logger.debug('detectView: month');
    return VIEW.MONTH;
  }
  if (pathSegment === 'agenda' || pathSegment === 'list') {
    logger.debug('detectView: schedule');
    return VIEW.SCHEDULE;
  }
  if (pathSegment === 'customday') {
    logger.debug('detectView: custom');
    return VIEW.CUSTOM;
  }

  // Check for event detail dialog overlay
  const hasEventDialog = await page.evaluate(() =>
    !!document.querySelector('div[role="dialog"]')
  );
  if (hasEventDialog) {
    logger.debug('detectView: event_detail (dialog overlay)');
    return VIEW.EVENT_DETAIL;
  }

  // Default calendar view (e.g. /r or /r/)
  const hasMain = await page.evaluate(() =>
    !!document.querySelector('div[role="main"]')
  );
  if (hasMain) {
    logger.debug('detectView: week (default fallback)');
    return VIEW.WEEK;
  }

  logger.debug('detectView: loading (no main container)');
  return VIEW.LOADING;
}

// ============================================================================
// T2: KEYBOARD SHORTCUT VERIFICATION (FR-018)
// ============================================================================

/**
 * Check if Google Calendar keyboard shortcuts are enabled by sending '?'.
 * @param {import('puppeteer').Page} page
 * @returns {Promise<{enabled: boolean, error?: string}>}
 */
export async function checkKeyboardShortcuts(page) {
  try {
    // Ensure nothing is focused that would swallow the keystroke
    await page.evaluate(() => {
      if (document.activeElement && document.activeElement.tagName !== 'BODY') {
        document.activeElement.blur();
      }
    });

    await page.keyboard.down('Shift');
    await page.keyboard.press('/');
    await page.keyboard.up('Shift');

    const dialog = await page.waitForSelector(
      'div[role="dialog"]',
      { timeout: 2000 }
    ).catch(() => null);

    if (dialog) {
      await page.keyboard.press('Escape');
      return { enabled: true };
    }

    return {
      enabled: false,
      error: 'Google Calendar keyboard shortcuts are not enabled. Enable them in Calendar Settings → Keyboard shortcuts → Enable keyboard shortcuts.'
    };
  } catch {
    return {
      enabled: false,
      error: 'Could not verify Google Calendar keyboard shortcuts. Ensure Calendar is fully loaded.'
    };
  }
}

// ============================================================================
// PRECONDITION CHECKING (FR-022)
// ============================================================================

/**
 * Check a precondition before performing an action.
 * @param {import('puppeteer').Page} page
 * @param {string} requirement — 'on_calendar', 'event_visible', 'list_view'
 * @returns {Promise<{met: boolean, error?: string, suggestion?: string}>}
 */
export async function checkPrecondition(page, requirement) {
  const url = page.url();

  switch (requirement) {
    case 'on_calendar': {
      if (!url.includes('calendar.google.com')) {
        return {
          met: false,
          error: 'Google Calendar is not the active page.',
          suggestion: "Use browser_fetch_webpage({ url: 'https://calendar.google.com' }) to navigate to Google Calendar first."
        };
      }
      return { met: true };
    }

    case 'event_visible': {
      const view = await detectView(page);
      if (view === VIEW.NOT_CALENDAR || view === VIEW.NOT_READY || view === VIEW.LOADING) {
        return {
          met: false,
          error: 'Google Calendar is not ready.',
          suggestion: "Use browser_fetch_webpage({ url: 'https://calendar.google.com' }) to navigate to Google Calendar."
        };
      }
      return { met: true };
    }

    case 'list_view': {
      const view = await detectView(page);
      const isListView = [VIEW.DAY, VIEW.WEEK, VIEW.MONTH, VIEW.SCHEDULE, VIEW.CUSTOM, VIEW.SEARCH_RESULTS].includes(view);
      if (!isListView) {
        return {
          met: false,
          error: 'Not in a calendar view with visible events.',
          suggestion: "Use list_events to navigate to a calendar view."
        };
      }
      return { met: true };
    }

    default:
      return { met: false, error: `Unknown precondition: ${requirement}` };
  }
}

// ============================================================================
// CONTENT WAITING (FR-012 — 10s timeout with diagnostics)
// ============================================================================

/**
 * Wait for a selector to appear on the page.
 * @param {import('puppeteer').Page} page
 * @param {string} selector
 * @param {number} [timeout=DEFAULT_TIMEOUT]
 */
export async function waitForCalendar(page, selector, timeout = DEFAULT_TIMEOUT) {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch {
    throw new Error(
      `Google Calendar content did not load within ${timeout}ms. ` +
      `Selector that failed: "${selector}". ` +
      `The page may still be loading or Calendar's UI may have changed.`
    );
  }
}

// ============================================================================
// EVENT SELECTION — Hybrid DOM+keyboard (FR-016)
// ============================================================================

/**
 * Select (click) an event by index or event ID.
 * @param {import('puppeteer').Page} page
 * @param {{index?: number, id?: string}} options
 * @returns {Promise<{selected: boolean, error?: string}>}
 */
export async function selectEvent(page, { index, id } = {}) {
  // Try by event ID first (more stable)
  if (id !== undefined && id !== null) {
    const event = await page.$(`[data-eventid="${id}"]`);
    if (event) {
      await event.click();
      logger.debug(`selectEvent: selected by ID "${id}"`);
      return { selected: true };
    }
    logger.debug(`selectEvent: ID "${id}" not found, trying index fallback`);
  }

  // Fall back to index-based selection
  if (index !== undefined && index !== null) {
    const events = await page.$$(sel.EVENT_CHIP);
    if (index >= 0 && index < events.length) {
      await events[index].click();
      logger.debug(`selectEvent: selected by index ${index}`);
      return { selected: true };
    }
    return {
      selected: false,
      error: `Event index ${index} is out of range. The current view has ${events.length} events (indices 0-${events.length - 1}). Use list_events to refresh.`
    };
  }

  return { selected: false, error: 'No index or id provided for event selection.' };
}

// ============================================================================
// EVENT EXTRACTION — T3+T4 data extraction
// ============================================================================

/**
 * Extract visible events from the current Calendar view.
 * Returns EventSummary objects per data-model.md.
 * @param {import('puppeteer').Page} page
 * @param {number} [limit=25]
 * @returns {Promise<Array>}
 */
export async function extractVisibleEvents(page, limit = 25) {
  return page.evaluate((selectors, lim) => {
    const chips = document.querySelectorAll(selectors.eventChip);
    const results = [];
    const count = Math.min(chips.length, lim);

    for (let i = 0; i < count; i++) {
      const chip = chips[i];

      // T3: aria-label is the primary extraction method for event data
      const ariaLabel = chip.getAttribute('aria-label') || '';

      // T3: data-eventid for stable identification
      const eventId = chip.getAttribute('data-eventid') || null;

      // Parse aria-label — typically "Title, date, time – time, calendar"
      // This is a best-effort parse; structure varies by locale
      const title = ariaLabel.split(',')[0]?.trim() || '';

      // T4: CSS fallback for time and calendar info
      const timeSpans = chip.querySelectorAll(selectors.timeSpan);
      const timeText = timeSpans.length > 0 ? timeSpans[0]?.textContent?.trim() || '' : '';

      // Detect all-day by checking if event lacks specific time text
      const allDay = !timeText || timeText === '';

      results.push({
        index: i,
        eventId,
        title,
        startDate: '', // Populated from date context outside evaluate
        startTime: allDay ? null : timeText.split('–')[0]?.trim() || null,
        endDate: '',
        endTime: allDay ? null : timeText.split('–')[1]?.trim() || null,
        allDay,
        location: null, // Only available in detail view
        calendarName: '', // Extracted from color dot or aria-label suffix
        calendarColor: null
      });
    }
    return results;
  }, {
    eventChip: sel.EVENT_CHIP,
    timeSpan: sel.EVENT_TIME_IN_CHIP
  }, limit);
}

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Google Calendar plugin response — extends MCPResponse with data spreading.
 * Mirrors GmailActionResponse pattern.
 */
export class GCalActionResponse extends MCPResponse {
  constructor(data, summary, nextSteps) {
    super(nextSteps);
    this.data = data;
    this._summary = summary;
  }

  _getAdditionalFields() {
    return { ...this.data };
  }

  getTextSummary() {
    return this._summary;
  }
}
