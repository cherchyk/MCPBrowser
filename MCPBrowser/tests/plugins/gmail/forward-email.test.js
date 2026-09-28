/**
 * forward-email.test.js — Unit tests for forward-email Gmail action.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ErrorResponse } from '../../../src/core/responses.js';
import { ACTIONS as GMAIL_ACTIONS } from '../../../src/plugins/gmail/actions/index.js';

const forwardEmailAction = GMAIL_ACTIONS.find((action) => action.id === 'forward_email');

const forwardEmail = forwardEmailAction.handler;

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

describe('forwardEmail', () => {
  it('is an async function', () => {
    assert.equal(typeof forwardEmail, 'function');
    const result = forwardEmail({ page: mockPage('https://example.com'), params: {} });
    assert.ok(result instanceof Promise);
  });

  it('returns error when no thread is open', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await forwardEmail({ page, params: { to: 'fwd@example.com' } });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('thread'));
  });

  it('returns error when not on Gmail', async () => {
    const page = mockPage('https://example.com');
    const result = await forwardEmail({ page, params: { to: 'fwd@example.com' } });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('Gmail'));
  });
});
