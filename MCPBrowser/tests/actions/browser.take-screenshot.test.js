/**
 * Tests for takeScreenshot action
 * Tests screenshot capture functionality
 */

import assert from 'assert';
import { takeScreenshot, fetchPage } from '../../src/mcp-browser.js';
import { ErrorResponse, InformationalResponse } from '../../src/core/responses.js';
import { TakeScreenshotSuccessResponse } from '../../src/actions/take-screenshot.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';

const browserParam = process.argv[2] || '';
console.log('🧪 Testing takeScreenshot action\n');

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
// takeScreenshot Tests
// ============================================================================

await runWithBrowsers(async (browserType) => {
  console.log('\n📸 Testing takeScreenshot()');
  
  await test(`[${browserType}] Should require url parameter`, async () => {
    try {
      await takeScreenshot({});
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /url parameter is required/);
    }
  });
  
  await test(`[${browserType}] Should return informational response if page not loaded`, async () => {
    const result = await takeScreenshot({ url: 'https://never-loaded-domain-screenshot-test.com' });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse (not red error)');
    assert.match(result.message, /No open page found/);
  });
  
  await test(`[${browserType}] Should take screenshot from loaded page`, async () => {
    // First fetch a page
    const fetchResult = await fetchPage({ url: testUrl, browser: browserType });
    assert.strictEqual(!(fetchResult instanceof ErrorResponse), true, 'Should fetch page successfully');
    
    // Take screenshot
    const result = await takeScreenshot({ url: testUrl });
    assert.strictEqual(result instanceof TakeScreenshotSuccessResponse, true, 'Should return TakeScreenshotSuccessResponse');
    assert.ok(result.screenshotBase64, 'Should return screenshot data');
    assert.ok(result.currentUrl, 'Should return current URL');
    assert.strictEqual(result.mimeType, 'image/png', 'Should return PNG mime type');
    assert.ok(result.screenshotBase64.length > 0, 'Screenshot data should not be empty');
  });
  
  await test(`[${browserType}] Should capture viewport screenshot by default`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    // Take viewport screenshot (default)
    const viewportResult = await takeScreenshot({ 
      url: testUrl
      // fullPage defaults to false
    });
    assert.strictEqual(viewportResult instanceof TakeScreenshotSuccessResponse, true);
    const viewportLength = viewportResult.screenshotBase64.length;
    
    assert.ok(viewportLength > 1000, 'Viewport screenshot should have reasonable size');
  });
  
  await test(`[${browserType}] Should capture full page when fullPage is true`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    // Take full page screenshot
    const fullPageResult = await takeScreenshot({ 
      url: testUrl,
      fullPage: true 
    });
    assert.strictEqual(fullPageResult instanceof TakeScreenshotSuccessResponse, true);
    assert.ok(fullPageResult.screenshotBase64.length > 1000, 'Full page screenshot should have reasonable size');
  });
  
  await test(`[${browserType}] Should return valid base64 data`, async () => {
    // Ensure page is loaded
    await fetchPage({ url: testUrl, browser: browserType });
    
    const result = await takeScreenshot({ url: testUrl });
    assert.strictEqual(result instanceof TakeScreenshotSuccessResponse, true);
    
    // Verify it's valid base64
    const decoded = Buffer.from(result.screenshotBase64, 'base64');
    assert.ok(decoded.length > 0, 'Should decode to valid buffer');
    
    // PNG magic bytes: 137 80 78 71 (0x89 0x50 0x4E 0x47)
    assert.strictEqual(decoded[0], 0x89, 'PNG magic byte 1');
    assert.strictEqual(decoded[1], 0x50, 'PNG magic byte 2 (P)');
    assert.strictEqual(decoded[2], 0x4E, 'PNG magic byte 3 (N)');
    assert.strictEqual(decoded[3], 0x47, 'PNG magic byte 4 (G)');
  });
  
  await test(`[${browserType}] Should format MCP response with image content`, async () => {
    await fetchPage({ url: testUrl, browser: browserType });
    
    const result = await takeScreenshot({ url: testUrl });
    const mcpFormat = result.toMcpFormat();
    
    assert.strictEqual(mcpFormat.isError, false, 'Should not be an error');
    assert.ok(mcpFormat.content, 'Should have content array');
    assert.strictEqual(mcpFormat.content.length, 2, 'Should have 2 content items (text + image)');
    assert.strictEqual(mcpFormat.content[0].type, 'text', 'First content should be text');
    assert.strictEqual(mcpFormat.content[1].type, 'image', 'Second content should be image');
    assert.strictEqual(mcpFormat.content[1].mimeType, 'image/png', 'Image should be PNG');
    assert.ok(mcpFormat.content[1].data, 'Image should have base64 data');
    assert.ok(mcpFormat.structuredContent, 'Should have structured content');
  });
}, browserParam);

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
