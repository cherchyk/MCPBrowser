/**
 * gmail-selectors.test.js — Unit tests for the Gmail plugin selectors module.
 * Validates that all Tier 4 selectors are exported, non-empty, and the module
 * contains no action logic (per FR-023 / SC-008).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as selectors from '../../../src/plugins/gmail/selectors.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const selectorsPath = join(__dirname, '../../../src/plugins/gmail/selectors.js');

describe('Gmail Selectors — exports', () => {
  const expectedSelectors = [
    'EMAIL_ROW',
    'EMAIL_ROW_UNREAD',
    'SUBJECT_SPAN',
    'SNIPPET_SPAN',
    'DATE_CELL',
    'MESSAGE_CONTAINER',
    'MSG_BODY',
    'MSG_DATE',
    'THREAD_SUBJECT',
    'ATTACHMENT_AREA',
    'ATTACHMENT_NAME',
    'ATTACHMENT_SIZE',
    'LABEL_ITEM',
    'NO_RESULTS'
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
});

describe('Gmail Selectors — module integrity', () => {
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
    // Should only have export const statements, no functions
    assert.ok(!source.includes('export function'), 'selectors.js must not export functions');
    assert.ok(!source.includes('export async function'), 'selectors.js must not export async functions');
    assert.ok(!source.includes('export class'), 'selectors.js must not export classes');
  });

  it('does not import page or browser modules', () => {
    assert.ok(!source.includes("from '../../../core/browser"), 'selectors.js must not import browser');
    assert.ok(!source.includes("from 'puppeteer"), 'selectors.js must not import puppeteer');
  });

  it('mentions FR-023 centralization requirement', () => {
    assert.ok(source.includes('FR-023'), 'selectors.js must reference FR-023');
  });
});
