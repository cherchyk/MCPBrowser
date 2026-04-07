/**
 * forward-email.js — Forward the currently open email to another recipient.
 *
 * Tier usage:
 *   T2: 'f' keyboard shortcut to open forward, Ctrl+Enter to send
 *   T3: ARIA dialog, textarea[name="to"], div[aria-label="Message Body"]
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
 * Forward the currently open email thread.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} opts.params.to - Recipient to forward to (required)
 * @param {string} [opts.params.body] - Additional body text
 * @param {boolean} [opts.params.send] - If true, send immediately
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function forwardEmail({ page, params }) {
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

  // T2: Press 'f' to open forward
  await page.keyboard.press('f');
  logger.debug('forwardEmail: pressed "f" to open forward dialog');

  // Wait for forward dialog
  await waitForGmail(page, 'div[role="dialog"]');

  // Fill To field
  if (params.to) {
    await page.type('textarea[name="to"]', params.to);
    await page.keyboard.press('Tab');
  }

  // Fill additional body text if provided
  if (params.body) {
    const bodyDiv = await page.$('div[aria-label="Message Body"]');
    if (bodyDiv) {
      await bodyDiv.click();
      await page.type('div[aria-label="Message Body"]', params.body);
    }
  }

  // Send if requested
  if (params.send) {
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
    logger.debug('forwardEmail: sent via Ctrl+Enter');
  }

  const status = params.send ? 'sent' : 'draft';
  const summary = params.send
    ? `Email forwarded to ${params.to || '(no recipient)'}.`
    : `Forward draft created. Fill in recipients and send manually.`;

  return new GmailActionResponse(
    { status, to: params.to || '' },
    summary,
    params.send
      ? ['Use list_emails to return to inbox']
      : ['Review and send the forward draft manually in Gmail']
  );
}
