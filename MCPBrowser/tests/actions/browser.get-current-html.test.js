/**
 * Tests for getCurrentHtml action
 * Updated for MCP spec compliance: no success field, use instanceof ErrorResponse
 */

import assert from 'assert';
import { getCurrentHtml, fetchPage } from '../../src/mcp-browser.js';
import { ErrorResponse } from '../../src/core/responses.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';
const browserParam = process.argv[2] || '';
console.log('🧪 Testing getCurrentHtml action\n');

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
// getCurrentHtml Tests
// ============================================================================

await runWithBrowsers(async (browserType) => {
  console.log('\n📋 Testing getCurrentHtml()');
  
  await test(`[${browserType}] Should require url parameter`, async () => {
    try {
      await getCurrentHtml({});
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /url parameter is required/);
    }
  });
  
  await test(`[${browserType}] Should return error if page not loaded`, async () => {
    const result = await getCurrentHtml({ url: 'https://never-loaded-domain-12345.com' });
    assert.strictEqual(result instanceof ErrorResponse, true);
    assert.match(result.message, /No open page found/);
  });
  
  await test(`[${browserType}] Should get current HTML from loaded page`, async () => {
    // First fetch a page
    const fetchResult = await fetchPage({ url: testUrl, browser: browserType });
    assert.strictEqual(!(fetchResult instanceof ErrorResponse), true, 'Should fetch page successfully');
    
    // Get current HTML
    const result = await getCurrentHtml({ url: testUrl });
    assert.strictEqual(!(result instanceof ErrorResponse), true, 'Should get HTML successfully');
    assert.ok(result.html, 'Should return HTML content');
    assert.ok(result.currentUrl, 'Should return current URL');
    assert.ok(result.html.length > 0, 'HTML should not be empty');
  });
  
  await test(`[${browserType}] Should respect removeUnnecessaryHTML parameter`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    // Get cleaned HTML (default)
    const cleanedResult = await getCurrentHtml({ 
      url: testUrl,
      removeUnnecessaryHTML: true 
    });
    assert.strictEqual(!(cleanedResult instanceof ErrorResponse), true);
    const cleanedLength = cleanedResult.html.length;
    
    // Get raw HTML
    const rawResult = await getCurrentHtml({ 
      url: testUrl,
      removeUnnecessaryHTML: false 
    });
    assert.strictEqual(!(rawResult instanceof ErrorResponse), true);
    const rawLength = rawResult.html.length;
    
    // Raw should be longer than cleaned
    assert.ok(rawLength > cleanedLength, 
      `Raw HTML (${rawLength}) should be longer than cleaned (${cleanedLength})`);
  });
}, browserParam);

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
