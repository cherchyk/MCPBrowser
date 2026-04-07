/**
 * gcal-helpers.test.js — Unit tests for Google Calendar plugin helper utilities.
 * Tests getAccountIndex, calendarNavigate URL construction, buildViewPath,
 * detectView URL parsing, checkPrecondition validation, VIEW enum, and GCalActionResponse.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAccountIndex,
  buildViewPath,
  VIEW,
  GCalActionResponse
} from '../../../src/plugins/gcal/helpers.js';
import { MCPResponse } from '../../../src/core/responses.js';

// ============================================================================
// getAccountIndex
// ============================================================================

describe('getAccountIndex', () => {
  it('extracts /u/0/ from standard Calendar URL', () => {
    assert.equal(getAccountIndex('https://calendar.google.com/calendar/u/0/r/week'), '0');
  });
  it('extracts /u/1/ from second account URL', () => {
    assert.equal(getAccountIndex('https://calendar.google.com/calendar/u/1/r/day'), '1');
  });
  it('extracts /u/2/ from third account URL', () => {
    assert.equal(getAccountIndex('https://calendar.google.com/calendar/u/2/r/month'), '2');
  });
  it('defaults to 0 when /u/N/ is missing', () => {
    assert.equal(getAccountIndex('https://calendar.google.com/calendar/r/week'), '0');
  });
  it('defaults to 0 for non-Calendar URLs', () => {
    assert.equal(getAccountIndex('https://example.com'), '0');
  });
  it('handles URL with path after account index', () => {
    assert.equal(getAccountIndex('https://calendar.google.com/calendar/u/0/r/day/2026/4/6'), '0');
  });
});

// ============================================================================
// buildViewPath
// ============================================================================

describe('buildViewPath', () => {
  it('builds day view path', () => {
    assert.equal(buildViewPath('day'), 'r/day');
  });
  it('builds week view path', () => {
    assert.equal(buildViewPath('week'), 'r/week');
  });
  it('builds month view path', () => {
    assert.equal(buildViewPath('month'), 'r/month');
  });
  it('builds schedule view path (maps to agenda)', () => {
    assert.equal(buildViewPath('schedule'), 'r/agenda');
  });
  it('builds day view path with date', () => {
    assert.equal(buildViewPath('day', '2026-04-10'), 'r/day/2026/4/10');
  });
  it('builds week view path with date', () => {
    assert.equal(buildViewPath('week', '2026-04-10'), 'r/week/2026/4/10');
  });
  it('builds month view path with date', () => {
    assert.equal(buildViewPath('month', '2026-04-10'), 'r/month/2026/4/10');
  });
});

// ============================================================================
// VIEW enum
// ============================================================================

describe('VIEW enum', () => {
  it('has all expected states', () => {
    assert.equal(VIEW.DAY, 'day');
    assert.equal(VIEW.WEEK, 'week');
    assert.equal(VIEW.MONTH, 'month');
    assert.equal(VIEW.SCHEDULE, 'schedule');
    assert.equal(VIEW.CUSTOM, 'custom');
    assert.equal(VIEW.EVENT_DETAIL, 'event_detail');
    assert.equal(VIEW.EVENT_FORM, 'event_form');
    assert.equal(VIEW.SEARCH_RESULTS, 'search_results');
    assert.equal(VIEW.LOADING, 'loading');
    assert.equal(VIEW.NOT_CALENDAR, 'not_calendar');
    assert.equal(VIEW.NOT_READY, 'not_ready');
  });

  it('is frozen (immutable)', () => {
    assert.throws(() => { VIEW.NEW_STATE = 'test'; }, TypeError);
  });

  it('has 11 states total', () => {
    assert.equal(Object.keys(VIEW).length, 11);
  });
});

// ============================================================================
// detectView — integration-style with mock page
// ============================================================================

function mockPage(url, evalResults = {}) {
  return {
    url: () => url,
    evaluate: async (fn) => {
      const fnStr = fn.toString();
      if (fnStr.includes('Confirm it')) return evalResults.hasInterstitial ?? false;
      if (fnStr.includes('role="dialog"')) return evalResults.hasEventDialog ?? false;
      if (fnStr.includes('role="main"')) return evalResults.hasMain ?? true;
      return false;
    }
  };
}

describe('detectView — with mock page', async () => {
  const { detectView } = await import('../../../src/plugins/gcal/helpers.js');

  it('returns NOT_CALENDAR for non-Calendar URL', async () => {
    const page = mockPage('https://example.com');
    assert.equal(await detectView(page), VIEW.NOT_CALENDAR);
  });
  it('returns NOT_READY for interstitial/CAPTCHA', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/week', { hasInterstitial: true });
    assert.equal(await detectView(page), VIEW.NOT_READY);
  });
  it('returns EVENT_FORM for /r/eventedit path', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/eventedit');
    assert.equal(await detectView(page), VIEW.EVENT_FORM);
  });
  it('returns SEARCH_RESULTS for /r/search path', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/search');
    assert.equal(await detectView(page), VIEW.SEARCH_RESULTS);
  });
  it('returns DAY for /r/day path', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/day/2026/4/6');
    assert.equal(await detectView(page), VIEW.DAY);
  });
  it('returns WEEK for /r/week path', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/week');
    assert.equal(await detectView(page), VIEW.WEEK);
  });
  it('returns MONTH for /r/month path', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/month/2026/4');
    assert.equal(await detectView(page), VIEW.MONTH);
  });
  it('returns SCHEDULE for /r/agenda path', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/agenda');
    assert.equal(await detectView(page), VIEW.SCHEDULE);
  });
  it('returns CUSTOM for /r/customday path', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/customday');
    assert.equal(await detectView(page), VIEW.CUSTOM);
  });
  it('returns EVENT_DETAIL when dialog overlay present', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r', { hasEventDialog: true });
    assert.equal(await detectView(page), VIEW.EVENT_DETAIL);
  });
  it('returns WEEK as default when on Calendar root with main content', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r', { hasMain: true });
    assert.equal(await detectView(page), VIEW.WEEK);
  });
  it('returns LOADING when on Calendar but no main container', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r', { hasMain: false });
    assert.equal(await detectView(page), VIEW.LOADING);
  });
});

// ============================================================================
// checkPrecondition — with mock page
// ============================================================================

describe('checkPrecondition', async () => {
  const { checkPrecondition } = await import('../../../src/plugins/gcal/helpers.js');

  it('on_calendar passes for Calendar URL', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/week');
    const result = await checkPrecondition(page, 'on_calendar');
    assert.equal(result.met, true);
  });

  it('on_calendar fails for non-Calendar URL', async () => {
    const page = mockPage('https://example.com');
    const result = await checkPrecondition(page, 'on_calendar');
    assert.equal(result.met, false);
    assert.ok(result.error.includes('Google Calendar'));
    assert.ok(result.suggestion);
  });

  it('unknown precondition fails with descriptive error', async () => {
    const page = mockPage('https://calendar.google.com/calendar/u/0/r/week');
    const result = await checkPrecondition(page, 'invalid_requirement');
    assert.equal(result.met, false);
    assert.ok(result.error.includes('Unknown precondition'));
  });
});

// ============================================================================
// GCalActionResponse
// ============================================================================

describe('GCalActionResponse', () => {
  it('extends MCPResponse', () => {
    const response = new GCalActionResponse({ events: [] }, 'Summary text', ['next step']);
    assert.ok(response instanceof MCPResponse);
  });

  it('spreads data into toJSON', () => {
    const data = { events: [{ title: 'Test' }], total: 1 };
    const response = new GCalActionResponse(data, 'Summary', ['step']);
    const json = response.toJSON();
    assert.deepEqual(json.events, data.events);
    assert.equal(json.total, 1);
    assert.deepEqual(json.nextSteps, ['step']);
  });

  it('returns summary from getTextSummary', () => {
    const response = new GCalActionResponse({}, 'My summary', []);
    assert.equal(response.getTextSummary(), 'My summary');
  });

  it('produces valid MCP format', () => {
    const response = new GCalActionResponse({ test: true }, 'Summary', ['step']);
    const mcp = response.toMcpFormat();
    assert.equal(mcp.isError, false);
    assert.ok(mcp.content);
    assert.ok(mcp.structuredContent);
    assert.equal(mcp.structuredContent.test, true);
  });

  it('validates nextSteps must be string array', () => {
    assert.throws(() => new GCalActionResponse({}, 'sum', 'not an array'), TypeError);
    assert.throws(() => new GCalActionResponse({}, 'sum', [123]), TypeError);
  });
});
