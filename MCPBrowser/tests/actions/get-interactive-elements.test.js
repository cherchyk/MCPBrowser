import assert from 'assert';
import { getInteractiveElements, fetchPage, getBrowser, closeBrowser } from '../../src/mcp-browser.js';

console.log('🧪 Testing getInteractiveElements action\n');

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

await getBrowser();

const testUrl = 'https://example.com';

// ============================================================================
// getInteractiveElements Tests
// ============================================================================

console.log('\n📋 Testing getInteractiveElements()');

await test('Should require url parameter', async () => {
  try {
    await getInteractiveElements({});
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.match(err.message, /url parameter is required/);
  }
});

await test('Should return error if page not loaded', async () => {
  const result = await getInteractiveElements({ 
    url: 'https://unloaded-domain-test.com'
  });
  assert.strictEqual(result.success, false);
  assert.match(result.error, /No open page found/);
});

await test('Should respect limit parameter', async () => {
  // First fetch a page
  await fetchPage({ url: testUrl });
  
  const result = await getInteractiveElements({ 
    url: testUrl,
    limit: 5
  });
  
  if (result.success) {
    assert.ok(result.count <= 5, 'Should respect limit parameter');
    assert.ok(Array.isArray(result.elements), 'Should return elements array');
  }
});

await test('Should find interactive elements on example.com', async () => {
  // Fetch the page first
  const fetchResult = await fetchPage({ url: testUrl });
  assert.strictEqual(fetchResult.success, true, `Should successfully fetch page: ${fetchResult.error || 'no error'}`);
  
  // Get interactive elements
  const elementsResult = await getInteractiveElements({ url: testUrl });
  assert.strictEqual(elementsResult.success, true, 'Should successfully get elements');
  assert.ok(elementsResult.count >= 0, 'Should return element count');
  assert.ok(Array.isArray(elementsResult.elements), 'Should return elements array');
});

// ============================================================================
// Cleanup and Summary
// ============================================================================

await closeBrowser();

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
