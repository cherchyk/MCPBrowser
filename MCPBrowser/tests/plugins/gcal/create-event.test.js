/**
 * create-event.test.js — Unit tests for Google Calendar create_event action.
 * Structural/precondition tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS as GCAL_ACTIONS } from '../../../src/plugins/gcal/actions/index.js';

const createEventAction = GCAL_ACTIONS.find((action) => action.id === 'create_event');

const createEvent = createEventAction.handler;

describe('createEvent', () => {
  it('is an async function', () => {
    assert.equal(typeof createEvent, 'function');
    assert.equal(createEvent.constructor.name, 'AsyncFunction');
  });

  it('returns error when page is not on Google Calendar', async () => {
    const mockPage = {
      url: () => 'https://example.com',
    };
    const result = await createEvent({ page: mockPage, params: { title: 'Test' } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Google Calendar'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when title is missing', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week',
    };
    const result = await createEvent({ page: mockPage, params: {} });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('title'));
    assert.ok(result.nextSteps.length > 0);
  });
});
