/**
 * mark-readunread.test.js — Unit tests for mark-read and mark-unread Gmail actions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ErrorResponse } from '../../../src/core/responses.js';
import { ACTIONS as GMAIL_ACTIONS } from '../../../src/plugins/gmail/actions/index.js';

const markReadAction = GMAIL_ACTIONS.find((action) => action.id === 'mark_read');
const markUnreadAction = GMAIL_ACTIONS.find((action) => action.id === 'mark_unread');

const markRead = markReadAction.handler;
const markUnread = markUnreadAction.handler;

function mockPage(url) {
  return {
    url: () => url,
    evaluate: async () => false,
    $: async () => null,
    $$: async () => [],
    keyboard: {
      press: async () => {},
      down: async () => {},
      up: async () => {},
      type: async () => {},
    },
    type: async () => {},
    click: async () => {},
    waitForSelector: async () => null,
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
