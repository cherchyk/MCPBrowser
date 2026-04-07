/**
 * compose-email.test.js — Unit tests for compose-email Gmail action.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { composeEmail } from '../../../src/plugins/gmail/actions/compose-email.js';
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

describe('composeEmail', () => {
  it('is an async function', () => {
    assert.equal(typeof composeEmail, 'function');
    const result = composeEmail({ page: mockPage('https://example.com'), params: {} });
    assert.ok(result instanceof Promise);
  });

  it('returns error when "to" is empty string', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await composeEmail({ page, params: { to: '' } });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('"to" parameter'));
  });

  it('returns error when "to" is missing', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await composeEmail({ page, params: {} });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('"to" parameter'));
  });

  it('returns error when not on Gmail', async () => {
    const page = mockPage('https://example.com');
    const result = await composeEmail({ page, params: { to: 'test@example.com' } });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('Gmail'));
  });
});
