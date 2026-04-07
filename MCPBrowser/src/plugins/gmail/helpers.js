/**
 * helpers.js — Shared tiered utilities for the Gmail plugin.
 *
 * Provides URL-based navigation (T1), keyboard shortcut verification (T2),
 * ARIA/data-attr DOM utilities (T3), and CSS-selector data extraction (T4).
 *
 * All helpers are stateless — they inspect the page at invocation time
 * per FR-017. No internal state is maintained between calls.
 */

import { MCPResponse } from '../../core/responses.js';
import * as sel from './selectors.js';
import logger from '../../core/logger.js';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default timeout for waiting on Gmail content (FR-012) */
export const DEFAULT_TIMEOUT = 10_000;

/** Gmail view states detected from URL hash + DOM (FR-024) */
export const VIEW = Object.freeze({
  EMAIL_LIST: 'email_list',
  THREAD: 'thread',
  COMPOSE: 'compose',
  SEARCH_RESULTS: 'search_results',
  LOADING: 'loading',
  NOT_GMAIL: 'not_gmail',
  NOT_READY: 'not_ready'
});

/** Standard Gmail folder hashes */
const STANDARD_FOLDERS = new Set([
  'inbox', 'sent', 'drafts', 'trash', 'spam', 'starred', 'all', 'important'
]);

// ============================================================================
// T1: URL-BASED NAVIGATION (FR-020)
// ============================================================================

/**
 * Extract the Google account index from a Gmail URL.
 * Handles /u/0/, /u/1/, /u/2/, etc. Defaults to '0' if not found.
 * @param {string} url - Current page URL
 * @returns {string} Account index (e.g., '0', '1', '2')
 */
export function getAccountIndex(url) {
  const match = url.match(/\/u\/(\d+)\//);
  return match ? match[1] : '0';
}

/**
 * Navigate to a Gmail URL hash, preserving the current account index.
 * @param {import('puppeteer-core').Page} page
 * @param {string} hash - Hash fragment (e.g., '#inbox', '#search/query', '#inbox/threadId')
 * @returns {Promise<void>}
 */
export async function gmailNavigate(page, hash) {
  const currentUrl = page.url();
  const accountIndex = getAccountIndex(currentUrl);
  const targetUrl = `https://mail.google.com/mail/u/${accountIndex}/${hash}`;
  logger.debug(`gmailNavigate: ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: DEFAULT_TIMEOUT });
}

/**
 * Build a Gmail URL hash for a folder name.
 * Standard folders use #folder, custom labels use #label/Name.
 * @param {string} folder - Folder name (inbox, sent, etc.) or label name
 * @returns {string} Hash fragment
 */
export function folderToHash(folder) {
  const lower = folder.toLowerCase();
  if (STANDARD_FOLDERS.has(lower)) {
    return `#${lower}`;
  }
  return `#label/${encodeURIComponent(folder)}`;
}

// ============================================================================
// VIEW DETECTION (FR-024 — URL hash primary, DOM fallback)
// ============================================================================

/**
 * Detect the current Gmail view by inspecting the URL hash first (T1),
 * then falling back to DOM inspection for ambiguous cases (T3).
 * Also detects CAPTCHA/interstitial states returning NOT_READY.
 * @param {import('puppeteer-core').Page} page
 * @returns {Promise<string>} One of VIEW enum values
 */
export async function detectView(page) {
  const url = page.url();

  // Not Gmail at all
  if (!url.includes('mail.google.com')) {
    logger.debug('detectView: not Gmail');
    return VIEW.NOT_GMAIL;
  }

  // Check for CAPTCHA / security interstitial (edge case)
  const hasInterstitial = await page.evaluate(() => {
    const body = document.body?.textContent || '';
    return body.includes('Confirm it') ||
           !!document.querySelector('iframe[src*="accounts.google.com"]') ||
           !!document.querySelector('#captcha');
  });
  if (hasInterstitial) {
    logger.debug('detectView: not_ready (interstitial/CAPTCHA)');
    return VIEW.NOT_READY;
  }

  // Parse URL hash
  const hashMatch = url.match(/#(.+)/);
  const hash = hashMatch ? hashMatch[1] : '';

  // Check for compose overlay via DOM (compose can appear over any view)
  const hasComposeDialog = await page.evaluate(() =>
    !!document.querySelector('div[role="dialog"]')
  );
  if (hasComposeDialog) {
    logger.debug('detectView: compose (dialog overlay)');
    return VIEW.COMPOSE;
  }

  // Search results
  if (hash.startsWith('search/')) {
    logger.debug('detectView: search_results');
    return VIEW.SEARCH_RESULTS;
  }

  // Thread view — hash contains folder/threadId pattern
  if (/^(inbox|sent|all|drafts|trash|spam|starred|important|label\/[^/]+)\/[A-Za-z0-9]+/.test(hash)) {
    logger.debug('detectView: thread');
    return VIEW.THREAD;
  }

  // Standard folder or label view
  if (hash === '' || hash === 'inbox' || STANDARD_FOLDERS.has(hash) || hash.startsWith('label/')) {
    // Check if content has loaded
    const hasMain = await page.evaluate(() =>
      !!document.querySelector('div[role="main"]')
    );
    if (!hasMain) {
      logger.debug('detectView: loading');
      return VIEW.LOADING;
    }
    logger.debug('detectView: email_list');
    return VIEW.EMAIL_LIST;
  }

  // Fallback — check if main content exists
  const hasMain = await page.evaluate(() =>
    !!document.querySelector('div[role="main"]')
  );
  if (hasMain) {
    logger.debug('detectView: email_list (fallback)');
    return VIEW.EMAIL_LIST;
  }

  logger.debug('detectView: loading (no main container)');
  return VIEW.LOADING;
}

// ============================================================================
// T2: KEYBOARD SHORTCUT VERIFICATION (FR-019)
// ============================================================================

/**
 * Check whether Gmail keyboard shortcuts are enabled.
 * Sends '?' to trigger the shortcuts help dialog, then detects it.
 * @param {import('puppeteer-core').Page} page
 * @returns {Promise<{enabled: boolean, error?: string}>}
 */
export async function checkKeyboardShortcuts(page) {
  try {
    // Ensure no input is focused before sending shortcut
    await page.evaluate(() => {
      if (document.activeElement && document.activeElement.tagName !== 'BODY') {
        document.activeElement.blur();
      }
    });

    // Send ? (Shift+/) to open shortcuts help
    await page.keyboard.down('Shift');
    await page.keyboard.press('/');
    await page.keyboard.up('Shift');

    // Wait briefly for the dialog
    const dialog = await page.waitForSelector(
      'div[role="dialog"]',
      { timeout: 2000 }
    ).catch(() => null);

    if (dialog) {
      // Close the help dialog
      await page.keyboard.press('Escape');
      return { enabled: true };
    }

    return {
      enabled: false,
      error: 'Gmail keyboard shortcuts are disabled. Enable them in Gmail Settings → General → Keyboard shortcuts → ON, then reload Gmail.'
    };
  } catch {
    return {
      enabled: false,
      error: 'Could not verify Gmail keyboard shortcuts. Ensure Gmail is fully loaded.'
    };
  }
}

// ============================================================================
// PRECONDITION CHECKING (FR-025)
// ============================================================================

/**
 * Validate a precondition before sending a keyboard shortcut.
 * Fails early with an actionable error if the precondition is not met.
 * @param {import('puppeteer-core').Page} page
 * @param {'on_gmail'|'thread_open'|'list_view'} requirement
 * @returns {Promise<{met: boolean, error?: string, suggestion?: string}>}
 */
export async function checkPrecondition(page, requirement) {
  const url = page.url();

  switch (requirement) {
    case 'on_gmail': {
      if (!url.includes('mail.google.com')) {
        return {
          met: false,
          error: 'Gmail is not the active page.',
          suggestion: "Use fetch_webpage({ url: 'https://mail.google.com' }) to navigate to Gmail first."
        };
      }
      return { met: true };
    }

    case 'thread_open': {
      const hash = url.match(/#(.+)/)?.[1] || '';
      const isThread = /^(inbox|sent|all|drafts|trash|spam|starred|important|label\/[^/]+)\/[A-Za-z0-9]+/.test(hash);
      if (!isThread) {
        return {
          met: false,
          error: 'No email thread is currently open.',
          suggestion: "Use plugin_action({ plugin: 'gmail', action: 'read_email', params: { index: 0 } }) to open an email first."
        };
      }
      return { met: true };
    }

    case 'list_view': {
      const view = await detectView(page);
      if (view !== VIEW.EMAIL_LIST && view !== VIEW.SEARCH_RESULTS) {
        return {
          met: false,
          error: 'Not in email list view.',
          suggestion: "Use plugin_action({ plugin: 'gmail', action: 'list_emails' }) to return to the email list."
        };
      }
      return { met: true };
    }

    default:
      return { met: false, error: `Unknown precondition: ${requirement}` };
  }
}

// ============================================================================
// CONTENT WAITING (FR-012 — 10s timeout with diagnostics)
// ============================================================================

/**
 * Wait for a Gmail element to appear, with timeout and diagnostic error.
 * Timeout errors include the selector name per Constitution IV.
 * @param {import('puppeteer-core').Page} page
 * @param {string} selector - CSS selector to wait for
 * @param {number} [timeout=DEFAULT_TIMEOUT]
 * @returns {Promise<void>}
 * @throws {Error} With selector name and tier in message on timeout
 */
export async function waitForGmail(page, selector, timeout = DEFAULT_TIMEOUT) {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch {
    throw new Error(
      `Gmail content did not load within ${timeout}ms. ` +
      `Selector that failed: "${selector}". ` +
      `The page may still be loading or Gmail's UI may have changed.`
    );
  }
}

// ============================================================================
// EMAIL ROW SELECTION — Hybrid DOM+keyboard (FR-016)
// ============================================================================

/**
 * Locate and select an email row by ID or positional index.
 * Uses T3 (data-legacy-message-id, role="checkbox") with T4 fallback.
 * Clicks the row's checkbox to select it for keyboard actions.
 * @param {import('puppeteer-core').Page} page
 * @param {{ index?: number, id?: string }} target
 * @returns {Promise<{selected: boolean, error?: string}>}
 */
export async function selectEmailRow(page, { index, id } = {}) {
  if (id !== undefined && id !== null) {
    // T3: Prefer ID-based selection via data attribute
    const row = await page.$(`tr[data-legacy-message-id="${id}"]`);
    if (row) {
      const checkbox = await row.$('div[role="checkbox"]');
      if (checkbox) {
        await checkbox.click();
        logger.debug(`selectEmailRow: selected by ID "${id}"`);
        return { selected: true };
      }
    }
    logger.debug(`selectEmailRow: ID "${id}" not found, trying index fallback`);
  }

  if (index !== undefined && index !== null) {
    // T4: Positional index via CSS class selector
    const rows = await page.$$(sel.EMAIL_ROW);
    if (index >= 0 && index < rows.length) {
      const checkbox = await rows[index].$('div[role="checkbox"]');
      if (checkbox) {
        await checkbox.click();
        logger.debug(`selectEmailRow: selected by index ${index}`);
        return { selected: true };
      }
    }
    return {
      selected: false,
      error: `Email index ${index} is out of range. There are ${(await page.$$(sel.EMAIL_ROW)).length} visible emails.`
    };
  }

  return { selected: false, error: 'No index or id provided for email selection.' };
}

// ============================================================================
// EMAIL ROW EXTRACTION — T3+T4 data extraction
// ============================================================================

/**
 * Extract structured email summary data from visible email rows.
 * Uses T3 (span[email], [data-legacy-message-id]) and T4 (CSS selectors).
 * @param {import('puppeteer-core').Page} page
 * @param {number} [limit=25]
 * @returns {Promise<Array>} Array of EmailSummary objects per data-model.md
 */
export async function extractEmailRows(page, limit = 25) {
  return page.evaluate((selectors, lim) => {
    const rows = document.querySelectorAll(selectors.emailRow);
    const results = [];
    const count = Math.min(rows.length, lim);

    for (let i = 0; i < count; i++) {
      const row = rows[i];
      // T3: span[email] for sender data
      const senderEl = row.querySelector('span[email]');
      // T4: CSS class selectors for subject, snippet, date
      const subjectEl = row.querySelector(selectors.subjectSpan);
      const snippetEl = row.querySelector(selectors.snippetSpan);
      const dateEl = row.querySelector(selectors.dateCell);
      // T4: Unread detection via class
      const isUnread = row.classList.contains(selectors.unreadClass);
      // T3: data attribute for ID
      const id = row.getAttribute('data-legacy-message-id') || undefined;

      results.push({
        index: i,
        id,
        sender: senderEl?.getAttribute('name') || senderEl?.textContent?.trim() || '',
        senderEmail: senderEl?.getAttribute('email') || '',
        subject: subjectEl?.textContent?.trim() || '',
        snippet: snippetEl?.textContent?.trim() || '',
        date: dateEl?.getAttribute('title') || dateEl?.textContent?.trim() || '',
        isUnread
      });
    }
    return results;
  }, {
    emailRow: sel.EMAIL_ROW,
    subjectSpan: sel.SUBJECT_SPAN,
    snippetSpan: sel.SNIPPET_SPAN,
    dateCell: sel.DATE_CELL,
    unreadClass: sel.EMAIL_ROW_UNREAD
  }, limit);
}

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Gmail-specific response class extending MCPResponse.
 * Carries structured email data alongside nextSteps.
 */
export class GmailActionResponse extends MCPResponse {
  /**
   * @param {object} data - Structured data payload
   * @param {string} summary - Human-readable summary text
   * @param {string[]} nextSteps - Suggested next actions
   */
  constructor(data, summary, nextSteps) {
    super(nextSteps);
    this.data = data;
    this._summary = summary;
  }

  _getAdditionalFields() {
    return { ...this.data };
  }

  getTextSummary() {
    return this._summary;
  }
}
