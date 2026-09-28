import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pluginModule from '../../../src/plugins/_example/index.js';
import { validateLimit } from '../../../src/plugins/_example/helpers.js';

const { EXAMPLE_PLUGIN } = pluginModule;
const { manifest, matchesPage, getInfo } = EXAMPLE_PLUGIN;
const getActions = () => EXAMPLE_PLUGIN.getActions();

describe('Example Plugin — Gmail-style structure', () => {
  it('exports only its CorePlugin descriptor', () => {
    assert.deepEqual(Object.keys(pluginModule), ['EXAMPLE_PLUGIN']);
  });

  it('exposes a valid manifest and detection contract', () => {
    assert.equal(manifest.name, '_example');
    assert.deepEqual(matchesPage('https://example.test/items', ''), {
      matched: true,
      confidence: 1,
    });
    assert.deepEqual(
      matchesPage('https://other.test', '<div class="example-plugin-marker"></div>'),
      { matched: true, confidence: 0.8 },
    );
  });

  it('exposes imported action functions and serialization-safe info', () => {
    const actions = getActions();
    assert.deepEqual(
      actions.map((action) => action.name),
      ['list_items', 'get_item_detail'],
    );
    assert.ok(actions.every((action) => typeof action.execute === 'function'));
    assert.ok(getInfo().actions.every((action) => action.execute === undefined));
  });

  it('validates list limits', () => {
    assert.equal(validateLimit(undefined), 10);
    assert.equal(validateLimit(100), 100);
    assert.throws(() => validateLimit(0), /limit/);
    assert.throws(() => validateLimit(101), /limit/);
  });
});
