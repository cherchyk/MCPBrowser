/**
 * read-event.test.js — Unit tests for Google Calendar read_event action.
 * Structural/precondition tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readEvent } from '../../../src/plugins/gcal/actions/read-event.js';

describe('readEvent', () => {
  it('is an async function', () => {
    assert.equal(typeof readEvent, 'function');
    assert.equal(readEvent.constructor.name, 'AsyncFunction');
  });

  it('returns error when page is not on Google Calendar', async () => {
    const mockPage = {
      url: () => 'https://example.com'
    };
    const result = await readEvent({ page: mockPage, params: { index: 0 } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Google Calendar'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when neither index nor id provided', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week'
    };
    const result = await readEvent({ page: mockPage, params: {} });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('index') || result.message.includes('id'));
    assert.ok(result.nextSteps.length > 0);
  });
});
