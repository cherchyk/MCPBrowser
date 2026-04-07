/**
 * archive-email.test.js — Unit tests for archive-email Gmail action.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { archiveEmail } from '../../../src/plugins/gmail/actions/archive-email.js';
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

describe('archiveEmail', () => {
  it('is an async function', () => {
    assert.equal(typeof archiveEmail, 'function');
    const result = archiveEmail({ page: mockPage('https://example.com'), params: {} });
    assert.ok(result instanceof Promise);
  });

  it('returns error when not on Gmail', async () => {
    const page = mockPage('https://example.com');
    const result = await archiveEmail({ page, params: {} });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('Gmail'));
  });
});
