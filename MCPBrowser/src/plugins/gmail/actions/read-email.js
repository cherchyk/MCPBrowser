/**
 * read-email.js — Open and read a specific email thread.
 *
 * Tier usage:
 *   T1: gmailNavigate to thread by ID hash
 *   T2: keyboard shortcut 'o' to open selected row
 *   T3: span[email] for sender extraction
 *   T4: MESSAGE_CONTAINER, MSG_BODY, MSG_DATE, THREAD_SUBJECT, ATTACHMENT_* selectors
 */

import { ErrorResponse } from '../../../core/responses.js';
import {
  checkPrecondition,
  gmailNavigate,
  checkKeyboardShortcuts,
  selectEmailRow,
  waitForGmail,
  GmailActionResponse
} from '../helpers.js';
import {
  THREAD_SUBJECT,
  MESSAGE_CONTAINER,
  MSG_BODY,
  MSG_DATE,
  ATTACHMENT_AREA,
  ATTACHMENT_NAME,
  ATTACHMENT_SIZE
} from '../selectors.js';

/**
 * Open and read a specific email by ID or list index.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} [opts.params.id] - Gmail thread/message ID
 * @param {number} [opts.params.index] - Positional index in current list view
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function readEmail({ page, params }) {
  if (params.id == null && params.index == null) {
    return new ErrorResponse(
      'Either id or index is required to read an email.',
      [
        'Use list_emails to see available emails and their indices',
        'Use search_emails to find a specific email by keyword'
      ]
    );
  }

  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  if (params.id) {
    // T1: Navigate directly to thread by ID
    await gmailNavigate(page, '#inbox/' + params.id);
  } else {
    // T2: Select row by index, then open with keyboard shortcut
    const kb = await checkKeyboardShortcuts(page);
    if (!kb.enabled) {
      return new ErrorResponse(
        kb.error || 'Keyboard shortcuts are not enabled in Gmail.',
        ['Enable keyboard shortcuts in Gmail Settings → General → Keyboard shortcuts → ON, then reload Gmail.']
      );
    }

    const sel = await selectEmailRow(page, { index: params.index });
    if (!sel.selected) {
      return new ErrorResponse(
        sel.error || `Could not select email at index ${params.index}.`,
        ['Use list_emails to check available email indices']
      );
    }

    // T2: Press 'o' to open the selected email
    await page.keyboard.press('o');
  }

  // Wait for thread content to load
  await waitForGmail(page, THREAD_SUBJECT);

  // T3+T4: Extract thread data from DOM
  const thread = await page.evaluate((selectors) => {
    const subjectEl = document.querySelector(selectors.threadSubject);
    const subject = subjectEl?.textContent?.trim() || '';

    const containers = document.querySelectorAll(selectors.messageContainer);
    const messages = [];

    for (const container of containers) {
      // T3: span[email] for sender info
      const senderEl = container.querySelector('span[email]');
      const sender = senderEl?.getAttribute('name') || senderEl?.textContent?.trim() || '';
      const senderEmail = senderEl?.getAttribute('email') || '';

      // T4: CSS selectors for body, date, attachments
      const bodyEl = container.querySelector(selectors.msgBody);
      const body = bodyEl?.textContent?.trim() || '';

      const dateEl = container.querySelector(selectors.msgDate);
      const date = dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || '';

      const attachments = [];
      const attachArea = container.querySelector(selectors.attachmentArea);
      if (attachArea) {
        const nameEls = attachArea.querySelectorAll(selectors.attachmentName);
        const sizeEls = attachArea.querySelectorAll(selectors.attachmentSize);
        for (let i = 0; i < nameEls.length; i++) {
          attachments.push({
            name: nameEls[i]?.textContent?.trim() || '',
            size: sizeEls[i]?.textContent?.trim() || ''
          });
        }
      }

      messages.push({ sender, senderEmail, date, body, attachments });
    }

    // Attempt to extract thread ID from URL hash
    const hash = window.location.hash || '';
    const idMatch = hash.match(/\/([A-Za-z0-9]+)$/);
    const id = idMatch ? idMatch[1] : undefined;

    return { id, subject, messageCount: messages.length, messages };
  }, {
    threadSubject: THREAD_SUBJECT,
    messageContainer: MESSAGE_CONTAINER,
    msgBody: MSG_BODY,
    msgDate: MSG_DATE,
    attachmentArea: ATTACHMENT_AREA,
    attachmentName: ATTACHMENT_NAME,
    attachmentSize: ATTACHMENT_SIZE
  });

  return new GmailActionResponse(
    { thread },
    `Email: "${thread.subject}" — ${thread.messageCount} message(s).`,
    [
      'Use reply_email to respond',
      'Use forward_email to forward',
      'Use archive_email to archive',
      'Use list_emails to return to inbox'
    ]
  );
}
