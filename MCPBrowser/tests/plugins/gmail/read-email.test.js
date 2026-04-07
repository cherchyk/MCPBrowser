/**
 * read-email.test.js — Unit tests for Gmail read_email action.
 * Structural/precondition tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readEmail } from '../../../src/plugins/gmail/actions/read-email.js';

describe('readEmail', () => {
  it('is an async function', () => {
    assert.equal(typeof readEmail, 'function');
    assert.equal(readEmail.constructor.name, 'AsyncFunction');
  });

  it('returns error when neither id nor index is provided', async () => {
    const mockPage = {
      url: () => 'https://mail.google.com/mail/u/0/#inbox'
    };
    const result = await readEmail({ page: mockPage, params: {} });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('id or index'));
    assert.ok(result.nextSteps.length > 0);
  });
});
