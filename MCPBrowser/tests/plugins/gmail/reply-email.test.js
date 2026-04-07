/**
 * reply-email.test.js — Unit tests for reply-email Gmail action.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { replyEmail } from '../../../src/plugins/gmail/actions/reply-email.js';
import { ErrorResponse } from '../../../src/core/responses.js';

function mockPage(url) {
  return {
    url: () => url,
    evaluate: async () => false,
    $: async () => null,
    $$: async () => [],
    keyboard: { press: async () => {}, down: async () => {}, up: async () => {}, type: async () => {} },
    type: async () => {},
    click: async () => {},
    waitForSelector: async () => null
  };
}

describe('replyEmail', () => {
  it('is an async function', () => {
    assert.equal(typeof replyEmail, 'function');
    const result = replyEmail({ page: mockPage('https://example.com'), params: {} });
    assert.ok(result instanceof Promise);
  });

  it('returns error when no thread is open', async () => {
    // #inbox URL with no thread ID — thread_open precondition fails
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await replyEmail({ page, params: { body: 'test' } });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('thread'));
  });

  it('returns error when not on Gmail', async () => {
    const page = mockPage('https://example.com');
    const result = await replyEmail({ page, params: {} });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('Gmail'));
  });
});
