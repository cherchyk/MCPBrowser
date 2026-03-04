/**
 * Tests for executeJavascript action
 */

import assert from 'assert';
import { executeJavascript, fetchPage, closeTab } from '../../src/mcp-browser.js';
import { InformationalResponse } from '../../src/core/responses.js';
import { ExecuteJavascriptResponse } from '../../src/actions/execute-javascript.js';

console.log('🧪 Testing executeJavascript action\n');

let testsPassed = 0;
let testsFailed = 0;

const testUrl = 'about:blank';

function test(description, fn) {
  return new Promise((resolve) => {
    fn()
      .then(() => {
        console.log(`✅ ${description}`);
        testsPassed++;
        resolve();
      })
      .catch((err) => {
        console.log(`❌ ${description}`);
        console.log(`   Error: ${err.message}`);
        testsFailed++;
        resolve();
      });
  });
}

// Basic validation and response-shape tests (no live browser required)

await test('Should require url parameter', async () => {
  try {
    await executeJavascript({});
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.match(err.message, /url parameter is required/);
  }
});

await test('Should require script parameter', async () => {
  try {
    await executeJavascript({ url: 'https://example.com' });
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.match(err.message, /script parameter is required/);
  }
});

await test('Should reject invalid URL', async () => {
  try {
    await executeJavascript({ url: 'not-a-url', script: 'return 1;' });
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.match(err.message, /Invalid URL/);
  }
});

await test('Should return informational response when browser unavailable', async () => {
  const result = await executeJavascript({ url: 'https://unloaded-domain-test.com', script: 'return 1;' });
  assert.strictEqual(result instanceof InformationalResponse, true, 'Expected InformationalResponse when page unavailable');
  assert.match(result.message, /Browser connection failed|No open page found|Page connection lost/);
});

await test('ExecuteJavascriptResponse should serialize structured fields', async () => {
  const resp = new ExecuteJavascriptResponse({
    result: { foo: 'bar' },
    type: 'object',
    executionTimeMs: 123,
    truncated: false,
    urlChanged: false,
    currentUrl: 'https://example.com',
    nextSteps: ['step one']
  });

  const json = resp.toJSON();
  assert.strictEqual(json.result.foo, 'bar');
  assert.strictEqual(json.type, 'object');
  assert.strictEqual(json.executionTimeMs, 123);
  assert.strictEqual(json.truncated, false);
  assert.strictEqual(json.urlChanged, false);
  assert.strictEqual(json.currentUrl, 'https://example.com');
  assert.deepStrictEqual(json.nextSteps, ['step one']);
  const text = resp.getTextSummary();
  assert.match(text, /Script executed/);
});

await test('Should execute script and return metadata', async () => {
  await fetchPage({ url: testUrl, removeUnnecessaryHTML: false });
  const resp = await executeJavascript({
    url: testUrl,
    script: `document.body.innerHTML = '<div id="item">hello</div>'; return { text: document.querySelector('#item').textContent, href: location.href };`
  });

  assert.strictEqual(resp instanceof ExecuteJavascriptResponse, true);
  assert.strictEqual(resp.result.text, 'hello');
  assert.strictEqual(resp.type, 'object');
  assert.strictEqual(resp.truncated, false);
  assert.strictEqual(resp.urlChanged, false);
  assert.match(resp.currentUrl, /^about:/);
  await closeTab({ url: testUrl });
});

await test('Should return DOM outerHTML when script returns element', async () => {
  await fetchPage({ url: testUrl, removeUnnecessaryHTML: false });
  const resp = await executeJavascript({
    url: testUrl,
    script: "const el = document.createElement('p'); el.id='dom-test'; el.textContent='hi'; document.body.appendChild(el); return document.querySelector('#dom-test');"
  });

  assert.strictEqual(resp.type, 'dom-html');
  assert.match(resp.result, /<p id=\"dom-test\">hi<\/p>/);
  await closeTab({ url: testUrl });
});

await test('Should flag urlChanged when navigation occurs', async () => {
  await fetchPage({ url: `${testUrl}#before`, removeUnnecessaryHTML: false });
  const resp = await executeJavascript({
    url: `${testUrl}#before`,
    script: "history.pushState({}, '', '#after'); return 'ok';"
  });

  assert.strictEqual(resp.urlChanged, true);
  assert.match(resp.currentUrl, /#after$/);
  await closeTab({ url: testUrl });
});

await test('Should surface thrown errors from scripts', async () => {
  await fetchPage({ url: testUrl, removeUnnecessaryHTML: false });
  const resp = await executeJavascript({
    url: testUrl,
    script: "throw new Error('boom');"
  });

  assert.strictEqual(resp.type, 'error');
  assert.strictEqual(resp.error.message, 'boom');
  await closeTab({ url: testUrl });
});

await test('Should timeout long-running scripts', async () => {
  await fetchPage({ url: testUrl, removeUnnecessaryHTML: false });
  const resp = await executeJavascript({
    url: testUrl,
    script: "await new Promise(resolve => setTimeout(resolve, 100)); return 1;",
    timeoutMs: 10
  });

  assert.strictEqual(resp.type, 'error');
  assert.strictEqual(resp.error.name, 'TimeoutError');
  assert.match(resp.error.message, /Execution timed out/);
  assert.strictEqual(resp.truncated, false);
  await closeTab({ url: testUrl });
});

await test('Should truncate large results and flag truncation', async () => {
  await fetchPage({ url: testUrl, removeUnnecessaryHTML: false });
  const resp = await executeJavascript({
    url: testUrl,
    script: "return 'a'.repeat(120000);"
  });

  assert.strictEqual(resp.truncated, true);
  assert.strictEqual(resp.type, 'string');
  assert.match(resp.result, /\[truncated\]$/);
  await closeTab({ url: testUrl });
});

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
