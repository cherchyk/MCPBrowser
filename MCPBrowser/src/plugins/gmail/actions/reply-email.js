/**
 * reply-email.js — Reply (or reply-all) to the currently open email thread.
 *
 * Tier usage:
 *   T2: 'r' for reply, 'a' for reply-all, Ctrl+Enter to send
 *   T3: div[aria-label="Message Body"] for reply editor
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  checkKeyboardShortcuts,
  waitForGmail,
  GmailActionResponse
} from '../helpers.js';

/**
 * Reply to the currently open thread.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} [opts.params.body] - Reply body text
 * @param {boolean} [opts.params.replyAll] - If true, reply-all
 * @param {boolean} [opts.params.send] - If true, send immediately
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function replyEmail({ page, params }) {
  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  // Precondition: must have a thread open
  const threadPre = await checkPrecondition(page, 'thread_open');
  if (!threadPre.met) {
    return new ErrorResponse(threadPre.error, [
      threadPre.suggestion || "Use read_email to open an email thread first."
    ]);
  }

  // Verify keyboard shortcuts are enabled
  const kb = await checkKeyboardShortcuts(page);
  if (!kb.enabled) {
    return new ErrorResponse(kb.error, [
      'Enable keyboard shortcuts in Gmail Settings → General → Keyboard shortcuts → ON, then reload Gmail.'
    ]);
  }

  // T2: Press 'a' for reply-all or 'r' for reply
  const key = params.replyAll ? 'a' : 'r';
  await page.keyboard.press(key);
  logger.debug(`replyEmail: pressed '${key}' for ${params.replyAll ? 'reply-all' : 'reply'}`);

  // Wait for reply editor
  await waitForGmail(page, 'div[aria-label="Message Body"]');

  // Fill reply body
  if (params.body) {
    await page.type('div[aria-label="Message Body"]', params.body);
  }

  // Send if requested
  if (params.send) {
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
    logger.debug('replyEmail: sent via Ctrl+Enter');
  }

  const status = params.send ? 'sent' : 'draft';
  const action = params.replyAll ? 'Reply-all' : 'Reply';
  const summary = params.send
    ? `${action} sent.`
    : `${action} draft created. Review and send manually in Gmail.`;

  return new GmailActionResponse(
    { status, replyAll: !!params.replyAll },
    summary,
    params.send
      ? ['Use list_emails to return to inbox']
      : ['Review and send the reply draft manually in Gmail']
  );
}
