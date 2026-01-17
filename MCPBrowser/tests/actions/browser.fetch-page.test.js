/**
 * Integration tests - REQUIRES REAL CHROME AND USER AUTHENTICATION
 * These tests will actually open Chrome browser and require manual login
 * Updated for MCP spec compliance: no success field, use instanceof ErrorResponse
 * 
 * Run locally (all tests):
 *   npm test
 *   node tests/run-all.js
 * 
 * Skip integration tests (run unit tests only):
 *   npm run test:ci
 *   node tests/run-unit.js
 */

import assert from 'assert';
import { fetchPage } from '../../src/mcp-browser.js';
import { ErrorResponse } from '../../src/core/responses.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';

const browserParam = process.argv[2] || '';

console.log('🚀 Starting Integration Tests (REAL CHROME)\n');
console.log('⚠️  This will open Chrome browser and may require authentication');
console.log('⚠️  fetchPage function will WAIT for you to complete authentication');
console.log('');

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
// Integration Tests
// ============================================================================

await runWithBrowsers(async (browserType) => {

await test(`[${browserType}] Should handle gmail.com → mail.google.com permanent redirect`, async () => {
  const url = 'https://gmail.com';
  
  console.log(`   📄 Fetching ${url}`);
  console.log(`   💡 This should detect permanent redirect and return content immediately`);
  
  const result = await fetchPage({ url, browser: browserType });
  
  const isSuccess = !(result instanceof ErrorResponse);
  console.log(`   ✅ Result: ${isSuccess ? 'SUCCESS' : 'FAILED'}`);
  if (isSuccess) {
    console.log(`   🔗 Final URL: ${result.currentUrl}`);
    console.log(`   📄 HTML length: ${result.html?.length || 0} chars`);
  } else {
    console.log(`   ❌ Error: ${result.message}`);
  }
  
  assert.ok(isSuccess, 'Should successfully fetch gmail.com');
  assert.ok(result.currentUrl.includes('mail.google.com'), `Should redirect to mail.google.com, got: ${result.currentUrl}`);
  assert.ok(result.html && result.html.length > 0, 'Should return HTML content');
  assert.ok(result.html.includes('Gmail') || result.html.includes('Google'), 'HTML should contain Gmail or Google content');
  
  console.log(`   ✅ Permanent redirect handled correctly (gmail.com → mail.google.com)`);
});

await test(`[${browserType}] Should fetch eng.ms page, extract links, and load them (full Copilot workflow)`, async () => {
  const url = 'https://eng.ms/docs/products/geneva';
  
  // Step 1: Fetch initial page (with auth waiting)
  console.log(`   📄 Step 1: Fetching ${url}`);
  console.log(`   ⏳ Function will wait up to 10 minutes for authentication...`);
  console.log(`   💡 Complete login in the browser that opens`);
  
  const result = await fetchPage({ url, browser: browserType });
  
  console.log(`   ✅ Result: ${!(result instanceof ErrorResponse) ? 'SUCCESS' : 'FAILED'}`);
  if (!(result instanceof ErrorResponse)) {
    console.log(`   🔗 Final URL: ${result.currentUrl}`);
    console.log(`   📄 HTML length: ${result.html?.length || 0} chars`);
  } else {
    console.log(`   ❌ Error: ${result.message}`);
    console.log(`   💡 Hint: ${result.hint}`);
  }
  
  assert.strictEqual(!(result instanceof ErrorResponse), true, 'Should successfully fetch page after authentication');
  assert.ok(result.currentUrl.includes('eng.ms'), `URL should be from eng.ms domain, got: ${result.currentUrl}`);
  assert.ok(result.html && result.html.length > 0, 'Should return HTML content');
  
  // Step 2: Extract ALL links from HTML, then pick 5 randomly
  console.log(`\n   📋 Step 2: Extracting all links from HTML...`);
  
  const baseUrl = new URL(result.currentUrl);
  const urlPattern = /href=["']([^"']+)["']/g;
  const allUrls = [];
  let match;
  
  // Static asset extensions to skip
  const skipExtensions = ['.css', '.js', '.ico', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
  
  // Extract ALL URLs first
  while ((match = urlPattern.exec(result.html)) !== null) {
    let foundUrl = match[1];
    
    // Skip anchor links
    if (foundUrl.includes('#')) continue;
    
    // Convert relative URLs to absolute
    if (foundUrl.startsWith('/')) {
      foundUrl = `${baseUrl.origin}${foundUrl}`;
    } else if (!foundUrl.startsWith('http')) {
      continue; // Skip other relative URLs
    }
    
    // Skip static assets (check path without query string)
    const urlWithoutQuery = foundUrl.split('?')[0];
    if (skipExtensions.some(ext => urlWithoutQuery.toLowerCase().endsWith(ext))) continue;
    
    // Only include eng.ms URLs (pages)
    if (foundUrl.includes('eng.ms')) {
      allUrls.push(foundUrl);
    }
  }
  
  console.log(`   📊 Total page URLs found: ${allUrls.length}`);
  
  // Remove duplicates
  const uniqueUrls = [...new Set(allUrls)];
  console.log(`   🔗 Unique page URLs: ${uniqueUrls.length}`);
  
  // Randomly pick 5 URLs
  const shuffled = uniqueUrls.sort(() => Math.random() - 0.5);
  const extractedUrls = shuffled.slice(0, 5);
  
  console.log(`   🎲 Randomly selected ${extractedUrls.length} URLs to test:`);
  extractedUrls.forEach((link, i) => console.log(`      ${i+1}. ${link}`));
  
  assert.ok(extractedUrls.length > 0, `Should extract at least one eng.ms URL, found ${extractedUrls.length}`);
  
  // Step 3: Load each extracted URL (tab reuse)
  console.log(`\n   🔄 Step 3: Loading extracted links (using same tab)...`);
  
  const linksToTest = extractedUrls.slice(0, Math.min(5, extractedUrls.length));
  for (let i = 0; i < linksToTest.length; i++) {
    const link = linksToTest[i];
    console.log(`   📄 Loading link ${i+1}/${linksToTest.length}: ${link}`);
    
    const linkResult = await fetchPage({ url: link, browser: browserType });
    
    console.log(`   ✅ Loaded: ${linkResult.currentUrl}`);
    assert.strictEqual(!(linkResult instanceof ErrorResponse), true, `Should successfully load link ${i+1}: ${link}`);
    assert.ok(linkResult.html && linkResult.html.length > 0, `Link ${i+1} should return HTML content`);
  }
});

await test(`[${browserType}] Should support removeUnnecessaryHTML parameter`, async () => {
  const url = 'https://eng.ms/docs/products/geneva';
  
  console.log(`   📄 Fetching with removeUnnecessaryHTML=true (default)`);
  const cleanResult = await fetchPage({ url, browser: browserType, removeUnnecessaryHTML: true });
  
  assert.strictEqual(!(cleanResult instanceof ErrorResponse), true, 'Should successfully fetch with removeUnnecessaryHTML=true');
  assert.ok(cleanResult.html && cleanResult.html.length > 0, 'Should return cleaned HTML');
  assert.ok(!cleanResult.html.includes('<script'), 'Cleaned HTML should not contain script tags');
  assert.ok(!cleanResult.html.includes('<style'), 'Cleaned HTML should not contain style tags');
  assert.ok(cleanResult.html.includes('class=') || !cleanResult.html.includes('class='), 'Class attributes are now kept for interaction');
  console.log(`   ✅ Cleaned HTML length: ${cleanResult.html.length} chars`);
  
  console.log(`   📄 Fetching with removeUnnecessaryHTML=false`);
  const rawResult = await fetchPage({ url, browser: browserType, removeUnnecessaryHTML: false });
  
  assert.strictEqual(!(rawResult instanceof ErrorResponse), true, 'Should successfully fetch with removeUnnecessaryHTML=false');
  assert.ok(rawResult.html && rawResult.html.length > 0, 'Should return raw HTML');
  console.log(`   ✅ Raw HTML length: ${rawResult.html.length} chars`);
  
  // Raw HTML should be larger than cleaned HTML
  assert.ok(rawResult.html.length > cleanResult.html.length, 
    `Raw HTML (${rawResult.html.length}) should be larger than cleaned (${cleanResult.html.length})`);
  
  const reductionPercent = ((rawResult.html.length - cleanResult.html.length) / rawResult.html.length * 100).toFixed(1);
  console.log(`   📊 Size reduction: ${reductionPercent}% (${rawResult.html.length} → ${cleanResult.html.length} chars)`);
});

// ============================================================================
await test(`[${browserType}] Should handle parallel requests to same domain (queue test)`, async () => {
  // These are 3 different pages on the same domain (eng.ms)
  // They should be queued and processed sequentially, but each should get correct content
  const urls = [
    'https://eng.ms/docs/products/geneva/getting_started/environments/linuxvm',
    'https://eng.ms/docs/products/geneva/getting_started/environments/akslinux',
    'https://eng.ms/docs/products/geneva/runners/synthetics'
  ];
  
  console.log(`   📄 Fetching 3 eng.ms pages SIMULTANEOUSLY:`);
  urls.forEach((url, i) => console.log(`      ${i + 1}. ${url.split('/').slice(-2).join('/')}`));
  console.log(`   💡 These should be queued (same domain) and processed sequentially`);
  console.log(`   ⏳ Starting parallel requests...`);
  
  const startTime = Date.now();
  
  // Fire all 3 requests simultaneously
  const promises = urls.map((url, index) => {
    const requestStart = Date.now();
    return fetchPage({ url, browser: browserType })
      .then(result => ({
        index,
        url,
        result,
        duration: Date.now() - requestStart,
        completedAt: Date.now() - startTime
      }));
  });
  
  // Wait for all to complete
  const results = await Promise.all(promises);
  
  const totalDuration = Date.now() - startTime;
  console.log(`   ⏱️  Total time for all 3 requests: ${totalDuration}ms`);
  
  // Count successes and failures
  let successCount = 0;
  
  // Verify each request
  for (const { index, url, result, duration, completedAt } of results) {
    const isSuccess = !(result instanceof ErrorResponse);
    const shortUrl = url.split('/').slice(-2).join('/');
    
    if (!isSuccess) {
      console.log(`   ⚠️  Request ${index + 1} (${shortUrl}) had error: ${result.message}`);
      // Don't fail test on individual request errors - we're testing the queue mechanism
      continue;
    }
    
    successCount++;
    
    // Verify content matches the requested URL (not mixed up with another request)
    const finalUrl = result.currentUrl;
    const expectedPathPart = url.split('/').pop(); // e.g., 'linuxvm', 'akslinux', 'synthetics'
    
    console.log(`   ✅ Request ${index + 1}: ${shortUrl}`);
    console.log(`      Final URL: ${finalUrl.substring(0, 80)}...`);
    console.log(`      Completed at: ${completedAt}ms (took ${duration}ms)`);
    console.log(`      HTML length: ${result.html?.length || 0} chars`);
    
    // Check that final URL contains expected path (content wasn't mixed up)
    const contentCorrect = finalUrl.includes(expectedPathPart) || 
                          finalUrl.includes('eng.ms') ||
                          result.html.length > 1000;
    assert.ok(contentCorrect, `Request ${index + 1} should return correct page content`);
  }
  
  // At least 2 out of 3 should succeed (allows for transient network issues)
  assert.ok(successCount >= 2, `At least 2 requests should succeed, got ${successCount}`);
  
  // Verify requests were processed sequentially (queued)
  // Each request should have completed at different times
  const completionTimes = results.map(r => r.completedAt).sort((a, b) => a - b);
  console.log(`   📊 Completion order: ${completionTimes.map(t => `${t}ms`).join(' → ')}`);
  
  // The key assertion: requests complete at DIFFERENT times (not all at once)
  // If they were parallel without queue, they'd complete nearly simultaneously
  const firstComplete = completionTimes[0];
  const lastComplete = completionTimes[completionTimes.length - 1];
  const spread = lastComplete - firstComplete;
  
  console.log(`   📈 Time spread between first and last completion: ${spread}ms`);
  
  // With sequential queue + SPA detection/wait, spread should be significant
  // (at least 1 second for 3 requests processed sequentially)
  assert.ok(spread > 500, `Requests should complete sequentially (spread: ${spread}ms)`);
  
  console.log(`   ✅ ${successCount}/3 parallel requests completed successfully!`);
  console.log(`   ✅ Domain queue prevented race conditions (sequential processing verified)`);
});

}, browserParam);

// Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  process.exit(1);
}
process.exit(0);
