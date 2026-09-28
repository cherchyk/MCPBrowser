/**
 * list-emails.test.js — Unit tests for Gmail list_emails action.
 * Structural/precondition tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS as GMAIL_ACTIONS } from '../../../src/plugins/gmail/actions/index.js';

const listEmailsAction = GMAIL_ACTIONS.find((action) => action.id === 'list_emails');

const listEmails = listEmailsAction.handler;

describe('listEmails', () => {
  it('is an async function', () => {
    assert.equal(typeof listEmails, 'function');
    assert.equal(listEmails.constructor.name, 'AsyncFunction');
  });

  it('returns error when page is not on Gmail', async () => {
    const mockPage = {
      url: () => 'https://example.com',
    };
    const result = await listEmails({ page: mockPage, params: {} });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Gmail'));
    assert.ok(result.nextSteps.length > 0);
  });
});
