/**
 * gcal-tool-selection.test.js — Tool-selection regression tests for Google Calendar plugin.
 * Validates that the plugin's action catalog supports the expected AI agent workflows.
 * Tests 3 scenarios per plan's Test Plan section.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { manifest, matchesPage, getActions, getInfo } from '../../../src/plugins/gcal/index.js';

describe('GCal Tool Selection — Agent Workflow Scenarios', () => {
  const actions = getActions();
  const actionMap = new Map(actions.map(a => [a.name, a]));
  const info = getInfo();

  it('Scenario 1: "What meetings do I have today?" → plugin detects Calendar → list_events', () => {
    // Step 1: Agent navigates to calendar.google.com via browser_fetch_webpage
    // Step 2: Plugin detection — matchesPage returns matched for Calendar URL
    const match = matchesPage('https://calendar.google.com/calendar/u/0/r/week', '');
    assert.equal(match.matched, true);
    assert.equal(match.confidence, 1.0);

    // Step 3: Agent calls browser_plugin_info to discover actions
    assert.ok(info.actions.find(a => a.name === 'list_events'),
      'browser_plugin_info must list list_events action');

    // Step 4: Agent calls list_events (no params = current view)
    const listAction = actionMap.get('list_events');
    assert.ok(listAction, 'list_events must be available');
    assert.equal(typeof listAction.execute, 'function');

    // Verify no required params for basic usage
    const requiredParams = listAction.params.filter(p => p.required);
    assert.equal(requiredParams.length, 0,
      'list_events should have no required params for "today" usage');
  });

  it('Scenario 2: "Schedule a 1:1 with Alice at 2pm" → create_event with attendees', () => {
    const createAction = actionMap.get('create_event');
    assert.ok(createAction, 'create_event must be available');

    // Verify all needed params exist
    const paramNames = createAction.params.map(p => p.name);
    assert.ok(paramNames.includes('title'), 'must accept title');
    assert.ok(paramNames.includes('date'), 'must accept date');
    assert.ok(paramNames.includes('startTime'), 'must accept startTime');
    assert.ok(paramNames.includes('endTime'), 'must accept endTime');
    assert.ok(paramNames.includes('attendees'), 'must accept attendees');
    assert.ok(paramNames.includes('save'), 'must accept save');

    // Only title is required
    const titleParam = createAction.params.find(p => p.name === 'title');
    assert.equal(titleParam.required, true);

    // save defaults to false for safety (FR-015)
    const saveParam = createAction.params.find(p => p.name === 'save');
    assert.equal(saveParam.default, false);
  });

  it('Scenario 3: "Am I free at 3pm tomorrow?" → check_availability', () => {
    const checkAction = actionMap.get('check_availability');
    assert.ok(checkAction, 'check_availability must be available');

    // All three params required
    const requiredParams = checkAction.params.filter(p => p.required);
    assert.equal(requiredParams.length, 3,
      'check_availability needs date, startTime, endTime (all required)');

    const paramNames = requiredParams.map(p => p.name);
    assert.ok(paramNames.includes('date'), 'date must be required');
    assert.ok(paramNames.includes('startTime'), 'startTime must be required');
    assert.ok(paramNames.includes('endTime'), 'endTime must be required');
  });
});
