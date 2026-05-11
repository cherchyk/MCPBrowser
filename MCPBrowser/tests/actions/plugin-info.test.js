/**
 * Tests for plugin-info.js — the browser_plugin_info MCP tool.
 * Covers: list all plugins, plugin detail, action detail, errors, site context.
 */

import assert from 'assert';
import { loadPlugins, getLoadedPlugins } from '../../src/core/plugin-loader.js';
import { pluginInfo, PluginListResponse, PluginInfoResponse, PluginActionDetailResponse } from '../../src/actions/plugin-info.js';
import { ErrorResponse } from '../../src/core/responses.js';
import { writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const registryPath = join(__dirname, '../../src/plugins.json');

console.log('🧪 Testing browser_plugin_info tool');
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(() => { console.log(`✅ ${name}`); passed++; })
        .catch(err => { console.log(`❌ ${name}\n   ${err.message}`); failed++; });
    }
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}\n   ${err.message}`);
    failed++;
  }
}

function withRegistry(data, fn) {
  const original = readFileSync(registryPath, 'utf-8');
  try {
    writeFileSync(registryPath, JSON.stringify(data));
    return fn();
  } finally {
    writeFileSync(registryPath, original);
  }
}

// Load _example plugin for testing
await withRegistry({ enabled: ["_example"] }, async () => { await loadPlugins(); });

// ============================================================================
// T016: browser_plugin_info tests (US2)
// ============================================================================

console.log('--- List All Plugins ---');

test('[US2] browser_plugin_info: no params lists all plugins', () => {
  const result = pluginInfo({});
  assert.ok(result instanceof PluginListResponse);
  assert.ok(Array.isArray(result.plugins));
  assert.strictEqual(result.plugins.length, 1);
  assert.strictEqual(result.plugins[0].name, '_example');
  assert.ok(typeof result.plugins[0].description === 'string');
  assert.ok(typeof result.plugins[0].actionCount === 'number');
  assert.ok(result.plugins[0].actionCount > 0);
});

test('[US2] browser_plugin_info: list all has nextSteps', () => {
  const result = pluginInfo({});
  assert.ok(Array.isArray(result.nextSteps));
  assert.ok(result.nextSteps.length > 0);
  assert.ok(result.nextSteps[0].includes('browser_plugin_info'));
});

console.log('\n--- Plugin Detail ---');

test('[US2] browser_plugin_info: valid plugin returns action catalog + site context', () => {
  const result = pluginInfo({ plugin: '_example' });
  assert.ok(result instanceof PluginInfoResponse);
  const mcpFormat = result.toMcpFormat();
  assert.strictEqual(mcpFormat.isError, false);
  
  const info = result.pluginInfo;
  assert.strictEqual(info.name, '_example');
  assert.ok(typeof info.description === 'string');
  assert.ok(Array.isArray(info.targetPages));
  assert.ok(Array.isArray(info.actions));
  assert.ok(info.actions.length > 0);
  // Actions should NOT have execute functions (serialization safety)
  for (const action of info.actions) {
    assert.strictEqual(action.execute, undefined, 'Actions in getInfo should not have execute');
    assert.ok(action.name);
    assert.ok(action.description);
    assert.ok(Array.isArray(action.params));
  }
});

test('[US2] browser_plugin_info: plugin detail has nextSteps guiding to browser_plugin_action', () => {
  const result = pluginInfo({ plugin: '_example' });
  const joined = result.nextSteps.join(' ');
  assert.ok(joined.includes('browser_plugin_action'), 'nextSteps should reference browser_plugin_action');
});

console.log('\n--- Action Detail ---');

test('[US2] browser_plugin_info: valid plugin + action returns single action details', () => {
  const result = pluginInfo({ plugin: '_example', action: 'list_items' });
  assert.ok(result instanceof PluginActionDetailResponse);
  assert.strictEqual(result.plugin, '_example');
  assert.strictEqual(result.action.name, 'list_items');
  assert.ok(typeof result.action.description === 'string');
  assert.ok(Array.isArray(result.action.params));
});

test('[US2] browser_plugin_info: unknown action returns ErrorResponse', () => {
  const result = pluginInfo({ plugin: '_example', action: 'nonexistent_action' });
  assert.ok(result instanceof ErrorResponse);
  const mcpFormat = result.toMcpFormat();
  assert.strictEqual(mcpFormat.isError, true);
  assert.ok(mcpFormat.content[0].text.includes('nonexistent_action'));
  assert.ok(mcpFormat.content[0].text.includes('list_items'));
});

console.log('\n--- Error Cases ---');

test('[US2] browser_plugin_info: unknown plugin returns ErrorResponse', () => {
  const result = pluginInfo({ plugin: 'nonexistent_plugin' });
  assert.ok(result instanceof ErrorResponse);
  const mcpFormat = result.toMcpFormat();
  assert.strictEqual(mcpFormat.isError, true);
  assert.ok(mcpFormat.content[0].text.includes('nonexistent_plugin'));
  assert.ok(mcpFormat.content[0].text.includes('_example'));
});

// ============================================================================
// T034: Site context — no internal details exposed (US6)
// ============================================================================
console.log('\n--- Site Context (T034, US6) ---');

test('[US6] browser_plugin_info: includes targetPages and authFlow', () => {
  const result = pluginInfo({ plugin: '_example' });
  const info = result.pluginInfo;
  assert.ok(Array.isArray(info.targetPages), 'Should have targetPages');
  assert.ok(info.targetPages.length > 0, 'targetPages should not be empty');
  assert.ok(typeof info.authFlow === 'string' || info.authFlow === undefined, 'authFlow should be string or absent');
});

test('[US6] browser_plugin_info: does NOT expose CSS selectors or JS code', () => {
  const result = pluginInfo({ plugin: '_example' });
  const json = JSON.stringify(result.toMcpFormat());
  // Check for common CSS selector patterns
  assert.ok(!json.includes('querySelector'), 'Should not contain querySelector');
  assert.ok(!json.includes('document.'), 'Should not contain document. references');
  assert.ok(!json.includes('page.evaluate'), 'Should not contain page.evaluate');
  // The getInfo actions should have no execute functions
  const info = result.pluginInfo;
  for (const action of info.actions) {
    assert.strictEqual(typeof action.execute, 'undefined', 'execute must not be in getInfo actions');
  }
});

test('[US6] toMcpFormat conforms to MCPResponse', () => {
  const result = pluginInfo({ plugin: '_example' });
  const mcpFormat = result.toMcpFormat();
  assert.ok(mcpFormat.content, 'Must have content');
  assert.strictEqual(mcpFormat.isError, false);
  assert.ok(mcpFormat.structuredContent, 'Must have structuredContent');
  assert.ok(Array.isArray(mcpFormat.structuredContent.nextSteps));
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log();
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
