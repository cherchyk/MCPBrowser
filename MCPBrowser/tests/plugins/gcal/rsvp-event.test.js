/**
 * rsvp-event.test.js — Unit tests for Google Calendar rsvp_event action.
 * Structural/precondition tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIONS as GCAL_ACTIONS } from '../../../src/plugins/gcal/actions/index.js';

const rsvpEventAction = GCAL_ACTIONS.find((action) => action.id === 'rsvp_event');

const rsvpEvent = rsvpEventAction.handler;

describe('rsvpEvent', () => {
  it('is an async function', () => {
    assert.equal(typeof rsvpEvent, 'function');
    assert.equal(rsvpEvent.constructor.name, 'AsyncFunction');
  });

  it('returns error when page is not on Google Calendar', async () => {
    const mockPage = {
      url: () => 'https://example.com',
    };
    const result = await rsvpEvent({ page: mockPage, params: { index: 0, response: 'accept' } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Google Calendar'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when response is invalid', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week',
    };
    const result = await rsvpEvent({ page: mockPage, params: { index: 0, response: 'invalid' } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Invalid RSVP response'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when neither index nor id provided', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week',
    };
    const result = await rsvpEvent({ page: mockPage, params: { response: 'accept' } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('index') || result.message.includes('id'));
    assert.ok(result.nextSteps.length > 0);
  });
});
