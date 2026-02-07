/**
 * Tests for typeText action
 * Updated for MCP spec compliance: no success field, use instanceof ErrorResponse
 */

import assert from 'assert';
import { typeText } from '../../src/mcp-browser.js';
import { ErrorResponse, InformationalResponse } from '../../src/core/responses.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';

const browserParam = process.argv[2] || '';

console.log('🧪 Testing typeText action\n');

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
// typeText Tests
// ============================================================================

await runWithBrowsers(async (browserType) => {  
  console.log('\n📋 Testing typeText()');
  
  await test(`[${browserType}] Should require url parameter`, async () => {
    try {
      await typeText({});
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /url parameter is required/);
    }
  });
  
  await test(`[${browserType}] Should require fields parameter`, async () => {
    try {
      await typeText({ url: testUrl });
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /fields parameter is required/);
    }
  });
  
  await test(`[${browserType}] Should require fields to be non-empty array`, async () => {
    try {
      await typeText({ url: testUrl, fields: [] });
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /fields parameter is required and must be a non-empty array/);
    }
  });
  
  await test(`[${browserType}] Should require selector in each field`, async () => {
    try {
      await typeText({ url: testUrl, fields: [{ text: 'test' }] });
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /fields\[0\]\.selector is required/);
    }
  });
  
  await test(`[${browserType}] Should require text in each field`, async () => {
    try {
      await typeText({ url: testUrl, fields: [{ selector: 'input' }] });
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /fields\[0\]\.text is required/);
    }
  });
  
  await test(`[${browserType}] Should return informational response if page not loaded`, async () => {
    const result = await typeText({ 
      url: 'https://unloaded-domain-test.com', 
      fields: [{ selector: 'input', text: 'test' }]
    });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse (not red error)');
    assert.match(result.message, /No open page found/);
  });
}, browserParam);

// ============================================================================
// Integration Tests with real browser (requires the-internet.herokuapp.com)
// ============================================================================

import { fetchPage, closeTab } from '../../src/mcp-browser.js';
import { TypeTextSuccessResponse } from '../../src/actions/type-text.js';

const integrationTestUrl = 'https://the-internet.herokuapp.com/login';

await runWithBrowsers(async (browserType) => {
  console.log('\n📋 Integration Tests: typeText() with real form');
  
  // Load test page first
  await test(`[${browserType}] Setup: Load test page`, async () => {
    const result = await fetchPage({ url: integrationTestUrl });
    assert.ok(result.html, 'Page should load successfully');
    assert.ok(result.html.includes('username'), 'Page should contain username field');
  });
  
  await test(`[${browserType}] Should fill multiple fields successfully`, async () => {
    const result = await typeText({
      url: integrationTestUrl,
      fields: [
        { selector: '#username', text: 'testuser' },
        { selector: '#password', text: 'testpass123' }
      ],
      returnHtml: false
    });
    assert.strictEqual(result instanceof TypeTextSuccessResponse, true, 'Should return TypeTextSuccessResponse');
    assert.match(result.message, /2 fields/);
    assert.match(result.message, /#username/);
    assert.match(result.message, /#password/);
  });
  
  await test(`[${browserType}] Should fail gracefully when selector not found`, async () => {
    const result = await typeText({
      url: integrationTestUrl,
      fields: [
        { selector: '#nonexistent-field', text: 'test', waitForElementTimeout: 1000 }
      ],
      returnHtml: false
    });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse');
    assert.match(result.message, /Failed on field 1 of 1/);
    assert.match(result.reason, /Selector not found/);
    assert.match(result.reason, /#nonexistent-field/);
  });
  
  await test(`[${browserType}] Should report partial success when second field fails`, async () => {
    const result = await typeText({
      url: integrationTestUrl,
      fields: [
        { selector: '#username', text: 'partialuser' },
        { selector: '#bad-selector', text: 'shouldfail', waitForElementTimeout: 1000 }
      ],
      returnHtml: false
    });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse');
    assert.match(result.message, /Failed on field 2 of 2/);
    assert.match(result.message, /Successfully filled 1 field/);
    assert.match(result.message, /#username/);
    assert.match(result.message, /Do NOT re-type/);
  });
  
  await test(`[${browserType}] Should clear existing text by default`, async () => {
    // First fill with initial text
    await typeText({
      url: integrationTestUrl,
      fields: [{ selector: '#username', text: 'initialtext' }],
      returnHtml: false
    });
    
    // Then fill again with new text (should clear first)
    const result = await typeText({
      url: integrationTestUrl,
      fields: [{ selector: '#username', text: 'newtext' }],
      returnHtml: true
    });
    
    assert.strictEqual(result instanceof TypeTextSuccessResponse, true);
    // The value should be 'newtext', not 'initialtextnewtext'
    assert.ok(result.html.includes('value="newtext"') || !result.html.includes('initialtext'), 
      'Field should contain only new text, not appended');
  });
  
  // Cleanup
  await test(`[${browserType}] Cleanup: Close test page`, async () => {
    const result = await closeTab({ url: integrationTestUrl });
    assert.ok(result, 'Tab should close');
  });
  
}, browserParam);

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
