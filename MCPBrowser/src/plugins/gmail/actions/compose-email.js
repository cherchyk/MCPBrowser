/**
 * compose-email.js — Compose and optionally send a new email in Gmail.
 *
 * Tier usage:
 *   T2: 'c' keyboard shortcut to open compose, Ctrl+Enter to send
 *   T3: ARIA dialog, textarea[name], input[name], div[aria-label]
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
 * Compose a new email, optionally sending it immediately.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} opts.params.to - Recipient email address (required)
 * @param {string} [opts.params.cc] - CC recipients
 * @param {string} [opts.params.subject] - Email subject
 * @param {string} [opts.params.body] - Email body text
 * @param {boolean} [opts.params.send] - If true, send immediately
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function composeEmail({ page, params }) {
  // Validate required param
  if (!params.to) {
    return new ErrorResponse(
      'The "to" parameter is required to compose an email.',
      ['Provide a recipient: compose_email({ to: "user@example.com", subject: "Hello" })']
    );
  }

  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use browser_fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  // Verify keyboard shortcuts are enabled
  const kb = await checkKeyboardShortcuts(page);
  if (!kb.enabled) {
    return new ErrorResponse(kb.error, [
      'Enable keyboard shortcuts in Gmail Settings → General → Keyboard shortcuts → ON, then reload Gmail.'
    ]);
  }

  // Close any existing compose dialog
  const existingDialog = await page.$('div[role="dialog"]');
  if (existingDialog) {
    logger.debug('composeEmail: closing existing compose dialog');
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 300));
  }

  // T2: Press 'c' to open compose
  await page.keyboard.press('c');

  // Wait for compose dialog to appear
  await waitForGmail(page, 'div[role="dialog"]');

  // Fill To field
  await page.type('textarea[name="to"]', params.to);
  await page.keyboard.press('Tab');

  // Fill CC if provided
  if (params.cc) {
    const ccLink = await page.$('span[data-tooltip="Add Cc"]') ||
                   await page.$('span.aB.gQ.pE');
    if (ccLink) {
      await ccLink.click();
    }
    await page.type('textarea[name="cc"]', params.cc);
    await page.keyboard.press('Tab');
  }

  // Fill Subject
  await page.type('input[name="subjectbox"]', params.subject || '');

  // Fill Body
  const bodyDiv = await page.$('div[aria-label="Message Body"]');
  if (bodyDiv) {
    await bodyDiv.click();
    if (params.body) {
      await page.type('div[aria-label="Message Body"]', params.body);
    }
  }

  // Send if requested
  if (params.send) {
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
    logger.debug('composeEmail: sent via Ctrl+Enter');
  }

  const status = params.send ? 'sent' : 'draft';
  const summary = params.send
    ? `Email sent to ${params.to}.`
    : `Compose draft created for ${params.to}.`;

  return new GmailActionResponse(
    { status, to: params.to, subject: params.subject || '' },
    summary,
    params.send
      ? ['Use list_emails to return to inbox']
      : ['Review and send the draft manually in Gmail']
  );
}
