/**
 * archive-email.js — Archive an email, removing it from the inbox.
 *
 * Tier usage:
 *   T2: 'e' keyboard shortcut to archive
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
 * Archive an email from thread view or list view.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {number} [opts.params.index] - Email index in list view
 * @param {string} [opts.params.id] - Email ID in list view
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function archiveEmail({ page, params }) {
  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  const view = await detectView(page);

  if (view === VIEW.THREAD) {
    // In thread view, archive directly
    await page.keyboard.press('e');
    logger.debug('archiveEmail: pressed "e" in thread view');
  } else if (view === VIEW.EMAIL_LIST || view === VIEW.SEARCH_RESULTS) {
    // In list view, select the row first
    const sel = await selectEmailRow(page, { index: params.index, id: params.id });
    if (!sel.selected) {
      return new ErrorResponse(sel.error || 'Could not select email to archive.', [
        'Provide an index or id parameter to target a specific email.'
      ]);
    }
    await page.keyboard.press('e');
    logger.debug('archiveEmail: selected row and pressed "e"');
  } else {
    return new ErrorResponse(
      'Cannot archive from the current view. Navigate to inbox or open an email first.',
      ["Use list_emails to view the inbox, or read_email to open a thread."]
    );
  }

  return new GmailActionResponse(
    { archived: true },
    'Email archived successfully.',
    ['Use list_emails to return to inbox']
  );
}
