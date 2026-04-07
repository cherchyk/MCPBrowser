/**
 * list-events.test.js — Unit tests for Google Calendar list_events action.
 * Structural/precondition tests; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { listEvents } from '../../../src/plugins/gcal/actions/list-events.js';

describe('listEvents', () => {
  it('is an async function', () => {
    assert.equal(typeof listEvents, 'function');
    assert.equal(listEvents.constructor.name, 'AsyncFunction');
  });

  it('returns error when page is not on Google Calendar', async () => {
    const mockPage = {
      url: () => 'https://example.com'
    };
    const result = await listEvents({ page: mockPage, params: {} });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Google Calendar'));
    assert.ok(result.nextSteps.length > 0);
  });
});
