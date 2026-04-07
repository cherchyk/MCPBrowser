/**
 * label-email.js — Apply a label to an email using the label picker.
 *
 * Tier usage:
 *   T2: 'l' keyboard shortcut to open label picker
 *   T3: selectEmailRow for list view targeting
 *   T4: LABEL_ITEM selector for matching labels
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  checkKeyboardShortcuts,
  detectView,
  selectEmailRow,
  waitForGmail,
  VIEW,
  GmailActionResponse
} from '../helpers.js';
import { LABEL_ITEM } from '../selectors.js';

/**
 * Apply a label to an email.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} opts.params.label - Label name to apply (required)
 * @param {number} [opts.params.index] - Email index in list view
 * @param {string} [opts.params.id] - Email ID in list view
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function labelEmail({ page, params }) {
  // Validate required param
  if (!params.label) {
    return new ErrorResponse(
      'The "label" parameter is required.',
      ['Provide a label name: label_email({ label: "Important" })']
    );
  }

  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  const view = await detectView(page);

  // Select email row if in list view
  if (view === VIEW.EMAIL_LIST || view === VIEW.SEARCH_RESULTS) {
    const sel = await selectEmailRow(page, { index: params.index, id: params.id });
    if (!sel.selected) {
      return new ErrorResponse(sel.error || 'Could not select email to label.', [
        'Provide an index or id parameter to target a specific email.'
      ]);
    }
  }

  // Verify keyboard shortcuts are enabled
  const kb = await checkKeyboardShortcuts(page);
  if (!kb.enabled) {
    return new ErrorResponse(kb.error, [
      'Enable keyboard shortcuts in Gmail Settings → General → Keyboard shortcuts → ON, then reload Gmail.'
    ]);
  }

  // T2: Press 'l' to open label picker
  await page.keyboard.press('l');
  logger.debug('labelEmail: pressed "l" to open label picker');

  // Wait for label picker overlay
  await waitForGmail(page, LABEL_ITEM);

  // Find matching label in the picker
  const result = await page.evaluate((selector, targetLabel) => {
    const items = document.querySelectorAll(selector);
    const labels = [];
    for (const item of items) {
      const text = item.textContent?.trim() || '';
      labels.push(text);
      if (text.toLowerCase() === targetLabel.toLowerCase()) {
        item.click();
        return { found: true, label: text };
      }
    }
    return { found: false, visibleLabels: labels };
  }, LABEL_ITEM, params.label);

  if (!result.found) {
    return new ErrorResponse(
      `Label "${params.label}" not found in the label picker.`,
      [
        `Available labels: ${(result.visibleLabels || []).join(', ') || '(none visible)'}`,
        'Check the exact label name and try again.'
      ]
    );
  }

  return new GmailActionResponse(
    { labeled: true, label: result.label },
    `Label "${result.label}" applied to email.`,
    ['Use list_emails to return to inbox']
  );
}
