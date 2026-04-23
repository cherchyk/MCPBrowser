/**
 * mark-read.js — Mark an email as read in list view.
 *
 * Tier usage:
 *   T2: Shift+i keyboard shortcut to mark as read
 *   T3: selectEmailRow for targeting
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  checkKeyboardShortcuts,
  selectEmailRow,
  GmailActionResponse
} from '../helpers.js';

/**
 * Mark an email as read in list view.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {number} [opts.params.index] - Email index
 * @param {string} [opts.params.id] - Email ID
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function markRead({ page, params }) {
  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use browser_fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  // Precondition: must be in list view
  const listPre = await checkPrecondition(page, 'list_view');
  if (!listPre.met) {
    return new ErrorResponse(listPre.error, [
      listPre.suggestion || "Use list_emails to navigate to an email list first."
    ]);
  }

  // Verify keyboard shortcuts are enabled
  const kb = await checkKeyboardShortcuts(page);
  if (!kb.enabled) {
    return new ErrorResponse(kb.error, [
      'Enable keyboard shortcuts in Gmail Settings → General → Keyboard shortcuts → ON, then reload Gmail.'
    ]);
  }

  // Select the email row
  const sel = await selectEmailRow(page, { index: params.index, id: params.id });
  if (!sel.selected) {
    return new ErrorResponse(sel.error || 'Could not select email.', [
      'Provide an index or id parameter to target a specific email.'
    ]);
  }

  // T2: Shift+i to mark as read
  await page.keyboard.down('Shift');
  await page.keyboard.press('KeyI');
  await page.keyboard.up('Shift');
  logger.debug('markRead: pressed Shift+i');

  return new GmailActionResponse(
    { markedRead: true },
    'Email marked as read.',
    ['Use list_emails to refresh the email list']
  );
}
