/**
 * Tests for clickElement action
 * Updated for MCP spec compliance: no success field, use instanceof ErrorResponse
 */

import assert from 'assert';
import { clickElement } from '../../src/mcp-browser.js';
import { ErrorResponse } from '../../src/core/responses.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';

const browserParam = process.argv[2] || '';

console.log('🧪 Testing clickElement action\n');

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

const testUrl = 'https://example.com';

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
  
  await test(`[${browserType}] Should return error if page not loaded`, async () => {
    const result = await clickElement({ 
      url: 'https://unloaded-domain-test.com', 
      selector: 'button' 
    });
    assert.strictEqual(result instanceof ErrorResponse, true);
    assert.match(result.message, /No open page found/);
  });
}, browserParam);

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
