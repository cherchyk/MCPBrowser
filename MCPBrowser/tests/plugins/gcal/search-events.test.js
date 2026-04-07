/**
 * search-events.test.js — Unit tests for Google Calendar search_events action.
 * Structural/precondition tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { searchEvents } from '../../../src/plugins/gcal/actions/search-events.js';

describe('searchEvents', () => {
  it('is an async function', () => {
    assert.equal(typeof searchEvents, 'function');
    assert.equal(searchEvents.constructor.name, 'AsyncFunction');
  });

  it('returns error when page is not on Google Calendar', async () => {
    const mockPage = {
      url: () => 'https://example.com'
    };
    const result = await searchEvents({ page: mockPage, params: { query: 'test' } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Google Calendar'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when query is missing', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week'
    };
    const result = await searchEvents({ page: mockPage, params: {} });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('query'));
    assert.ok(result.nextSteps.length > 0);
  });
});
