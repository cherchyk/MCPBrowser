/**
 * delete-email.test.js — Unit tests for delete-email Gmail action.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ErrorResponse } from '../../../src/core/responses.js';
import { ACTIONS as GMAIL_ACTIONS } from '../../../src/plugins/gmail/actions/index.js';

const deleteEmailAction = GMAIL_ACTIONS.find((action) => action.id === 'delete_email');

const deleteEmail = deleteEmailAction.handler;

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

describe('deleteEmail', () => {
  it('is an async function', () => {
    assert.equal(typeof deleteEmail, 'function');
    const result = deleteEmail({ page: mockPage('https://example.com'), params: {} });
    assert.ok(result instanceof Promise);
  });

  it('returns error when not on Gmail', async () => {
    const page = mockPage('https://example.com');
    const result = await deleteEmail({ page, params: {} });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('Gmail'));
  });
});
