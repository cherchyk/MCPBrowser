/**
 * read-event.js — Open an event and read its full details.
 *
 * Tier usage:
 *   T3: selectEvent for clicking event chip, ARIA dialog for detail popup
 *   T4: EVENT_LOCATION_IN_DETAIL, EVENT_DESCRIPTION_IN_DETAIL,
 *       ATTENDEE_ROW, ATTENDEE_RSVP_STATUS selectors for data extraction
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
  EVENT_LOCATION_IN_DETAIL,
  EVENT_DESCRIPTION_IN_DETAIL,
  ATTENDEE_ROW,
  ATTENDEE_RSVP_STATUS
} from '../selectors.js';

/**
 * Open and read a specific event by index or event ID.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {number} [opts.params.index] - 0-based position in current event list
 * @param {string} [opts.params.id] - Google Calendar event ID
 * @returns {Promise<GCalActionResponse|ErrorResponse>}
 */
export async function readEvent({ page, params }) {
  // Validate: at least one identifier required
  if (params.index == null && params.id == null) {
    return new ErrorResponse(
      'Either index or id is required to read an event.',
      [
        'Use list_events to see available events and their indices',
        'Use search_events to find a specific event by keyword'
      ]
    );
  }

  // Precondition: must be on Google Calendar
  const pre = await checkPrecondition(page, 'on_calendar');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use fetch_webpage({ url: 'https://calendar.google.com' }) to open Google Calendar first."
    ]);
  }

  // FR-023: Close any existing dialog before opening a new one
  const existingDialog = await page.$('div[role="dialog"]');
  if (existingDialog) {
    logger.debug('readEvent: closing existing dialog');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
  }

  // T3: Select (click) the target event
  const sel = await selectEvent(page, { index: params.index, id: params.id });
  if (!sel.selected) {
    return new ErrorResponse(
      sel.error || 'Could not select the event.',
      ['Use list_events to refresh the event list and check indices']
    );
  }

  // Wait for detail popup/dialog to appear
  try {
    await waitForCalendar(page, 'div[role="dialog"]');
  } catch {
    return new ErrorResponse(
      'Event detail popup did not appear after clicking the event.',
      [
        'The event chip may not be interactive. Try list_events to refresh.',
        'Try read_event with a different index'
      ]
    );
  }

  // T3+T4: Extract event detail fields from the dialog
  const eventDetail = await page.evaluate((selectors) => {
    const dialog = document.querySelector('div[role="dialog"]');
    if (!dialog) return null;

    // T3: Title from the heading element in the dialog
    const titleEl = dialog.querySelector('span[role="heading"], [data-eventid]') ||
                    dialog.querySelector('span');
    const title = titleEl?.textContent?.trim() || '';

    // T3: Time/date info from aria-label or text content
    const timeEls = dialog.querySelectorAll('div[data-datekey], span[data-datekey]');
    let dateTime = '';
    if (timeEls.length > 0) {
      dateTime = Array.from(timeEls).map(el => el.textContent?.trim()).join(' ');
    }

    // T4: Location
    const locationEl = dialog.querySelector(selectors.location);
    const location = locationEl?.textContent?.trim() || null;

    // T4: Description
    const descEl = dialog.querySelector(selectors.description);
    const description = descEl?.textContent?.trim() || null;

    // T3: Conference link (look for meet or zoom links)
    const links = dialog.querySelectorAll('a[href]');
    let conferenceLink = null;
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.includes('meet.google.com') || href.includes('zoom.us')) {
        conferenceLink = href;
        break;
      }
    }

    // T4: Attendees
    const attendeeEls = dialog.querySelectorAll(selectors.attendeeRow);
    const attendees = Array.from(attendeeEls).map(row => {
      const email = row.getAttribute('data-guest-email') || '';
      const name = row.textContent?.trim() || email;
      const rsvpEl = row.querySelector(selectors.rsvpStatus);
      const rsvpStatus = rsvpEl?.getAttribute('data-rsvp') || 'unknown';
      return { email, name, rsvpStatus };
    });

    // T3: Organizer (first attendee or dialog context)
    const organizer = attendees.length > 0 ? attendees[0].email : null;

    // T3: Calendar name from color label
    const calendarEl = dialog.querySelector('[data-calendar-color]');
    const calendarName = calendarEl?.textContent?.trim() || null;

    return {
      title,
      dateTime,
      location,
      description,
      conferenceLink,
      attendees,
      organizer,
      calendarName,
      attendeeCount: attendees.length
    };
  }, {
    location: EVENT_LOCATION_IN_DETAIL,
    description: EVENT_DESCRIPTION_IN_DETAIL,
    attendeeRow: ATTENDEE_ROW,
    rsvpStatus: ATTENDEE_RSVP_STATUS
  });

  if (!eventDetail) {
    return new ErrorResponse(
      'Could not extract event details from the dialog.',
      ['Try closing the dialog (press Escape) and re-opening with read_event']
    );
  }

  logger.debug(`readEvent: extracted "${eventDetail.title}"`);

  return new GCalActionResponse(
    eventDetail,
    `Event: ${eventDetail.title}${eventDetail.dateTime ? ` — ${eventDetail.dateTime}` : ''}`,
    [
      'Use edit_event to modify this event',
      'Use rsvp_event to respond to this invitation',
      'Use delete_event to remove this event',
      'Press Escape or use list_events to return to the calendar view'
    ]
  );
}
