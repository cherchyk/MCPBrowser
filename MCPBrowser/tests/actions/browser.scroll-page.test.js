/**
 * Tests for scrollPage action
 * Tests page scrolling functionality
 */

import assert from 'assert';
import { scrollPage, fetchPage } from '../../src/mcp-browser.js';
import { ErrorResponse, InformationalResponse } from '../../src/core/responses.js';
import { ScrollPageSuccessResponse } from '../../src/actions/scroll-page.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';

const browserParam = process.argv[2] || '';
console.log('🧪 Testing scrollPage action\n');

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

// Use Wikipedia for scroll testing (longer page)
const testUrl = 'https://en.wikipedia.org/wiki/Web_browser';

// ============================================================================
// scrollPage Tests
// ============================================================================

await runWithBrowsers(async (browserType) => {
  console.log('\n📜 Testing scrollPage()');
  
  await test(`[${browserType}] Should require url parameter`, async () => {
    try {
      await scrollPage({});
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /url parameter is required/);
    }
  });
  
  await test(`[${browserType}] Should return informational response if page not loaded`, async () => {
    const result = await scrollPage({ url: 'https://never-loaded-domain-scroll-test.com' });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse (not red error)');
    assert.match(result.message, /No open page found/);
  });
  
  await test(`[${browserType}] Should return scroll position without scrolling when no params`, async () => {
    // First fetch a page
    const fetchResult = await fetchPage({ url: testUrl, browser: browserType });
    assert.strictEqual(!(fetchResult instanceof ErrorResponse), true, 'Should fetch page successfully');
    
    // Get current position without scrolling
    const result = await scrollPage({ url: testUrl });
    assert.strictEqual(result instanceof ScrollPageSuccessResponse, true, 'Should return ScrollPageSuccessResponse');
    assert.strictEqual(typeof result.scrollX, 'number', 'Should return scrollX');
    assert.strictEqual(typeof result.scrollY, 'number', 'Should return scrollY');
    assert.strictEqual(typeof result.pageWidth, 'number', 'Should return pageWidth');
    assert.strictEqual(typeof result.pageHeight, 'number', 'Should return pageHeight');
    assert.strictEqual(typeof result.viewportWidth, 'number', 'Should return viewportWidth');
    assert.strictEqual(typeof result.viewportHeight, 'number', 'Should return viewportHeight');
  });
  
  await test(`[${browserType}] Should scroll down by specified amount`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    // Reset to top
    await scrollPage({ url: testUrl, x: 0, y: 0 });
    
    // Scroll down
    const result = await scrollPage({ 
      url: testUrl,
      direction: 'down',
      amount: 300
    });
    
    assert.strictEqual(result instanceof ScrollPageSuccessResponse, true);
    assert.ok(result.scrollY > 0, 'Should have scrolled down');
  });
  
  await test(`[${browserType}] Should scroll to absolute position`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    // Scroll to specific position
    const result = await scrollPage({ 
      url: testUrl,
      x: 0,
      y: 500
    });
    
    assert.strictEqual(result instanceof ScrollPageSuccessResponse, true);
    assert.ok(result.scrollY >= 450, 'Should be near target Y position'); // Allow some tolerance
  });
  
  await test(`[${browserType}] Should scroll to element by selector`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    // First reset to top
    await scrollPage({ url: testUrl, x: 0, y: 0 });
    
    // Scroll to footer or a specific element
    const result = await scrollPage({ 
      url: testUrl,
      selector: '#See_also, #References, footer, .mw-footer'
    });
    
    assert.strictEqual(result instanceof ScrollPageSuccessResponse, true);
    // After scrolling to an element near the bottom, scrollY should be > 0
    assert.ok(result.scrollY >= 0, 'Should have scrolled to element');
  });
  
  await test(`[${browserType}] Should return informational response for non-existent selector`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    const result = await scrollPage({ 
      url: testUrl,
      selector: '#this-element-definitely-does-not-exist-12345'
    });
    
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse for missing element');
    assert.match(result.message, /Element not found/);
  });
  
  await test(`[${browserType}] Should scroll up after scrolling down`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    // First scroll down
    await scrollPage({ url: testUrl, direction: 'down', amount: 500 });
    const afterDown = await scrollPage({ url: testUrl });
    
    // Then scroll up
    const result = await scrollPage({ 
      url: testUrl,
      direction: 'up',
      amount: 300
    });
    
    assert.strictEqual(result instanceof ScrollPageSuccessResponse, true);
    assert.ok(result.scrollY < afterDown.scrollY, 'Should have scrolled up');
  });
  
  await test(`[${browserType}] Should handle invalid direction`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    const result = await scrollPage({ 
      url: testUrl,
      direction: 'diagonal' // Invalid direction
    });
    
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse for invalid direction');
  });

}, browserParam);

// Summary
console.log('\n' + '='.repeat(50));
console.log(`📊 Tests passed: ${testsPassed}`);
console.log(`❌ Tests failed: ${testsFailed}`);
process.exit(testsFailed > 0 ? 1 : 0);
