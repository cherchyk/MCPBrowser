/**
 * delete-email.js — Delete an email by moving it to trash.
 *
 * Tier usage:
 *   T2: '#' keyboard shortcut to move to trash
 *   T3: selectEmailRow for list view targeting
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  detectView,
  selectEmailRow,
  VIEW,
  GmailActionResponse
} from '../helpers.js';

/**
 * Delete an email (move to trash) from thread view or list view.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {number} [opts.params.index] - Email index in list view
 * @param {string} [opts.params.id] - Email ID in list view
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function deleteEmail({ page, params }) {
  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use browser_fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  const view = await detectView(page);

  if (view === VIEW.THREAD) {
    // In thread view, delete directly
    await page.keyboard.type('#');
    logger.debug('deleteEmail: typed "#" in thread view');
  } else if (view === VIEW.EMAIL_LIST || view === VIEW.SEARCH_RESULTS) {
    // In list view, select the row first
    const sel = await selectEmailRow(page, { index: params.index, id: params.id });
    if (!sel.selected) {
      return new ErrorResponse(sel.error || 'Could not select email to delete.', [
        'Provide an index or id parameter to target a specific email.'
      ]);
    }
    await page.keyboard.type('#');
    logger.debug('deleteEmail: selected row and typed "#"');
  } else {
    return new ErrorResponse(
      'Cannot delete from the current view. Navigate to inbox or open an email first.',
      ["Use list_emails to view the inbox, or read_email to open a thread."]
    );
  }

  return new GmailActionResponse(
    { deleted: true },
    'Email moved to trash.',
    ['Use list_emails to return to inbox']
  );
}
