/**
 * label-email.test.js — Unit tests for label-email Gmail action.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ErrorResponse } from '../../../src/core/responses.js';
import { ACTIONS as GMAIL_ACTIONS } from '../../../src/plugins/gmail/actions/index.js';

const labelEmailAction = GMAIL_ACTIONS.find((action) => action.id === 'label_email');

const labelEmail = labelEmailAction.handler;

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

describe('labelEmail', () => {
  it('is an async function', () => {
    assert.equal(typeof labelEmail, 'function');
    const result = labelEmail({ page: mockPage('https://example.com'), params: {} });
    assert.ok(result instanceof Promise);
  });

  it('returns error when label param is missing', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await labelEmail({ page, params: {} });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('"label" parameter'));
  });

  it('returns error when label param is empty', async () => {
    const page = mockPage('https://mail.google.com/mail/u/0/#inbox');
    const result = await labelEmail({ page, params: { label: '' } });
    assert.ok(result instanceof ErrorResponse);
    assert.ok(result.message.includes('"label" parameter'));
  });
});
