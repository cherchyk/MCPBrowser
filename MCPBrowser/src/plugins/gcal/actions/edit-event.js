/**
 * edit-event.js — Modify an existing event's fields.
 *
 * Tier usage:
 *   T3: selectEvent for clicking event chip, ARIA dialog for edit form,
 *       input targeting for field updates
 *   T4: SAVE_BUTTON selector for conditional save
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  selectEvent,
  waitForCalendar,
  GCalActionResponse
} from '../helpers.js';
import { SAVE_BUTTON } from '../selectors.js';

/**
 * Edit an existing event by index or event ID.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {number} [opts.params.index] - 0-based position in current event list
 * @param {string} [opts.params.id] - Google Calendar event ID
 * @param {string} [opts.params.title] - New title
 * @param {string} [opts.params.date] - New date (ISO format)
 * @param {string} [opts.params.startTime] - New start time (HH:MM)
 * @param {string} [opts.params.endTime] - New end time (HH:MM)
 * @param {string} [opts.params.location] - New location
 * @param {string} [opts.params.description] - New description
 * @param {string[]} [opts.params.attendees] - New attendee list
 * @param {boolean} [opts.params.allDay] - Toggle all-day
 * @param {boolean} [opts.params.save=false] - If true, save changes (FR-015)
 * @returns {Promise<GCalActionResponse|ErrorResponse>}
 */
export async function editEvent({ page, params }) {
  // Validate: at least one identifier required
  if (params.index == null && params.id == null) {
    return new ErrorResponse(
      'Either index or id is required to edit an event.',
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
      pre.suggestion || "Use browser_fetch_webpage({ url: 'https://calendar.google.com' }) to open Google Calendar first."
    ]);
  }

  // T3: Select (click) the target event to open detail popup
  const sel = await selectEvent(page, { index: params.index, id: params.id });
  if (!sel.selected) {
    return new ErrorResponse(
      sel.error || 'Could not select the event to edit.',
      ['Use list_events to refresh the event list and check indices']
    );
  }

  // Wait for detail popup
  try {
    await waitForCalendar(page, 'div[role="dialog"]');
  } catch {
    return new ErrorResponse(
      'Event detail popup did not appear after clicking the event.',
      ['Try list_events to refresh, then edit_event with a valid index']
    );
  }

  // Detect recurring event dialog — if it appears, select "This event"
  const recurringDialog = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, span[role="radio"]'));
    return buttons.some(b => b.textContent?.includes('This event'));
  });
  let recurringNote = null;
  if (recurringDialog) {
    const thisEventBtn = await page.evaluateHandle(() => {
      const elements = Array.from(document.querySelectorAll('button, span[role="radio"], label'));
      return elements.find(el => el.textContent?.includes('This event'));
    });
    if (thisEventBtn) {
      await thisEventBtn.asElement()?.click();
      await new Promise(r => setTimeout(r, 300));
      recurringNote = 'Editing this single occurrence of a recurring event.';
      logger.debug('editEvent: selected "This event" for recurring event');
    }
  }

  // Click \"Edit event\" pencil icon to open the edit form
  const editBtn = await page.$('button[aria-label="Edit event"]') ||
                  await page.$('button[aria-label*="edit" i]') ||
                  await page.$('[data-editbtn]');
  if (editBtn) {
    await editBtn.click();
    logger.debug('editEvent: clicked Edit button');
    await new Promise(r => setTimeout(r, 500));
  }

  // Wait for the edit form to load
  try {
    await waitForCalendar(page, 'input[aria-label="Add title"], input[data-initial-value]');
  } catch {
    return new ErrorResponse(
      'Edit form did not appear. The event may not be editable.',
      ['You may not have edit permissions for this event', 'Try reading the event first with read_event']
    );
  }

  // T3: Update only the provided fields
  const fieldsUpdated = [];

  if (params.title) {
    const titleInput = await page.$('input[aria-label="Add title"]') ||
                       await page.$('input[data-initial-value]');
    if (titleInput) {
      await titleInput.click({ clickCount: 3 });
      await titleInput.type(params.title);
      fieldsUpdated.push('title');
      logger.debug(`editEvent: updated title to "${params.title}"`);
    }
  }

  if (params.date) {
    const dateInput = await page.$('input[aria-label*="date" i]') ||
                      await page.$('input[data-date]');
    if (dateInput) {
      await dateInput.click({ clickCount: 3 });
      await dateInput.type(params.date);
      await page.keyboard.press('Tab');
      fieldsUpdated.push('date');
      logger.debug(`editEvent: updated date to "${params.date}"`);
    }
  }

  if (params.allDay !== undefined) {
    const allDayCheckbox = await page.$('input[aria-label*="all day" i]') ||
                           await page.$('[data-allday] input[type="checkbox"]');
    if (allDayCheckbox) {
      await allDayCheckbox.click();
      fieldsUpdated.push('allDay');
      logger.debug('editEvent: toggled all-day');
    }
  }

  if (params.startTime) {
    const startInput = await page.$('input[aria-label*="start time" i]') ||
                       await page.$('input[aria-label*="Start time" i]');
    if (startInput) {
      await startInput.click({ clickCount: 3 });
      await startInput.type(params.startTime);
      await page.keyboard.press('Tab');
      fieldsUpdated.push('startTime');
      logger.debug(`editEvent: updated startTime to "${params.startTime}"`);
    }
  }

  if (params.endTime) {
    const endInput = await page.$('input[aria-label*="end time" i]') ||
                     await page.$('input[aria-label*="End time" i]');
    if (endInput) {
      await endInput.click({ clickCount: 3 });
      await endInput.type(params.endTime);
      await page.keyboard.press('Tab');
      fieldsUpdated.push('endTime');
      logger.debug(`editEvent: updated endTime to "${params.endTime}"`);
    }
  }

  if (params.location) {
    const locationInput = await page.$('input[aria-label*="location" i]') ||
                          await page.$('[data-locationactionpanel] input');
    if (locationInput) {
      await locationInput.click({ clickCount: 3 });
      await locationInput.type(params.location);
      await page.keyboard.press('Tab');
      fieldsUpdated.push('location');
      logger.debug(`editEvent: updated location to "${params.location}"`);
    }
  }

  if (params.description) {
    const descInput = await page.$('div[aria-label*="description" i][contenteditable]') ||
                      await page.$('textarea[aria-label*="description" i]') ||
                      await page.$('[data-description] [contenteditable]');
    if (descInput) {
      await descInput.click();
      // Select all existing text and replace
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await descInput.type(params.description);
      fieldsUpdated.push('description');
      logger.debug('editEvent: updated description');
    }
  }

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
      fieldsUpdated.push('attendees');
      logger.debug(`editEvent: updated attendees (${params.attendees.length} added)`);
    }
  }

  // FR-015: Conditionally save — default is false
  const save = params.save === true;
  if (save) {
    const saveBtn = await page.$(SAVE_BUTTON) ||
                    await page.$('button[aria-label="Save"]');
    if (saveBtn) {
      await saveBtn.click();
      logger.debug('editEvent: clicked Save');
      await new Promise(r => setTimeout(r, 500));
    }
  }

  return new GCalActionResponse(
    {
      fieldsUpdated,
      saved: save,
      recurringNote
    },
    save
      ? `Event updated and saved. Fields changed: ${fieldsUpdated.join(', ') || 'none'}.`
      : `Event form updated (${fieldsUpdated.join(', ') || 'none'}). Review and save in Calendar.`,
    save
      ? ['Use list_events to see the updated calendar']
      : ['Review changes and click Save manually in Calendar', 'Use list_events to return to calendar view']
  );
}
