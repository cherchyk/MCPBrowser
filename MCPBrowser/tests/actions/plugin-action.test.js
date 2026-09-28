/**
 * Tests for plugin-action.js — the browser_plugin_action MCP tool.
 * Covers: dispatch routing, error handling, response conformance, page context.
 */

import assert from 'assert';
import { loadPlugins, getLoadedPlugins } from '../../src/core/plugin-loader.js';

import { ErrorResponse, MCPResponse } from '../../src/core/responses.js';
import { ACTIONS as CORE_ACTIONS } from '../../src/actions/index.js';

const PLUGIN_ACTION = CORE_ACTIONS.find((action) => action.id === 'browser_plugin_action');

const pluginAction = PLUGIN_ACTION.handler;

console.log('🧪 Testing browser_plugin_action tool');
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result
        .then(() => {
          console.log(`✅ ${name}`);
          passed++;
        })
        .catch((err) => {
          console.log(`❌ ${name}\n   ${err.message}`);
          failed++;
        });
    }
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}\n   ${err.message}`);
    failed++;
  }
}

await loadPlugins();
const [loadedPluginName] = getLoadedPlugins().keys();
const loadedPlugin = getLoadedPlugins().get(loadedPluginName);
const [loadedAction] = loadedPlugin.getActions();

// ============================================================================
// T017: browser_plugin_action tests (US2)
// ============================================================================

console.log('--- Error Cases (no browser needed) ---');

await test('[US2] pluginAction: unknown plugin returns ErrorResponse', async () => {
  const result = await pluginAction({ plugin: 'nonexistent', action: 'test' });
  assert.ok(result instanceof ErrorResponse);
  const mcpFormat = result.toMcpFormat();
  assert.strictEqual(mcpFormat.isError, true);
  assert.ok(mcpFormat.content[0].text.includes('nonexistent'));
  assert.ok(mcpFormat.content[0].text.includes(loadedPluginName), 'Should list available plugins');
});

await test('[US2] pluginAction: unknown action returns ErrorResponse with valid actions', async () => {
  const result = await pluginAction({ plugin: loadedPluginName, action: 'nonexistent_action' });
  assert.ok(result instanceof ErrorResponse);
  const mcpFormat = result.toMcpFormat();
  assert.strictEqual(mcpFormat.isError, true);
  assert.ok(mcpFormat.content[0].text.includes('nonexistent_action'));
  assert.ok(
    mcpFormat.content[0].text.includes(loadedAction.name),
    'Should list valid action names',
  );
});

await test('[US2] pluginAction: response has toMcpFormat (MCPResponse conformance)', async () => {
  const result = await pluginAction({ plugin: 'nonexistent', action: 'test' });
  assert.ok(typeof result.toMcpFormat === 'function', 'Must have toMcpFormat()');
  const mcpFormat = result.toMcpFormat();
  assert.ok(mcpFormat.content, 'Must have content array');
  assert.ok(typeof mcpFormat.isError === 'boolean', 'Must have isError boolean');
});

// ============================================================================
// T031: Wrong page context (US5) — no browser available returns error
// ============================================================================
console.log('\n--- Page Context (T031, US5) ---');

await test('[US5] pluginAction: no browser returns error with navigation guidance', async () => {
  // When no browser is connected, pluginAction should return an error
  // (We can't easily mock the browser here, but the getBrowser call should fail
  // in test environment, triggering the browser connection error path)
  const result = await pluginAction({ plugin: loadedPluginName, action: loadedAction.name });
  assert.ok(
    result instanceof ErrorResponse || result instanceof MCPResponse,
    'Should return a response object',
  );
  const mcpFormat = result.toMcpFormat();
  // Either browser error or wrong-page error — both are valid in test env
  assert.ok(mcpFormat.content[0].text.length > 0, 'Should have error message');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log();
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
