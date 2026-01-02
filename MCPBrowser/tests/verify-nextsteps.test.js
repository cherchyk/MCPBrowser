/**
 * Quick verification test for nextSteps field in responses
 * Updated for MCP spec compliance: no success field, use instanceof ErrorResponse
 */

import assert from 'assert';
import { fetchPage, clickElement, typeText, getCurrentHtml, closeTab } from '../src/mcp-browser.js';
import { ErrorResponse } from '../src/core/responses.js';

console.log('🧪 Testing nextSteps field in responses\n');

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
// Test nextSteps in responses
// ============================================================================

await test('fetch_webpage success should include nextSteps', async () => {
  const result = await fetchPage({ url: 'https://example.com', removeUnnecessaryHTML: true });
  assert.ok(!(result instanceof ErrorResponse), 'Should succeed');
  assert.ok(result.nextSteps, 'Should have nextSteps field');
  assert.ok(Array.isArray(result.nextSteps), 'nextSteps should be an array');
  assert.ok(result.nextSteps.length > 0, 'nextSteps should not be empty');
  assert.ok(result.nextSteps.includes('Use click_element to interact with buttons/links on the page'), 'Should suggest click_element');
  assert.ok(result.nextSteps.includes('Use close_tab when finished to free browser resources'), 'Should suggest close_tab');
  console.log(`   nextSteps: ${result.nextSteps.join(', ')}`);
});

await test('click_element error should include nextSteps', async () => {
  const result = await clickElement({ url: 'https://never-loaded-domain-12345.com', selector: '#test' });
  assert.ok(result instanceof ErrorResponse, 'Should fail for non-loaded page');
  assert.ok(result.nextSteps, 'Error should have nextSteps field');
  assert.ok(Array.isArray(result.nextSteps), 'nextSteps should be an array');
  assert.ok(result.nextSteps.includes('Use fetch_webpage to load the page first'), 'Should suggest fetch_webpage');
  console.log(`   nextSteps: ${result.nextSteps.join(', ')}`);
});

await test('type_text error should include nextSteps', async () => {
  const result = await typeText({ url: 'https://never-loaded-domain-12345.com', selector: '#test', text: 'hello' });
  assert.ok(result instanceof ErrorResponse, 'Should fail for non-loaded page');
  assert.ok(result.nextSteps, 'Error should have nextSteps field');
  assert.ok(Array.isArray(result.nextSteps), 'nextSteps should be an array');
  console.log(`   nextSteps: ${result.nextSteps.join(', ')}`);
});

await test('get_current_html with loaded page should include nextSteps', async () => {
  const result = await getCurrentHtml({ url: 'https://example.com' });
  assert.ok(!(result instanceof ErrorResponse), 'Should succeed for loaded page');
  assert.ok(result.nextSteps, 'Should have nextSteps field');
  assert.ok(Array.isArray(result.nextSteps), 'nextSteps should be an array');
  assert.ok(result.nextSteps.length > 0, 'nextSteps should not be empty');
  console.log(`   nextSteps: ${result.nextSteps.join(', ')}`);
});

await test('close_tab success should include nextSteps', async () => {
  const result = await closeTab({ url: 'https://example.com' });
  assert.ok(!(result instanceof ErrorResponse), 'Should succeed');
  assert.ok(result.nextSteps, 'Should have nextSteps field');
  assert.ok(Array.isArray(result.nextSteps), 'nextSteps should be an array');
  assert.ok(result.nextSteps.includes('Use fetch_webpage to open a new page if needed'), 'Should suggest fetch_webpage');
  console.log(`   nextSteps: ${result.nextSteps.join(', ')}`);
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
if (testsFailed === 0) {
  console.log(`✅ All ${testsPassed} tests passed!`);
} else {
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
}
console.log('='.repeat(50) + '\n');

process.exit(testsFailed > 0 ? 1 : 0);
