/**
 * delete-event.js — Remove an event from Google Calendar.
 *
 * Tier usage:
 *   T2: Delete/Backspace keyboard shortcut to delete event
 *   T3: selectEvent for clicking event chip, ARIA dialog for confirmation
 *
 * FR-022: Precondition check before destructive keyboard action.
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  selectEvent,
  waitForCalendar,
  detectView,
  VIEW,
  GCalActionResponse
} from '../helpers.js';

/**
 * Delete an event by index or event ID.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {number} [opts.params.index] - 0-based position in current event list
 * @param {string} [opts.params.id] - Google Calendar event ID
 * @returns {Promise<GCalActionResponse|ErrorResponse>}
 */
export async function deleteEvent({ page, params }) {
  // Validate: at least one identifier required
  if (params.index == null && params.id == null) {
    return new ErrorResponse(
      'Either index or id is required to delete an event.',
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
      sel.error || 'Could not select the event to delete.',
      ['Use list_events to refresh the event list and check indices']
    );
  }

  // Wait for detail popup
  try {
    await waitForCalendar(page, 'div[role="dialog"]');
  } catch {
    return new ErrorResponse(
      'Event detail popup did not appear after clicking the event.',
      ['Try list_events to refresh, then delete_event with a valid index']
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
    if (thisEventBtn && thisEventBtn.asElement()) {
      await thisEventBtn.asElement().click();
      await new Promise(r => setTimeout(r, 300));
      recurringNote = 'Deleted this single occurrence of a recurring event.';
      logger.debug('deleteEvent: selected "This event" for recurring event');
    }
  }

  // FR-022: Precondition check — verify we're in the right context
  // before sending destructive keyboard shortcut
  const view = await detectView(page);
  const hasDialog = await page.$('div[role="dialog"]');
  if (!hasDialog && view === VIEW.NOT_CALENDAR) {
    return new ErrorResponse(
      'Cannot delete: lost context. The event dialog is no longer visible.',
      ['Use list_events to refresh, then try delete_event again']
    );
  }

  // T2: Click the "Delete event" button or press Delete/Backspace
  const deleteBtn = await page.$('button[aria-label="Delete event"]') ||
                    await page.$('button[aria-label*="delete" i]') ||
                    await page.$('[data-deletebtn]');
  if (deleteBtn) {
    await deleteBtn.click();
    logger.debug('deleteEvent: clicked Delete button');
  } else {
    // Fallback: use keyboard shortcut
    await page.keyboard.press('Delete');
    logger.debug('deleteEvent: pressed Delete key');
  }

  // Wait for confirmation or undo toast
  await new Promise(r => setTimeout(r, 500));

  // Check for confirmation dialog (some events require explicit confirmation)
  const confirmBtn = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return buttons.find(b =>
      b.textContent?.includes('Delete') ||
      b.textContent?.includes('Remove')
    );
  });
  if (confirmBtn && confirmBtn.asElement()) {
    await confirmBtn.asElement().click();
    logger.debug('deleteEvent: confirmed deletion');
    await new Promise(r => setTimeout(r, 300));
  }

  return new GCalActionResponse(
    {
      deleted: true,
      recurringNote
    },
    recurringNote || 'Event deleted successfully.',
    ['Use list_events to see the updated calendar']
  );
}
