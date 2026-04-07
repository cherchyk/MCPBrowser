/**
 * search-emails.test.js — Unit tests for Gmail search_emails action.
 * Structural/precondition tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchEmails } from '../../../src/plugins/gmail/actions/search-emails.js';

describe('searchEmails', () => {
  it('is an async function', () => {
    assert.equal(typeof searchEmails, 'function');
    assert.equal(searchEmails.constructor.name, 'AsyncFunction');
  });

  it('returns error when query is empty', async () => {
    const mockPage = {
      url: () => 'https://mail.google.com/mail/u/0/#inbox'
    };
    const result = await searchEmails({ page: mockPage, params: { query: '' } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('query'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when query is missing', async () => {
    const mockPage = {
      url: () => 'https://mail.google.com/mail/u/0/#inbox'
    };
    const result = await searchEmails({ page: mockPage, params: {} });
    assert.equal(result.constructor.name, 'ErrorResponse');
  });

  it('returns error when page is not on Gmail', async () => {
    const mockPage = {
      url: () => 'https://example.com'
    };
    const result = await searchEmails({ page: mockPage, params: { query: 'test' } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Gmail'));
  });
});
