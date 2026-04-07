/**
 * mark-readunread.test.js — Unit tests for mark-read and mark-unread Gmail actions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { markRead } from '../../../src/plugins/gmail/actions/mark-read.js';
import { markUnread } from '../../../src/plugins/gmail/actions/mark-unread.js';
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

describe('markRead', () => {
  it('is an async function', () => {
    assert.equal(typeof markRead, 'function');
    const result = markRead({ page: mockPage('https://example.com'), params: {} });
    assert.ok(result instanceof Promise);
  });

  it('returns error when not on Gmail', async () => {
    const page = mockPage('https://example.com');
    const result = await markRead({ page, params: { index: 0 } });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('Gmail'));
  });
});

describe('markUnread', () => {
  it('is an async function', () => {
    assert.equal(typeof markUnread, 'function');
    const result = markUnread({ page: mockPage('https://example.com'), params: {} });
    assert.ok(result instanceof Promise);
  });

  it('returns error when not on Gmail', async () => {
    const page = mockPage('https://example.com');
    const result = await markUnread({ page, params: { index: 0 } });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('Gmail'));
  });
});
