/**
 * list-events.js — List visible events from the current Google Calendar view.
 *
 * Tier usage:
 *   T1: calendarNavigate + buildViewPath for date/view navigation
 *   T3: extractVisibleEvents for event chip data extraction
 *   T4: EVENT_CHIP selector via waitForCalendar
 */

import { ErrorResponse } from '../../../core/responses.js';
import {
  checkPrecondition,
  calendarNavigate,
  buildViewPath,
  waitForCalendar,
  extractVisibleEvents,
  detectView,
  GCalActionResponse
} from '../helpers.js';
import { EVENT_CHIP } from '../selectors.js';

/**
 * List events from the current Calendar view or navigate to a specific date/view.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} [opts.params.date] - ISO date to navigate to (e.g., '2026-04-10')
 * @param {string} [opts.params.view] - Calendar view: day, week, month, schedule
 * @param {number} [opts.params.limit=25] - Maximum events to return
 * @returns {Promise<GCalActionResponse|ErrorResponse>}
 */
export async function listEvents({ page, params }) {
  // Precondition: must be on Google Calendar
  const pre = await checkPrecondition(page, 'on_calendar');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use browser_fetch_webpage({ url: 'https://calendar.google.com' }) to open Google Calendar first."
    ]);
  }

  const date = params.date || null;
  const view = params.view || null;
  const limit = params.limit || 25;

  // Validate view param if provided
  const validViews = ['day', 'week', 'month', 'schedule', 'custom'];
  if (view && !validViews.includes(view)) {
    return new ErrorResponse(
      `Invalid view "${view}". Must be one of: ${validViews.join(', ')}.`,
      ['Use list_events({ view: "week" }) or list_events({ view: "day", date: "2026-04-10" })']
    );
  }

  // T1: Navigate to date/view if either is provided
  if (date || view) {
    const targetView = view || 'week';
    const path = buildViewPath(targetView, date);
    await calendarNavigate(page, path);
  }

  // Wait for event chips to appear (or timeout gracefully)
  try {
    await waitForCalendar(page, EVENT_CHIP);
  } catch {
    // No events visible — return empty list rather than error
    const currentView = await detectView(page);
    return new GCalActionResponse(
      { events: [], view: currentView, dateRange: date || 'current', total: 0 },
      'No events found in the current view.',
      [
        'Try a different date or view: list_events({ date: "2026-04-10", view: "week" })',
        'Use search_events to find events by keyword',
        'Use create_event to add a new event'
      ]
    );
  }

  // T3+T4: Extract visible event data
  const events = await extractVisibleEvents(page, limit);
  const currentView = await detectView(page);

  return new GCalActionResponse(
    {
      events,
      view: currentView,
      dateRange: date || 'current',
      total: events.length
    },
    `Found ${events.length} event(s) in ${currentView} view.`,
    [
      'Use read_event({ index: N }) to open a specific event',
      'Use search_events to find events by keyword',
      'Use create_event to add a new event'
    ]
  );
}
