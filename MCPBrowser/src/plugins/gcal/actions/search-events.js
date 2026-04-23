/**
 * search-events.js — Search Google Calendar for events matching a keyword query.
 *
 * Tier usage:
 *   T2: '/' keyboard shortcut to focus search
 *   T3: extractVisibleEvents for result extraction
 *   T4: EVENT_CHIP selector for result detection
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  waitForCalendar,
  extractVisibleEvents,
  GCalActionResponse
} from '../helpers.js';
import { EVENT_CHIP } from '../selectors.js';

/**
 * Search events by query string using Calendar's search UI.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} opts.params.query - Search keywords (required)
 * @param {number} [opts.params.limit=25] - Maximum results to return
 * @returns {Promise<GCalActionResponse|ErrorResponse>}
 */
export async function searchEvents({ page, params }) {
  // Validate query
  if (!params.query || !params.query.trim()) {
    return new ErrorResponse(
      'Search query is required.',
      [
        'Provide a query: search_events({ query: "team meeting" })',
        'Use list_events to browse the calendar without searching'
      ]
    );
  }

  // Precondition: must be on Google Calendar
  const pre = await checkPrecondition(page, 'on_calendar');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use browser_fetch_webpage({ url: 'https://calendar.google.com' }) to open Google Calendar first."
    ]);
  }

  const query = params.query.trim();
  const limit = params.limit || 25;

  // Ensure nothing is focused that would swallow the keystroke
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.tagName !== 'BODY') {
      document.activeElement.blur();
    }
  });

  // T2: Press '/' to focus the search box
  await page.keyboard.press('/');
  await new Promise(r => setTimeout(r, 300));

  // T3: Type query into the search input
  const searchInput = await page.$('input[aria-label="Search"]') ||
                      await page.$('input[aria-label*="search" i]') ||
                      await page.$('input[type="text"][role="searchbox"]');
  if (searchInput) {
    await searchInput.click({ clickCount: 3 }); // clear existing text
    await searchInput.type(query);
    logger.debug(`searchEvents: typed query "${query}"`);
  } else {
    // Fallback: type directly if the search field is already focused by '/'
    await page.keyboard.type(query);
    logger.debug(`searchEvents: typed query via keyboard "${query}"`);
  }

  // Press Enter to execute search
  await page.keyboard.press('Enter');

  // Wait for search results to appear
  let hasResults = true;
  try {
    await waitForCalendar(page, EVENT_CHIP);
  } catch {
    // Check for "no results" state
    const noResults = await page.evaluate(() => {
      const body = document.body?.textContent || '';
      return body.includes('No results') || body.includes('No events found');
    });
    if (noResults) {
      hasResults = false;
    } else {
      // Re-check — page may still be loading
      hasResults = false;
    }
  }

  if (!hasResults) {
    return new GCalActionResponse(
      { events: [], query, resultCount: 0 },
      `No events found for "${query}".`,
      [
        'Try a different or broader search query',
        'Use list_events to browse the calendar instead'
      ]
    );
  }

  // T3+T4: Extract search results
  const events = await extractVisibleEvents(page, limit);

  return new GCalActionResponse(
    { events, query, resultCount: events.length },
    `Found ${events.length} result(s) for "${query}".`,
    [
      'Use read_event({ index: N }) to open a specific result',
      'Use list_events to return to the calendar view',
      'Refine your search with more specific keywords'
    ]
  );
}
