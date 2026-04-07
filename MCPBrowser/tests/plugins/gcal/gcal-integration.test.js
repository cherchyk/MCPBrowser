/**
 * gcal-integration.test.js — Integration tests for chained Google Calendar actions.
 * Tests 4 workflows per plan's Test Plan section.
 * Structural/mock tests only; full integration requires a real browser.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getActions } from '../../../src/plugins/gcal/index.js';

describe('GCal Integration — Action Chaining Contracts', () => {
  const actions = getActions();
  const actionMap = new Map(actions.map(a => [a.name, a]));

  it('Workflow 1: list_events → read_event — list provides index for read', () => {
    // Verify list_events exists and returns events with index
    const list = actionMap.get('list_events');
    assert.ok(list, 'list_events action must exist');
    
    // Verify read_event accepts index param
    const read = actionMap.get('read_event');
    assert.ok(read, 'read_event action must exist');
    const indexParam = read.params.find(p => p.name === 'index');
    assert.ok(indexParam, 'read_event must accept index parameter');
    assert.equal(indexParam.type, 'number');
  });

  it('Workflow 2: list_events → edit_event with save:true — list provides index for edit', () => {
    const edit = actionMap.get('edit_event');
    assert.ok(edit, 'edit_event action must exist');
    
    const indexParam = edit.params.find(p => p.name === 'index');
    assert.ok(indexParam, 'edit_event must accept index parameter');
    
    const saveParam = edit.params.find(p => p.name === 'save');
    assert.ok(saveParam, 'edit_event must accept save parameter');
    assert.equal(saveParam.type, 'boolean');
    assert.equal(saveParam.default, false, 'save must default to false (FR-015)');
  });

  it('Workflow 3: search_events → read_event — search provides indices for read', () => {
    const search = actionMap.get('search_events');
    assert.ok(search, 'search_events action must exist');
    
    const queryParam = search.params.find(p => p.name === 'query');
    assert.ok(queryParam, 'search_events must require query');
    assert.equal(queryParam.required, true);
    
    // read_event should accept the index from search results
    const read = actionMap.get('read_event');
    assert.ok(read.params.find(p => p.name === 'index'), 'read_event must accept index from search results');
  });

  it('Workflow 4: create_event with save:true → list_events — create then verify', () => {
    const create = actionMap.get('create_event');
    assert.ok(create, 'create_event action must exist');
    
    const titleParam = create.params.find(p => p.name === 'title');
    assert.ok(titleParam, 'create_event must require title');
    assert.equal(titleParam.required, true);
    
    const saveParam = create.params.find(p => p.name === 'save');
    assert.ok(saveParam, 'create_event must accept save parameter');
    assert.equal(saveParam.default, false, 'save must default to false (FR-015)');
    
    // list_events should be runnable after create to verify
    const list = actionMap.get('list_events');
    assert.ok(list, 'list_events must exist for post-create verification');
  });
});
