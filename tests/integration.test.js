/**
 * Integration tests - REQUIRES REAL CHROME AND USER AUTHENTICATION
 * These tests will actually open Chrome browser and require manual login
 * Run with: node tests/integration.test.js
 */

import { fileURLToPath } from 'url';
import path from 'path';
import { fetchPage } from '../src/mcp-browser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test framework
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
    testsPassed++;
  }
}

async function test(name, fn) {
  console.log(`\n🧪 Test: ${name}`);
  try {
    await fn();
  } catch (error) {
    console.error(`   Error: ${error.message}`);
  }
}

// Integration Tests
async function runIntegrationTests() {
  console.log('🚀 Starting Integration Tests (REAL CHROME)\n');
  console.log('⚠️  This will open Chrome browser and may require authentication');
  console.log('⚠️  fetchPage function will WAIT for you to complete authentication\n');
  
  try {
    await test('Should fetch eng.ms page, extract links, and load them (full Copilot workflow)', async () => {
      const url = 'https://eng.ms/docs/products/geneva';
      
      // Step 1: Fetch initial page (with auth waiting)
      console.log(`   📄 Step 1: Fetching ${url}`);
      console.log(`   ⏳ Function will wait up to 10 minutes for authentication...`);
      console.log(`   💡 Complete login in the browser that opens`);
      
      const result = await fetchPage({ url });
      
      console.log(`   ✅ Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      if (result.success) {
        console.log(`   🔗 Final URL: ${result.url}`);
        console.log(`   📄 HTML length: ${result.html?.length || 0} chars`);
      } else {
        console.log(`   ❌ Error: ${result.error}`);
        console.log(`   💡 Hint: ${result.hint}`);
      }
      
      assert(result.success, 'Should successfully fetch page after authentication');
      assert(result.url.includes('eng.ms'), `URL should be from eng.ms domain, got: ${result.url}`);
      assert(result.html && result.html.length > 0, 'Should return HTML content');
      
      // Step 2: Extract ALL links from HTML, then pick 5 randomly
      console.log(`\n   📋 Step 2: Extracting all links from HTML...`);
      
      const baseUrl = new URL(result.url);
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
      
      assert(extractedUrls.length > 0, `Should extract at least one eng.ms URL, found ${extractedUrls.length}`);
      
      // Step 3: Load each extracted URL (tab reuse)
      console.log(`\n   🔄 Step 3: Loading extracted links (using same tab)...`);
      
      const linksToTest = extractedUrls.slice(0, Math.min(5, extractedUrls.length));
      for (let i = 0; i < linksToTest.length; i++) {
        const link = linksToTest[i];
        console.log(`   📄 Loading link ${i+1}/${linksToTest.length}: ${link}`);
        
        const linkResult = await fetchPage({ url: link });
        
        console.log(`   ✅ Loaded: ${linkResult.url}`);
        assert(linkResult.success, `Should successfully load link ${i+1}: ${link}`);
        assert(linkResult.html && linkResult.html.length > 0, `Link ${i+1} should return HTML content`);
      }
    });

    await test('Should support removeUnnecessaryHTML parameter', async () => {
      const url = 'https://eng.ms/docs/products/geneva';
      
      console.log(`   📄 Fetching with removeUnnecessaryHTML=true (default)`);
      const cleanResult = await fetchPage({ url, removeUnnecessaryHTML: true });
      
      assert(cleanResult.success, 'Should successfully fetch with removeUnnecessaryHTML=true');
      assert(cleanResult.html && cleanResult.html.length > 0, 'Should return cleaned HTML');
      assert(!cleanResult.html.includes('<script'), 'Cleaned HTML should not contain script tags');
      assert(!cleanResult.html.includes('<style'), 'Cleaned HTML should not contain style tags');
      assert(!cleanResult.html.includes('class='), 'Cleaned HTML should not contain class attributes');
      console.log(`   ✅ Cleaned HTML length: ${cleanResult.html.length} chars`);
      
      console.log(`   📄 Fetching with removeUnnecessaryHTML=false`);
      const rawResult = await fetchPage({ url, removeUnnecessaryHTML: false });
      
      assert(rawResult.success, 'Should successfully fetch with removeUnnecessaryHTML=false');
      assert(rawResult.html && rawResult.html.length > 0, 'Should return raw HTML');
      console.log(`   ✅ Raw HTML length: ${rawResult.html.length} chars`);
      
      // Raw HTML should be larger than cleaned HTML
      assert(rawResult.html.length > cleanResult.html.length, 
        `Raw HTML (${rawResult.html.length}) should be larger than cleaned (${cleanResult.html.length})`);
      
      const reductionPercent = ((rawResult.html.length - cleanResult.html.length) / rawResult.html.length * 100).toFixed(1);
      console.log(`   📊 Size reduction: ${reductionPercent}% (${rawResult.html.length} → ${cleanResult.html.length} chars)`);
    });
    
  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
    testsFailed++;
  } finally {
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    console.log('='.repeat(50));
    console.log('\n💡 Browser left open for manual inspection');
    
    if (testsFailed > 0) {
      process.exit(1);
    }
    
    // Exit immediately without waiting for browser
    process.exit(0);
  }
}

// Run tests
runIntegrationTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
