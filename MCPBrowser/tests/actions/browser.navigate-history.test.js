/**
 * Tests for navigateHistory action
 * Integration tests require a running browser.
 */

import assert from 'assert';
import { navigateHistory, fetchPage } from '../../src/mcp-browser.js';
import { ErrorResponse, InformationalResponse } from '../../src/core/responses.js';
import { NavigateHistorySuccessResponse } from '../../src/actions/navigate-history.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';
const browserParam = process.argv[2] || '';
console.log('🧪 Testing navigateHistory action\n');

let testsPassed = 0;
let testsFailed = 0;

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
// Response Class Unit Tests (no browser needed)
// ============================================================================

console.log('📋 Testing NavigateHistorySuccessResponse class\n');

(function runResponseTests() {
  let localPassed = 0;
  let localFailed = 0;
  
  function unitTest(name, fn) {
    try {
      fn();
      console.log(`✅ ${name}`);
      localPassed++;
      testsPassed++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   ${err.message}`);
      localFailed++;
      testsFailed++;
    }
  }

  unitTest('NavigateHistorySuccessResponse creates correct structure', () => {
    const response = new NavigateHistorySuccessResponse(
      'back',
      'https://example.com/page2',
      'https://example.com/page1',
      '<html>page1</html>',
      ['Next step']
    );

    assert.strictEqual(response.direction, 'back');
    assert.strictEqual(response.previousUrl, 'https://example.com/page2');
    assert.strictEqual(response.currentUrl, 'https://example.com/page1');
    assert.strictEqual(response.html, '<html>page1</html>');
    assert.deepStrictEqual(response.nextSteps, ['Next step']);
  });

  unitTest('NavigateHistorySuccessResponse accepts null html', () => {
    const response = new NavigateHistorySuccessResponse(
      'forward',
      'https://example.com/page1',
      'https://example.com/page2',
      null,
      ['Step']
    );

    assert.strictEqual(response.html, null);
    assert.strictEqual(response.direction, 'forward');
  });

  unitTest('NavigateHistorySuccessResponse requires string direction', () => {
    assert.throws(() => {
      new NavigateHistorySuccessResponse(123, 'url1', 'url2', null, []);
    }, TypeError, 'Should throw TypeError for non-string direction');
  });

  unitTest('NavigateHistorySuccessResponse requires string previousUrl', () => {
    assert.throws(() => {
      new NavigateHistorySuccessResponse('back', 123, 'url2', null, []);
    }, TypeError, 'Should throw TypeError for non-string previousUrl');
  });

  unitTest('NavigateHistorySuccessResponse requires string currentUrl', () => {
    assert.throws(() => {
      new NavigateHistorySuccessResponse('back', 'url1', 123, null, []);
    }, TypeError, 'Should throw TypeError for non-string currentUrl');
  });

  unitTest('NavigateHistorySuccessResponse rejects non-string, non-null html', () => {
    assert.throws(() => {
      new NavigateHistorySuccessResponse('back', 'url1', 'url2', 123, []);
    }, TypeError, 'Should throw TypeError for non-string, non-null html');
  });

  unitTest('NavigateHistorySuccessResponse validates nextSteps', () => {
    assert.throws(() => {
      new NavigateHistorySuccessResponse('back', 'url1', 'url2', null, 'not-array');
    }, TypeError, 'Should throw TypeError for non-array nextSteps');
  });

  unitTest('NavigateHistorySuccessResponse toJSON() serializes correctly', () => {
    const response = new NavigateHistorySuccessResponse(
      'back',
      'https://example.com/page2',
      'https://example.com/page1',
      '<html>content</html>',
      ['Step 1']
    );

    const json = response.toJSON();
    assert.strictEqual(json.direction, 'back');
    assert.strictEqual(json.previousUrl, 'https://example.com/page2');
    assert.strictEqual(json.currentUrl, 'https://example.com/page1');
    assert.strictEqual(json.html, '<html>content</html>');
    assert.deepStrictEqual(json.nextSteps, ['Step 1']);
  });

  unitTest('NavigateHistorySuccessResponse getTextSummary() works', () => {
    const response = new NavigateHistorySuccessResponse(
      'back',
      'https://example.com/page2',
      'https://example.com/page1',
      null,
      []
    );

    const summary = response.getTextSummary();
    assert.ok(summary.includes('back'), 'Summary should mention direction');
    assert.ok(summary.includes('page2'), 'Summary should mention previous URL');
    assert.ok(summary.includes('page1'), 'Summary should mention current URL');
  });

  console.log(`\n  Response class tests: ${localPassed} passed, ${localFailed} failed\n`);
})();

// ============================================================================
// Integration Tests (requires browser)
// ============================================================================

await runWithBrowsers(async (browserType) => {
  console.log('\n📋 Testing navigateHistory() integration\n');

  await test(`[${browserType}] Should require url parameter`, async () => {
    try {
      await navigateHistory({});
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /url parameter is required/);
    }
  });

  await test(`[${browserType}] Should reject invalid URL`, async () => {
    try {
      await navigateHistory({ url: 'not-a-url' });
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /Invalid URL/);
    }
  });

  await test(`[${browserType}] Should return informational response if page not loaded`, async () => {
    const result = await navigateHistory({ url: 'https://never-loaded-domain-99999.com' });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse');
    assert.match(result.message, /No open page found/);
  });

  await test(`[${browserType}] Should return informational response when no back history`, async () => {
    // Load a fresh page (no back history)
    const fetchResult = await fetchPage({ url: 'https://example.com', browser: browserType });
    assert.strictEqual(!(fetchResult instanceof ErrorResponse), true, 'Should fetch page successfully');

    const result = await navigateHistory({ url: 'https://example.com', direction: 'back' });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse for no history');
    assert.match(result.message, /No back history/);
  });

  await test(`[${browserType}] Should default direction to back`, async () => {
    // Load a page
    await fetchPage({ url: 'https://example.com', browser: browserType });
    
    // Navigate without direction param - should attempt back
    const result = await navigateHistory({ url: 'https://example.com' });
    // Since example.com has no back history, it should be informational
    assert.strictEqual(result instanceof InformationalResponse, true, 'Default direction should be back');
  });

  await test(`[${browserType}] Should return informational response when no forward history`, async () => {
    await fetchPage({ url: 'https://example.com', browser: browserType });

    const result = await navigateHistory({ url: 'https://example.com', direction: 'forward' });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse for no forward history');
    assert.match(result.message, /No forward history/);
  });

}, browserParam);

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
