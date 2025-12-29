import assert from 'assert';
import { waitForElement, getBrowser, closeBrowser } from '../../src/mcp-browser.js';

console.log('🧪 Testing waitForElement action\n');

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
// waitForElement Tests
// ============================================================================

console.log('\n📋 Testing waitForElement()');

await test('Should require url parameter', async () => {
  try {
    await waitForElement({});
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.match(err.message, /url parameter is required/);
  }
});

await test('Should require either selector or text parameter', async () => {
  try {
    await waitForElement({ url: testUrl });
    throw new Error('Should have thrown an error');
  } catch (err) {
    assert.match(err.message, /Either selector or text parameter is required/);
  }
});

await test('Should return error if page not loaded', async () => {
  const result = await waitForElement({ 
    url: 'https://unloaded-domain-test.com',
    selector: 'div'
  });
  assert.strictEqual(result.success, false);
  assert.match(result.error, /No open page found/);
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
