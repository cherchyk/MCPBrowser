/**
 * check-availability.test.js — Unit tests for Google Calendar check_availability action.
 * Structural/precondition tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkAvailability } from '../../../src/plugins/gcal/actions/check-availability.js';

describe('checkAvailability', () => {
  it('is an async function', () => {
    assert.equal(typeof checkAvailability, 'function');
    assert.equal(checkAvailability.constructor.name, 'AsyncFunction');
  });

  it('returns error when page is not on Google Calendar', async () => {
    const mockPage = {
      url: () => 'https://example.com'
    };
    const result = await checkAvailability({
      page: mockPage,
      params: { date: '2026-04-10', startTime: '09:00', endTime: '17:00' }
    });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('Google Calendar'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when date is missing', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week'
    };
    const result = await checkAvailability({
      page: mockPage,
      params: { startTime: '09:00', endTime: '17:00' }
    });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('date'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when startTime is missing', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week'
    };
    const result = await checkAvailability({
      page: mockPage,
      params: { date: '2026-04-10', endTime: '17:00' }
    });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('startTime'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when endTime is missing', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week'
    };
    const result = await checkAvailability({
      page: mockPage,
      params: { date: '2026-04-10', startTime: '09:00' }
    });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('endTime'));
    assert.ok(result.nextSteps.length > 0);
  });

  it('returns error when startTime >= endTime', async () => {
    const mockPage = {
      url: () => 'https://calendar.google.com/calendar/u/0/r/week'
    };
    const result = await checkAvailability({
      page: mockPage,
      params: { date: '2026-04-10', startTime: '17:00', endTime: '09:00' }
    });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.ok(result.message.includes('startTime'));
    assert.ok(result.message.includes('endTime'));
    assert.ok(result.nextSteps.length > 0);
  });
});
