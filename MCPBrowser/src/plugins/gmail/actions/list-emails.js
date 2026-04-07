/**
 * list-emails.js — List emails from Gmail inbox or specified folder/label.
 *
 * Tier usage:
 *   T1: gmailNavigate to folder hash
 *   T4: EMAIL_ROW selector for waitForGmail + extractEmailRows
 */

import { ErrorResponse } from '../../../core/responses.js';
import {
  checkPrecondition,
  gmailNavigate,
  folderToHash,
  waitForGmail,
  extractEmailRows,
  GmailActionResponse
} from '../helpers.js';
import { EMAIL_ROW } from '../selectors.js';

/**
 * List emails from the current Gmail view or a specific folder.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} [opts.params.folder] - Folder name (inbox, sent, drafts, label name, etc.)
 * @param {number} [opts.params.limit=25] - Maximum emails to return
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function listEmails({ page, params }) {
  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  const folder = params.folder || 'inbox';
  const limit = params.limit || 25;

  // T1: Navigate to the requested folder
  if (params.folder) {
    await gmailNavigate(page, folderToHash(params.folder));
  }

  // T4: Wait for email rows to appear
  await waitForGmail(page, EMAIL_ROW);

  // T3+T4: Extract visible email data
  const emails = await extractEmailRows(page, limit);

  return new GmailActionResponse(
    { emails, folder, totalVisible: emails.length },
    `Found ${emails.length} email(s) in ${folder}.`,
    [
      'Use read_email to open a specific email',
      'Use search_emails to find specific messages',
      'Use compose_email to write a new email'
    ]
  );
}
