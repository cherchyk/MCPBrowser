/**
 * Tests for plugin-action.js — the browser_plugin_action MCP tool.
 * Covers: dispatch routing, error handling, response conformance, page context.
 */

import assert from 'assert';
import { loadPlugins, getLoadedPlugins } from '../../src/core/plugin-loader.js';
import { domainPages } from '../../src/core/browser.js';

import { ErrorResponse, MCPResponse } from '../../src/core/responses.js';
import { ACTIONS as CORE_ACTIONS } from '../../src/actions/index.js';
import { resolvePluginPage } from '../../src/core/plugin-page.js';
import { WORD_PLUGIN } from '../../src/plugins/word/index.js';

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
// T031: Page context (US5)
// ============================================================================
console.log('\n--- Page Context (T031, US5) ---');

function mockPage({ url, visible = true, closed = false, id, frameUrls = [] }) {
  let currentUrl = url;
  let currentFrameUrls = frameUrls;
  return {
    url: () => currentUrl,
    isClosed: () => closed,
    evaluate: async () => visible,
    frames: () => [
      { url: () => currentUrl },
      ...currentFrameUrls.map((frameUrl) => ({ url: () => frameUrl })),
    ],
    target: () => ({ _targetId: id }),
    redirect(nextUrl, nextFrameUrls = []) {
      currentUrl = nextUrl;
      currentFrameUrls = nextFrameUrls;
    },
  };
}

await test('[US5] pluginAction: tracked page beats stale matching tab and retains frame affinity', async () => {
  domainPages.clear();
  const staleBlank = mockPage({
    url: 'https://word.cloud.microsoft/',
    id: 'stale-blank',
  });
  const currentDocument = mockPage({
    url: 'https://contoso.sharepoint.com/sites/docs/Document.docx',
    id: 'current-document',
  });
  let fallbackScans = 0;
  const browser = {
    pages: async () => {
      fallbackScans++;
      return [staleBlank, currentDocument];
    },
  };
  const plugin = Object.create(WORD_PLUGIN);

  domainPages.set('contoso.sharepoint.com', currentDocument);
  assert.strictEqual(await resolvePluginPage(browser, plugin), currentDocument);

  currentDocument.redirect('https://contoso.sharepoint.com/sites/docs/Doc.aspx?id=1', [
    'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
  ]);
  assert.strictEqual(await resolvePluginPage(browser, plugin), currentDocument);
  assert.strictEqual(fallbackScans, 0);
});

await test('[US5] pluginAction: deterministic fallback ignores closed tabs and prefers visible tabs', async () => {
  domainPages.clear();
  const closed = mockPage({
    url: 'https://a.sharepoint.com/sites/docs/closed.docx',
    closed: true,
    id: 'closed',
  });
  const hidden = mockPage({
    url: 'https://a.sharepoint.com/sites/docs/hidden.docx',
    visible: false,
    id: 'hidden',
  });
  const visibleSecond = mockPage({
    url: 'https://z.sharepoint.com/sites/docs/current.docx',
    id: 'visible-z',
  });
  const visibleFirst = mockPage({
    url: 'https://a.sharepoint.com/sites/docs/current.docx',
    id: 'visible-a',
  });
  const browser = { pages: async () => [closed, hidden, visibleSecond, visibleFirst] };
  const plugin = Object.create(WORD_PLUGIN);

  assert.strictEqual(await resolvePluginPage(browser, plugin), visibleFirst);
  assert.strictEqual(await resolvePluginPage(browser, plugin), visibleFirst);
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log();
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
