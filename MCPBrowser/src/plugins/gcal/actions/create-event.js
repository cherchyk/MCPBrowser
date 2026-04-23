/**
 * create-event.js — Create a new calendar event with title, time, location,
 * description, and attendees.
 *
 * Tier usage:
 *   T2: 'c' keyboard shortcut to open creation form
 *   T3: ARIA dialog / input targeting for form filling
 *   T4: SAVE_BUTTON selector for conditional save
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  checkKeyboardShortcuts,
  waitForCalendar,
  GCalActionResponse
} from '../helpers.js';
import { SAVE_BUTTON } from '../selectors.js';

/**
 * Create a new calendar event, optionally saving it immediately.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} opts.params.title - Event title (required)
 * @param {string} [opts.params.date] - Event date in ISO format
 * @param {string} [opts.params.startTime] - Start time in HH:MM format
 * @param {string} [opts.params.endTime] - End time in HH:MM format
 * @param {boolean} [opts.params.allDay=false] - Create an all-day event
 * @param {string} [opts.params.location] - Event location
 * @param {string} [opts.params.description] - Event description/notes
 * @param {string[]} [opts.params.attendees] - Array of attendee email addresses
 * @param {boolean} [opts.params.save=false] - If true, save the event (FR-015)
 * @returns {Promise<GCalActionResponse|ErrorResponse>}
 */
export async function createEvent({ page, params }) {
  // Validate required param
  if (!params.title) {
    return new ErrorResponse(
      'The "title" parameter is required to create an event.',
      ['Provide a title: create_event({ title: "Team Meeting", date: "2026-04-10", startTime: "10:00" })']
    );
  }

  // Precondition: must be on Google Calendar
  const pre = await checkPrecondition(page, 'on_calendar');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use browser_fetch_webpage({ url: 'https://calendar.google.com' }) to open Google Calendar first."
    ]);
  }

  // T2: Verify keyboard shortcuts are enabled
  const kb = await checkKeyboardShortcuts(page);
  if (!kb.enabled) {
    return new ErrorResponse(kb.error, [
      'Enable keyboard shortcuts in Google Calendar Settings → Keyboard shortcuts → Enable keyboard shortcuts, then reload Calendar.'
    ]);
  }

  // FR-023: Close any existing dialog before opening a new one
  const existingDialog = await page.$('div[role="dialog"]');
  if (existingDialog) {
    logger.debug('createEvent: closing existing dialog');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
  }

  // Ensure nothing is focused that would swallow the keystroke
  await page.evaluate(() => {
    if (document.activeElement && document.activeElement.tagName !== 'BODY') {
      document.activeElement.blur();
    }
  });

  // T2: Press 'c' to open create event form
  await page.keyboard.press('c');

  // Wait for the quick-add dialog or full event form
  try {
    await waitForCalendar(page, 'div[role="dialog"]');
  } catch {
    return new ErrorResponse(
      'Event creation form did not appear. Keyboard shortcut "c" may not have worked.',
      [
        'Ensure keyboard shortcuts are enabled in Calendar Settings',
        'Try clicking the "+" button on the calendar manually'
      ]
    );
  }

  // T3: Fill in the title field — target the title input inside the dialog
  const titleInput = await page.$('input[aria-label="Add title"]') ||
                     await page.$('input[data-initial-value]') ||
                     await page.$('div[role="dialog"] input[type="text"]');
  if (titleInput) {
    await titleInput.click({ clickCount: 3 }); // select all existing text
    await titleInput.type(params.title);
    logger.debug(`createEvent: typed title "${params.title}"`);
  }

  // Check if we need to expand to the full form for additional fields
  const hasExtraFields = params.date || params.startTime || params.endTime ||
    params.location || params.description || params.attendees || params.allDay;

  if (hasExtraFields) {
    // Click "More options" to open full form if in quick-add mode
    const moreOptions = await page.$('button[aria-label="More options"]') ||
                        await page.$('[data-moreactions]');
    if (moreOptions) {
      await moreOptions.click();
      logger.debug('createEvent: expanded to full form');
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // T3: Fill date field if provided
  if (params.date) {
    const dateInput = await page.$('input[aria-label*="date" i]') ||
                      await page.$('input[data-date]');
    if (dateInput) {
      await dateInput.click({ clickCount: 3 });
      await dateInput.type(params.date);
      await page.keyboard.press('Tab');
      logger.debug(`createEvent: set date "${params.date}"`);
    }
  }

  // T3: Toggle all-day if requested
  if (params.allDay) {
    const allDayCheckbox = await page.$('input[aria-label*="all day" i]') ||
                           await page.$('[data-allday] input[type="checkbox"]');
    if (allDayCheckbox) {
      await allDayCheckbox.click();
      logger.debug('createEvent: toggled all-day');
    }
  }

  // T3: Fill start time if provided (and not all-day)
  if (params.startTime && !params.allDay) {
    const startInput = await page.$('input[aria-label*="start time" i]') ||
                       await page.$('input[aria-label*="Start time" i]');
    if (startInput) {
      await startInput.click({ clickCount: 3 });
      await startInput.type(params.startTime);
      await page.keyboard.press('Tab');
      logger.debug(`createEvent: set startTime "${params.startTime}"`);
    }
  }

  // T3: Fill end time if provided (and not all-day)
  if (params.endTime && !params.allDay) {
    const endInput = await page.$('input[aria-label*="end time" i]') ||
                     await page.$('input[aria-label*="End time" i]');
    if (endInput) {
      await endInput.click({ clickCount: 3 });
      await endInput.type(params.endTime);
      await page.keyboard.press('Tab');
      logger.debug(`createEvent: set endTime "${params.endTime}"`);
    }
  }

  // T3: Fill location if provided
  if (params.location) {
    const locationInput = await page.$('input[aria-label*="location" i]') ||
                          await page.$('[data-locationactionpanel] input');
    if (locationInput) {
      await locationInput.click();
      await locationInput.type(params.location);
      await page.keyboard.press('Tab');
      logger.debug(`createEvent: set location "${params.location}"`);
    }
  }

  // T3: Fill description if provided
  if (params.description) {
    const descInput = await page.$('div[aria-label*="description" i][contenteditable]') ||
                      await page.$('textarea[aria-label*="description" i]') ||
                      await page.$('[data-description] [contenteditable]');
    if (descInput) {
      await descInput.click();
      await descInput.type(params.description);
      logger.debug('createEvent: set description');
    }
  }

  // T3: Add attendees if provided
  if (params.attendees && params.attendees.length > 0) {
    const guestInput = await page.$('input[aria-label*="guest" i]') ||
                       await page.$('input[aria-label*="Add guests" i]');
    if (guestInput) {
      for (const email of params.attendees) {
        await guestInput.click();
        await guestInput.type(email);
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 200));
      }
      logger.debug(`createEvent: added ${params.attendees.length} attendee(s)`);
    }
  }

  // FR-015: Conditionally save — default is false (leave for review)
  const save = params.save === true;
  if (save) {
    const saveBtn = await page.$(SAVE_BUTTON) ||
                    await page.$('button[aria-label="Save"]') ||
                    await page.$('div[role="dialog"] button:has-text("Save")');
    if (saveBtn) {
      await saveBtn.click();
      logger.debug('createEvent: clicked Save');
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const status = save ? 'saved' : 'draft';
  const summary = save
    ? `Event "${params.title}" created and saved.`
    : `Event "${params.title}" form filled. Review and save in Calendar.`;

  return new GCalActionResponse(
    {
      status,
      title: params.title,
      date: params.date || 'today',
      startTime: params.startTime || null,
      endTime: params.endTime || null,
      allDay: params.allDay || false,
      location: params.location || null,
      attendees: params.attendees || [],
      save
    },
    summary,
    save
      ? ['Use list_events to see the updated calendar']
      : ['Review the event form in Calendar and click Save manually', 'Use list_events to return to calendar view']
  );
}
