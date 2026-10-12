import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadPlugins,
  detectPlugins,
  getPluginNextSteps,
  getLoadedPlugins,
  getPlugin,
  CURRENT_INTERFACE_VERSION,
} from '../../src/core/plugin-loader.js';
import { CorePlugin } from '../../src/core/plugins.js';
import { PluginAction } from '../../src/core/actions.js';
import { MCPResponse } from '../../src/core/responses.js';
import { PLUGINS } from '../../src/plugins/index.js';

class TestResponse extends MCPResponse {}

const TEST_ACTION = new PluginAction({
  name: 'list_items',
  description: 'List test items',
  params: [],
  response: TestResponse,
  handler: () => new TestResponse(),
});

function createTestPlugin(overrides = {}) {
  const actions = overrides.actions ?? [TEST_ACTION];
  const manifest = {
    name: 'test-plugin',
    version: '1.0.0',
    description: 'Test plugin',
    interfaceVersion: CURRENT_INTERFACE_VERSION,
    urlPatterns: ['example.test'],
    domPatterns: ['example-plugin-marker'],
    ...overrides.manifest,
  };
  return new CorePlugin({
    manifest,
    actions,
    matchesPage:
      overrides.matchesPage ??
      ((url, html) => {
        if (url?.includes('example.test')) return { matched: true, confidence: 1 };
        if (html?.includes('example-plugin-marker')) return { matched: true, confidence: 0.8 };
        return { matched: false };
      }),
    getInfo:
      overrides.getInfo ??
      (() => ({
        recommendation: 'List test items.',
        description: manifest.description,
        targetPages: ['Test page'],
        actions: actions.map((action) => action.toInfo()),
      })),
  });
}

describe('CorePlugin', () => {
  it('exposes a stable id and action catalog', () => {
    const plugin = createTestPlugin();
    assert.equal(plugin.id, 'test-plugin');
    assert.equal(plugin.manifest.name, plugin.id);
    assert.strictEqual(plugin.getActions(), plugin.actions);
  });

  it('rejects invalid manifests', () => {
    assert.throws(
      () => createTestPlugin({ manifest: { name: '' } }),
      /name must be a non-empty string/,
    );
    assert.throws(
      () => createTestPlugin({ manifest: { interfaceVersion: 999 } }),
      /not compatible/,
    );
    assert.throws(() => createTestPlugin({ manifest: { urlPatterns: [] } }), /urlPatterns/);
  });

  it('rejects invalid and duplicate actions', () => {
    assert.throws(() => createTestPlugin({ actions: [{}] }), /PluginAction instances/);
    assert.throws(
      () => createTestPlugin({ actions: [TEST_ACTION, TEST_ACTION] }),
      /duplicate action/,
    );
  });
});

describe('plugin registry', () => {
  it('exports CorePlugin objects with unique names', () => {
    assert.deepEqual(
      PLUGINS.map((plugin) => plugin.id),
      ['word'],
    );
    assert.ok(PLUGINS.every((plugin) => plugin instanceof CorePlugin));
    assert.equal(new Set(PLUGINS.map((plugin) => plugin.id)).size, PLUGINS.length);
  });
});

describe('plugin loader', () => {
  it('loads the production registry by default', async () => {
    const count = await loadPlugins();
    assert.equal(count, PLUGINS.length);
    assert.strictEqual(getPlugin('word'), PLUGINS[0]);
  });

  it('supports an empty registry', async () => {
    const count = await loadPlugins([]);
    assert.equal(count, 0);
    assert.equal(getLoadedPlugins().size, 0);
  });

  it('loads supplied CorePlugin objects and skips invalid or duplicate entries', async () => {
    const plugin = createTestPlugin();
    const count = await loadPlugins([plugin, {}, plugin]);
    assert.equal(count, 1);
    assert.strictEqual(getPlugin('test-plugin'), plugin);
  });
});

describe('plugin detection', () => {
  it('detects URL and DOM matches with their confidence', async () => {
    await loadPlugins([createTestPlugin()]);
    assert.equal(detectPlugins('https://example.test/items', '')[0].confidence, 1);
    assert.equal(
      detectPlugins('https://other.test', '<div class="example-plugin-marker"></div>')[0]
        .confidence,
      0.8,
    );
  });

  it('returns no match for unrelated pages or an empty registry', async () => {
    await loadPlugins([createTestPlugin()]);
    assert.deepEqual(detectPlugins('https://other.test', ''), []);
    await loadPlugins([]);
    assert.deepEqual(detectPlugins('https://example.test', ''), []);
  });

  it('builds plugin next steps', async () => {
    await loadPlugins([createTestPlugin()]);
    const steps = getPluginNextSteps('https://example.test/items', '');
    assert.ok(steps.some((step) => step.includes('test-plugin')));
    assert.ok(steps.some((step) => step.includes('recommendedPlugins')));
  });

  it('runs detection in under 100ms per call', async () => {
    await loadPlugins([createTestPlugin()]);
    const iterations = 100;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      detectPlugins('https://example.test/items', '<html></html>');
    }
    assert.ok((performance.now() - start) / iterations < 100);
  });
});
