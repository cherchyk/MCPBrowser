/**
 * gcal-selectors.test.js — Unit tests for the Google Calendar plugin selectors module.
 * Validates that all Tier 4 selectors are exported, non-empty, and the module
 * contains no action logic (per FR-021 / SC-008).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as selectors from '../../../src/plugins/gcal/selectors.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const selectorsPath = join(__dirname, '../../../src/plugins/gcal/selectors.js');

describe('GCal Selectors — exports', () => {
  const expectedSelectors = [
    'EVENT_CHIP', 'EVENT_TITLE_IN_CHIP', 'EVENT_TIME_IN_CHIP',
    'EVENT_LOCATION_IN_DETAIL', 'EVENT_DESCRIPTION_IN_DETAIL',
    'ATTENDEE_ROW', 'ATTENDEE_RSVP_STATUS',
    'RSVP_YES_BUTTON', 'RSVP_NO_BUTTON', 'RSVP_MAYBE_BUTTON',
    'CALENDAR_COLOR_DOT', 'SAVE_BUTTON'
  ];

  for (const name of expectedSelectors) {
    it(`exports ${name} as non-empty string`, () => {
      assert.equal(typeof selectors[name], 'string', `${name} must be a string`);
      assert.ok(selectors[name].length > 0, `${name} must not be empty`);
    });
  }

  it('has no undefined or null selector values', () => {
    for (const [key, value] of Object.entries(selectors)) {
      assert.notEqual(value, undefined, `${key} is undefined`);
      assert.notEqual(value, null, `${key} is null`);
    }
  });

  it('has no duplicate selector values', () => {
    const values = Object.values(selectors);
    // EVENT_TITLE_IN_CHIP and EVENT_TIME_IN_CHIP may both be 'span' — skip those
    const nonGeneric = values.filter(v => v !== 'span');
    const unique = new Set(nonGeneric);
    assert.equal(unique.size, nonGeneric.length, 'Duplicate non-generic selector values found');
  });
});

describe('GCal Selectors — module integrity', () => {
  const source = readFileSync(selectorsPath, 'utf-8');

  it('contains tier version comment', () => {
    assert.ok(source.includes('@version'), 'selectors.js must have a @version JSDoc tag');
  });

  it('contains Tier 4 documentation', () => {
    assert.ok(
      source.includes('Tier 4') || source.includes('TIER 4'),
      'selectors.js must document that it contains Tier 4 selectors'
    );
  });

  it('does not contain function definitions (no action logic)', () => {
    assert.ok(!source.includes('export function'), 'selectors.js must not export functions');
    assert.ok(!source.includes('export async function'), 'selectors.js must not export async functions');
    assert.ok(!source.includes('export class'), 'selectors.js must not export classes');
  });

  it('does not import page or browser modules', () => {
    assert.ok(!source.includes("from '../../core/browser"), 'selectors.js must not import browser');
    assert.ok(!source.includes("from 'puppeteer"), 'selectors.js must not import puppeteer');
  });

  it('mentions FR-021 centralization requirement', () => {
    assert.ok(source.includes('FR-021'), 'selectors.js must reference FR-021');
  });
});
