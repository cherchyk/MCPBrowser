/**
 * Tests for clickElement action
 * Updated for MCP spec compliance: no success field, use instanceof ErrorResponse
 */

import assert from 'assert';
import { clickElement, fetchPage, executeJavascript, closeTab } from '../../src/mcp-browser.js';
import { ErrorResponse, InformationalResponse } from '../../src/core/responses.js';
import { ClickWithFallbackResponse } from '../../src/actions/click-element.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';
import { getValidatedPage } from '../../src/core/browser.js';

const browserParam = process.argv[2] || '';

console.log('🧪 Testing clickElement action\n');

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

// ============================================================================
// clickElement Tests
// ============================================================================

await runWithBrowsers(async (browserType) => {
  console.log('\n📋 Testing clickElement()');
  
  await test(`[${browserType}] Should require url parameter`, async () => {
    try {
      await clickElement({});
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /url parameter is required/);
    }
  });
  
  await test(`[${browserType}] Should require either selector or text parameter`, async () => {
    try {
      await clickElement({ url: testUrl });
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /Either selector or text parameter is required/);
    }
  });
  
  await test(`[${browserType}] Should return informational response if page not loaded`, async () => {
    const result = await clickElement({ 
      url: 'https://unloaded-domain-test.com', 
      selector: 'button' 
    });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse (not red error)');
    assert.match(result.message, /No open page found/);
  });

  await test(`[${browserType}] Should use JS fallback when native click times out`, async () => {
    await fetchPage({ url: testUrl, removeUnnecessaryHTML: false });
    await executeJavascript({
      url: testUrl,
      script: "window.__clicks = []; let btn = document.getElementById('js-fallback'); if (!btn) { btn = document.createElement('button'); btn.id = 'js-fallback'; btn.textContent = 'fallback'; document.body.appendChild(btn); } btn.onclick = () => window.__clicks.push('fallback');"
    });

    // Patch page.mouse.click so Puppeteer's native elementHandle.click() hangs.
    // The JS fallback uses page.evaluate(el => el.click(), handle) which runs
    // in-browser and does NOT go through page.mouse, so it still works.
    const { page } = await getValidatedPage(new URL(testUrl).hostname);
    const origMouseClick = page.mouse.click.bind(page.mouse);
    page.mouse.click = () => new Promise(() => {}); // never resolves → timeout

    try {
      const resp = await clickElement({ url: testUrl, selector: '#js-fallback', returnHtml: false, waitForElementTimeout: 500, postClickWait: 0 });

      assert.strictEqual(resp instanceof ClickWithFallbackResponse, true);
      assert.strictEqual(resp.status, 'success');
      assert.strictEqual(resp.fallbackUsed, true);
      assert.strictEqual(resp.nativeAttempt.status, 'timeout');
      assert.strictEqual(resp.fallbackAttempt.status, 'success');
      const clicks = await page.evaluate(() => window.__clicks || []);
      assert.ok(clicks.includes('fallback'), 'Fallback click should run');
    } finally {
      page.mouse.click = origMouseClick;
      await closeTab({ url: testUrl });
    }
  });

  await test(`[${browserType}] Should report dual failure when fallback also fails`, async () => {
    await fetchPage({ url: testUrl, removeUnnecessaryHTML: false });
    await executeJavascript({
      url: testUrl,
      script: "let btn = document.getElementById('js-fallback-fail'); if (!btn) { btn = document.createElement('button'); btn.id = 'js-fallback-fail'; btn.textContent = 'fail'; document.body.appendChild(btn); }"
    });

    // Patch page.mouse.click so native click hangs, AND remove the element
    // right after waitForSelector so the JS fallback's page.evaluate also fails
    // with a stale reference.
    const { page } = await getValidatedPage(new URL(testUrl).hostname);
    const origMouseClick = page.mouse.click.bind(page.mouse);
    page.mouse.click = () => new Promise(() => {}); // native hangs

    // Also patch page.evaluate to fail when used for the fallback click
    const origEvaluate = page.evaluate.bind(page);
    let evaluateCallCount = 0;
    page.evaluate = async (...args) => {
      evaluateCallCount++;
      const fn = args[0];
      // The fallback click calls page.evaluate(el => el.click(), handle).
      // scrollIntoView also uses page.evaluate. Let the first evaluate calls
      // through (scrollIntoView etc.) but fail on the fallback click attempt.
      // The fallback click's function body contains 'el.click()'.
      if (typeof fn === 'function' && fn.toString().includes('.click()') && evaluateCallCount > 1) {
        throw new Error('fallback failure: element not interactable');
      }
      return origEvaluate(...args);
    };

    try {
      const resp = await clickElement({ url: testUrl, selector: '#js-fallback-fail', returnHtml: false, waitForElementTimeout: 500, postClickWait: 0 });

      assert.strictEqual(resp.fallbackUsed, true);
      assert.strictEqual(resp.status, 'failed');
      assert.strictEqual(resp.nativeAttempt.status, 'timeout');
      assert.ok(resp.fallbackAttempt.status === 'error' || resp.fallbackAttempt.status === 'timeout');
      assert.strictEqual(resp.html, null);
    } finally {
      page.mouse.click = origMouseClick;
      page.evaluate = origEvaluate;
      await closeTab({ url: testUrl });
    }
  });
}, browserParam);

// ============================================================================
// Response shape tests (no live browser)
// ============================================================================

await test('ClickWithFallbackResponse should include metadata fields', async () => {
  const resp = new ClickWithFallbackResponse({
    status: 'failed',
    fallbackUsed: true,
    nativeAttempt: { status: 'timeout', durationMs: 1200, error: 'timeout' },
    fallbackAttempt: { status: 'error', durationMs: 800, error: 'blocked' },
    postClickWait: { applied: false, waitedMs: 0 },
    currentUrl: 'https://example.com',
    html: '<html></html>',
    message: 'Click failed after fallback',
    nextSteps: ['step-one']
  });

  const json = resp.toJSON();
  assert.strictEqual(json.status, 'failed');
  assert.strictEqual(json.fallbackUsed, true);
  assert.strictEqual(json.nativeAttempt.status, 'timeout');
  assert.strictEqual(json.fallbackAttempt.status, 'error');
  assert.strictEqual(json.postClickWait.applied, false);
  assert.strictEqual(json.currentUrl, 'https://example.com');
  assert.strictEqual(json.html, '<html></html>');
  assert.strictEqual(json.message, 'Click failed after fallback');
  assert.deepStrictEqual(json.nextSteps, ['step-one']);
  assert.match(resp.getTextSummary(), /fallback used/i);
});

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
