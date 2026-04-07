/**
 * gcal-plugin.test.js — Unit tests for the Google Calendar plugin entry point.
 * Tests manifest fields, matchesPage detection, getActions catalog,
 * and getInfo serialization safety.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { manifest, matchesPage, getActions, getInfo } from '../../../src/plugins/gcal/index.js';

describe('GCal Plugin — manifest', () => {
  it('has required fields', () => {
    assert.equal(manifest.name, 'gcal');
    assert.equal(typeof manifest.version, 'string');
    assert.equal(typeof manifest.description, 'string');
    assert.equal(manifest.interfaceVersion, 1);
    assert.ok(Array.isArray(manifest.urlPatterns));
    assert.ok(manifest.urlPatterns.length > 0);
  });

  it('matches folder name', () => {
    assert.equal(manifest.name, 'gcal');
  });

  it('has calendar.google.com in urlPatterns', () => {
    assert.ok(manifest.urlPatterns.includes('calendar.google.com'));
  });
});

describe('GCal Plugin — matchesPage', () => {
  it('returns matched:true for Calendar URLs', () => {
    const result = matchesPage('https://calendar.google.com/calendar/u/0/r/week', '');
    assert.equal(result.matched, true);
    assert.equal(result.confidence, 1.0);
  });

  it('returns matched:true for Calendar URL with account index', () => {
    const result = matchesPage('https://calendar.google.com/calendar/u/2/r/day', '');
    assert.equal(result.matched, true);
  });

  it('returns matched:false for non-Calendar URLs', () => {
    const result = matchesPage('https://example.com', '');
    assert.equal(result.matched, false);
  });

  it('returns matched:false for Gmail URLs (not Calendar)', () => {
    const result = matchesPage('https://mail.google.com/mail/u/0/#inbox', '');
    assert.equal(result.matched, false);
  });

  it('returns matched:true for Calendar DOM markers in HTML', () => {
    const result = matchesPage('https://unknown.com', '<div data-eventchip>content</div>');
    assert.equal(result.matched, true);
    assert.equal(result.confidence, 0.8);
  });

  it('returns matched:false for empty inputs', () => {
    const result = matchesPage('', '');
    assert.equal(result.matched, false);
  });

  it('never throws', () => {
    assert.doesNotThrow(() => matchesPage(null, null));
    assert.doesNotThrow(() => matchesPage(undefined, undefined));
  });
});

describe('GCal Plugin — getActions', () => {
  const actions = getActions();

  it('returns 8 actions', () => {
    assert.equal(actions.length, 8);
  });

  it('all actions have required fields', () => {
    for (const action of actions) {
      assert.equal(typeof action.name, 'string', `action name must be string`);
      assert.equal(typeof action.description, 'string', `${action.name}: description must be string`);
      assert.ok(Array.isArray(action.params), `${action.name}: params must be array`);
      assert.equal(typeof action.execute, 'function', `${action.name}: execute must be function`);
    }
  });

  it('action names are unique', () => {
    const names = actions.map(a => a.name);
    assert.equal(new Set(names).size, names.length, 'Duplicate action names found');
  });

  it('includes all expected action names', () => {
    const names = actions.map(a => a.name);
    const expected = [
      'list_events', 'read_event', 'create_event', 'search_events',
      'edit_event', 'rsvp_event', 'delete_event', 'check_availability'
    ];
    for (const name of expected) {
      assert.ok(names.includes(name), `Missing action: ${name}`);
    }
  });

  it('all param objects have required fields', () => {
    for (const action of actions) {
      for (const param of action.params) {
        assert.equal(typeof param.name, 'string', `${action.name}.${param.name}: name must be string`);
        assert.equal(typeof param.type, 'string', `${action.name}.${param.name}: type must be string`);
        assert.equal(typeof param.description, 'string', `${action.name}.${param.name}: description must be string`);
        assert.equal(typeof param.required, 'boolean', `${action.name}.${param.name}: required must be boolean`);
      }
    }
  });
});

describe('GCal Plugin — getInfo', () => {
  const info = getInfo();

  it('has description', () => {
    assert.equal(typeof info.description, 'string');
    assert.ok(info.description.length > 0);
  });

  it('has targetPages', () => {
    assert.ok(Array.isArray(info.targetPages));
    assert.ok(info.targetPages.length > 0);
  });

  it('has authFlow', () => {
    assert.equal(typeof info.authFlow, 'string');
  });

  it('has actions without execute functions (serialization safety)', () => {
    assert.ok(Array.isArray(info.actions));
    for (const action of info.actions) {
      assert.equal(action.execute, undefined, `${action.name}: execute must not be in getInfo()`);
      assert.equal(typeof action.name, 'string');
      assert.equal(typeof action.description, 'string');
      assert.ok(Array.isArray(action.params));
    }
  });

  it('lists all 8 actions', () => {
    assert.equal(info.actions.length, 8);
  });
});
