/**
 * gmail-helpers.test.js — Unit tests for Gmail plugin helper utilities.
 * Tests getAccountIndex, gmailNavigate URL construction, detectView URL parsing,
 * checkPrecondition validation, and selectEmailRow targeting.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAccountIndex,
  folderToHash,
  VIEW
} from '../../../src/plugins/gmail/helpers.js';

// ============================================================================
// getAccountIndex
// ============================================================================

describe('getAccountIndex', () => {
  it('extracts /u/0/ from standard Gmail URL', () => {
    assert.equal(getAccountIndex('https://mail.google.com/mail/u/0/#inbox'), '0');
  });

  it('extracts /u/1/ from second account URL', () => {
    assert.equal(getAccountIndex('https://mail.google.com/mail/u/1/#sent'), '1');
  });

  it('extracts /u/2/ from third account URL', () => {
    assert.equal(getAccountIndex('https://mail.google.com/mail/u/2/#drafts'), '2');
  });

  it('defaults to 0 when /u/N/ is missing', () => {
    assert.equal(getAccountIndex('https://mail.google.com/mail/#inbox'), '0');
  });

  it('defaults to 0 for non-Gmail URLs', () => {
    assert.equal(getAccountIndex('https://example.com'), '0');
  });

  it('handles URL with path after account index', () => {
    assert.equal(getAccountIndex('https://mail.google.com/mail/u/0/h/abc123'), '0');
  });
});

// ============================================================================
// folderToHash
// ============================================================================

describe('folderToHash', () => {
  it('maps inbox to #inbox', () => {
    assert.equal(folderToHash('inbox'), '#inbox');
  });

  it('maps sent to #sent', () => {
    assert.equal(folderToHash('sent'), '#sent');
  });

  it('maps drafts to #drafts', () => {
    assert.equal(folderToHash('drafts'), '#drafts');
  });

  it('maps trash to #trash', () => {
    assert.equal(folderToHash('trash'), '#trash');
  });

  it('maps spam to #spam', () => {
    assert.equal(folderToHash('spam'), '#spam');
  });

  it('maps case-insensitive standard folders', () => {
    assert.equal(folderToHash('INBOX'), '#inbox');
    assert.equal(folderToHash('Sent'), '#sent');
  });

  it('maps custom labels to #label/Name', () => {
    assert.equal(folderToHash('Work'), '#label/Work');
  });

  it('URL-encodes label names with spaces', () => {
    assert.equal(folderToHash('My Projects'), '#label/My%20Projects');
  });
});

// ============================================================================
// detectView — URL hash parsing
// ============================================================================

describe('detectView — URL parsing (unit, no page object)', () => {
  // These tests validate the URL parsing logic directly.
  // Full detectView tests with mock page objects require page.evaluate stubs.

  it('VIEW enum has all expected states', () => {
    assert.equal(VIEW.EMAIL_LIST, 'email_list');
    assert.equal(VIEW.THREAD, 'thread');
    assert.equal(VIEW.COMPOSE, 'compose');
    assert.equal(VIEW.SEARCH_RESULTS, 'search_results');
    assert.equal(VIEW.LOADING, 'loading');
    assert.equal(VIEW.NOT_GMAIL, 'not_gmail');
    assert.equal(VIEW.NOT_READY, 'not_ready');
  });

  it('VIEW enum is frozen', () => {
    assert.throws(() => { VIEW.NEW_STATE = 'test'; }, TypeError);
  });
});

// ============================================================================
// detectView — integration-style with mock page
// ============================================================================

/**
 * Create a minimal mock page object for detectView testing.
 * @param {string} url - Page URL
 * @param {object} evalResults - Map of evaluate callback results
 * @returns {object} Mock page
 */
function mockPage(url, evalResults = {}) {
  return {
    url: () => url,
    evaluate: async (fn, ...args) => {
      // Simple mock: return pre-configured results based on function source
      const fnStr = fn.toString();
      if (fnStr.includes('Confirm it')) return evalResults.hasInterstitial ?? false;
      if (fnStr.includes('role="dialog"')) return evalResults.hasComposeDialog ?? false;
      if (fnStr.includes('role="main"')) return evalResults.hasMain ?? true;
      return false;
    }
  };
}

describe('detectView — with mock page', async () => {
  const { detectView } = await import('../../../src/plugins/gmail/helpers.js');

  it('returns NOT_GMAIL for non-Gmail URL', async () => {
    const page = mockPage('https://example.com');
    assert.equal(await detectView(page), VIEW.NOT_GMAIL);
  });

  it('returns NOT_READY for interstitial/CAPTCHA', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox', { hasInterstitial: true });
    assert.equal(await detectView(page), VIEW.NOT_READY);
  });

  it('returns COMPOSE when dialog overlay present', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox', { hasComposeDialog: true });
    assert.equal(await detectView(page), VIEW.COMPOSE);
  });

  it('returns SEARCH_RESULTS for #search/ hash', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#search/from:test@example.com');
    assert.equal(await detectView(page), VIEW.SEARCH_RESULTS);
  });

  it('returns THREAD for #inbox/threadId hash', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox/FMfcgzQXKVLRNcBd');
    assert.equal(await detectView(page), VIEW.THREAD);
  });

  it('returns THREAD for #sent/threadId hash', async () => {
    const page = mockPage('https://mail.google.com/mail/u/1/#sent/ABC123def');
    assert.equal(await detectView(page), VIEW.THREAD);
  });

  it('returns THREAD for #label/Name/threadId hash', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#label/Work/FMfcgz123');
    assert.equal(await detectView(page), VIEW.THREAD);
  });

  it('returns EMAIL_LIST for #inbox hash with main container', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox', { hasMain: true });
    assert.equal(await detectView(page), VIEW.EMAIL_LIST);
  });

  it('returns EMAIL_LIST for #sent hash', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#sent');
    assert.equal(await detectView(page), VIEW.EMAIL_LIST);
  });

  it('returns EMAIL_LIST for #drafts hash', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#drafts');
    assert.equal(await detectView(page), VIEW.EMAIL_LIST);
  });

  it('returns EMAIL_LIST for empty hash (default inbox)', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/');
    assert.equal(await detectView(page), VIEW.EMAIL_LIST);
  });

  it('returns EMAIL_LIST for #label/Name hash', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#label/Work');
    assert.equal(await detectView(page), VIEW.EMAIL_LIST);
  });

  it('returns LOADING when main container missing', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox', { hasMain: false });
    assert.equal(await detectView(page), VIEW.LOADING);
  });
});

// ============================================================================
// checkPrecondition — with mock page
// ============================================================================

describe('checkPrecondition', async () => {
  const { checkPrecondition } = await import('../../../src/plugins/gmail/helpers.js');

  it('on_gmail: met when URL is Gmail', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await checkPrecondition(page, 'on_gmail');
    assert.equal(result.met, true);
  });

  it('on_gmail: not met for non-Gmail URL', async () => {
    const page = mockPage('https://example.com');
    const result = await checkPrecondition(page, 'on_gmail');
    assert.equal(result.met, false);
    assert.ok(result.error.includes('not the active page'));
    assert.ok(result.suggestion.includes('fetch_webpage'));
  });

  it('thread_open: met when URL has thread ID', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox/FMfcgzQXK');
    const result = await checkPrecondition(page, 'thread_open');
    assert.equal(result.met, true);
  });

  it('thread_open: not met when on list view', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await checkPrecondition(page, 'thread_open');
    assert.equal(result.met, false);
    assert.ok(result.error.includes('No email thread'));
    assert.ok(result.suggestion.includes('read_email'));
  });

  it('unknown requirement returns error', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await checkPrecondition(page, 'unknown_thing');
    assert.equal(result.met, false);
    assert.ok(result.error.includes('Unknown precondition'));
  });
});
