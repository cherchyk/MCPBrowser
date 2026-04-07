/**
 * rsvp-event.js — Respond to a calendar invitation (accept, decline, tentative).
 *
 * Tier usage:
 *   T3: selectEvent for clicking event chip, ARIA dialog for detail popup
 *   T4: RSVP_YES_BUTTON, RSVP_NO_BUTTON, RSVP_MAYBE_BUTTON selectors
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  selectEvent,
  waitForCalendar,
  GCalActionResponse
} from '../helpers.js';
import {
  RSVP_YES_BUTTON,
  RSVP_NO_BUTTON,
  RSVP_MAYBE_BUTTON
} from '../selectors.js';

/** Map response names to selector keys. */
const RSVP_MAP = {
  accept: RSVP_YES_BUTTON,
  decline: RSVP_NO_BUTTON,
  tentative: RSVP_MAYBE_BUTTON
};

/**
 * RSVP to a calendar invitation.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {number} [opts.params.index] - 0-based position in current event list
 * @param {string} [opts.params.id] - Google Calendar event ID
 * @param {string} opts.params.response - "accept", "decline", or "tentative" (required)
 * @returns {Promise<GCalActionResponse|ErrorResponse>}
 */
export async function rsvpEvent({ page, params }) {
  // Validate: at least one identifier required
  if (params.index == null && params.id == null) {
    return new ErrorResponse(
      'Either index or id is required to RSVP to an event.',
      [
        'Use list_events to see available events and their indices',
        'Use search_events to find a specific event by keyword'
      ]
    );
  }

  // Validate response value
  const response = (params.response || '').toLowerCase();
  if (!RSVP_MAP[response]) {
    return new ErrorResponse(
      `Invalid RSVP response "${params.response}". Must be one of: accept, decline, tentative.`,
      ['Use rsvp_event({ index: 0, response: "accept" })']
    );
  }

  // Precondition: must be on Google Calendar
  const pre = await checkPrecondition(page, 'on_calendar');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use fetch_webpage({ url: 'https://calendar.google.com' }) to open Google Calendar first."
    ]);
  }

  // T3: Select (click) the target event to open detail popup
  const sel = await selectEvent(page, { index: params.index, id: params.id });
  if (!sel.selected) {
    return new ErrorResponse(
      sel.error || 'Could not select the event to RSVP.',
      ['Use list_events to refresh the event list and check indices']
    );
  }

  // Wait for detail popup
  try {
    await waitForCalendar(page, 'div[role="dialog"]');
  } catch {
    return new ErrorResponse(
      'Event detail popup did not appear after clicking the event.',
      ['Try list_events to refresh, then rsvp_event with a valid index']
    );
  }

  // Detect if the user is the organizer (organizers cannot RSVP to their own events)
  const isOrganizer = await page.evaluate(() => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return false;
    // Organizer view typically shows "Edit event" but not RSVP buttons
    const editBtn = dialog.querySelector('button[aria-label="Edit event"]');
    const rsvpBtn = dialog.querySelector('[data-response]');
    return editBtn && !rsvpBtn;
  });

  if (isOrganizer) {
    return new ErrorResponse(
      'You are the organizer of this event. Organizers cannot RSVP to their own events.',
      [
        'Use edit_event to modify the event instead',
        'Use delete_event to cancel the event'
      ]
    );
  }

  // T4: Click the appropriate RSVP button
  const rsvpSelector = RSVP_MAP[response];
  const rsvpBtn = await page.$(rsvpSelector);
  if (!rsvpBtn) {
    // Fallback: look for RSVP button by text content
    const fallbackBtn = await page.evaluateHandle((resp) => {
      const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
      const labels = { accept: 'Yes', decline: 'No', tentative: 'Maybe' };
      return buttons.find(b => b.textContent?.trim() === labels[resp]);
    }, response);

    if (fallbackBtn && fallbackBtn.asElement()) {
      await fallbackBtn.asElement().click();
      logger.debug(`rsvpEvent: clicked RSVP "${response}" via text fallback`);
    } else {
      return new ErrorResponse(
        `Could not find the RSVP "${response}" button. This event may not have RSVP options.`,
        [
          'This event may not be an invitation — you can only RSVP to events you were invited to',
          'Use read_event to inspect the event details'
        ]
      );
    }
  } else {
    await rsvpBtn.click();
    logger.debug(`rsvpEvent: clicked RSVP "${response}" via selector`);
  }

  await new Promise(r => setTimeout(r, 300));

  return new GCalActionResponse(
    {
      response,
      rsvpSent: true
    },
    `RSVP "${response}" sent successfully.`,
    [
      'Use list_events to return to the calendar view',
      'Use read_event to verify the RSVP status'
    ]
  );
}
