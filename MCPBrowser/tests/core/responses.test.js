/**
 * Tests for Response Classes
 * Demonstrates type safety and validation benefits
 * Updated for MCP spec compliance: no success field, ErrorResponse uses message
 */

import assert from 'assert';
import { MCPResponse, ErrorResponse } from '../../src/core/responses.js';
import { FetchPageSuccessResponse } from '../../src/actions/fetch-page.js';
import { ClickElementSuccessResponse } from '../../src/actions/click-element.js';
import { TypeTextSuccessResponse } from '../../src/actions/type-text.js';
import { CloseTabSuccessResponse } from '../../src/actions/close-tab.js';
import { GetCurrentHtmlSuccessResponse } from '../../src/actions/get-current-html.js';

console.log('🧪 Testing Response Classes (MCP Spec Compliant)');
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`❌ ${name}`);
    console.log(`   ${err.message}`);
    failed++;
  }
}

// Test 1: FetchPageSuccessResponse validates required fields
test('FetchPageSuccessResponse requires string parameters', () => {
  assert.throws(() => {
    new FetchPageSuccessResponse(123, '<html></html>', []);
  }, TypeError, 'Should throw TypeError for non-string currentUrl');
  
  assert.throws(() => {
    new FetchPageSuccessResponse('https://example.com', 123, []);
  }, TypeError, 'Should throw TypeError for non-string html');
});

// Test 2: ErrorResponse validates message
test('ErrorResponse requires string message', () => {
  assert.throws(() => {
    new ErrorResponse(null, []);
  }, TypeError, 'Should throw TypeError for null message');
  
  assert.throws(() => {
    new ErrorResponse(123, []);
  }, TypeError, 'Should throw TypeError for non-string message');
});

// Test 3: nextSteps must be an array
test('All responses validate nextSteps is an array', () => {
  assert.throws(() => {
    new ErrorResponse('Error', 'not an array');
  }, TypeError, 'Should throw TypeError for non-array nextSteps');
  
  assert.throws(() => {
    new FetchPageSuccessResponse('https://example.com', '<html></html>', 'not an array');
  }, TypeError, 'Should throw TypeError for non-array nextSteps');
});

// Test 4: nextSteps array must contain only strings
test('nextSteps array must contain only strings', () => {
  assert.throws(() => {
    new ErrorResponse('Error', [123, 'valid string']);
  }, TypeError, 'Should throw TypeError for non-string in nextSteps');
  
  assert.throws(() => {
    new FetchPageSuccessResponse('https://example.com', '<html></html>', ['valid', null]);
  }, TypeError, 'Should throw TypeError for null in nextSteps');
});

// Test 5: FetchPageSuccessResponse creates valid object
test('FetchPageSuccessResponse creates correct structure', () => {
  const response = new FetchPageSuccessResponse(
    'https://example.com',
    '<html>test</html>',
    ['Step 1', 'Step 2']
  );
  
  assert.ok(response instanceof MCPResponse, 'Should be instance of MCPResponse');
  assert.strictEqual(response.currentUrl, 'https://example.com');
  assert.strictEqual(response.html, '<html>test</html>');
  assert.deepStrictEqual(response.nextSteps, ['Step 1', 'Step 2']);
});

// Test 6: ErrorResponse creates valid object
test('ErrorResponse creates correct structure', () => {
  const response = new ErrorResponse(
    'Something went wrong',
    ['Try again', 'Check logs']
  );
  
  assert.ok(response instanceof ErrorResponse, 'Should be instance of ErrorResponse');
  assert.strictEqual(response.message, 'Something went wrong');
  assert.deepStrictEqual(response.nextSteps, ['Try again', 'Check logs']);
});

// Test 7: toJSON() converts to plain object
test('toJSON() converts response to plain object', () => {
  const response = new FetchPageSuccessResponse(
    'https://example.com',
    '<html>test</html>',
    ['Step 1']
  );
  
  const json = response.toJSON();
  
  assert.strictEqual(typeof json, 'object');
  assert.strictEqual(json.currentUrl, 'https://example.com');
  assert.strictEqual(json.html, '<html>test</html>');
  assert.deepStrictEqual(json.nextSteps, ['Step 1']);
});

// Test 8: ClickElementSuccessResponse validates html can be null
test('ClickElementSuccessResponse allows null html', () => {
  const response = new ClickElementSuccessResponse(
    'https://example.com',
    'Clicked button',
    null,
    ['Next step']
  );
  
  assert.strictEqual(response.html, null);
  assert.ok(response instanceof MCPResponse, 'Should be instance of MCPResponse');
});

// Test 9: ClickElementSuccessResponse rejects invalid html
test('ClickElementSuccessResponse rejects non-string non-null html', () => {
  assert.throws(() => {
    new ClickElementSuccessResponse(
      'https://example.com',
      'Clicked button',
      123,
      ['Next step']
    );
  }, TypeError, 'Should throw TypeError for non-string non-null html');
});

// Test 10: TypeTextSuccessResponse validates message
test('TypeTextSuccessResponse requires string message', () => {
  assert.throws(() => {
    new TypeTextSuccessResponse(
      'https://example.com',
      123,
      '<html></html>',
      ['Next']
    );
  }, TypeError, 'Should throw TypeError for non-string message');
});

// Test 11: CloseTabSuccessResponse validates hostname
test('CloseTabSuccessResponse requires string hostname', () => {
  assert.throws(() => {
    new CloseTabSuccessResponse(
      'Tab closed',
      123,
      ['Next']
    );
  }, TypeError, 'Should throw TypeError for non-string hostname');
});

// Test 12: GetCurrentHtmlSuccessResponse creates valid structure
test('GetCurrentHtmlSuccessResponse creates correct structure', () => {
  const response = new GetCurrentHtmlSuccessResponse(
    'https://example.com',
    '<html>current</html>',
    ['Step 1']
  );
  
  assert.ok(response instanceof MCPResponse, 'Should be instance of MCPResponse');
  assert.strictEqual(response.currentUrl, 'https://example.com');
  assert.strictEqual(response.html, '<html>current</html>');
});

// Test 13: Catch errors at creation time, not runtime
test('Type errors are caught at response creation', () => {
  let error = null;
  try {
    // This would fail later when trying to format the response
    // But with classes, it fails immediately
    new FetchPageSuccessResponse(null, '<html></html>', []);
  } catch (err) {
    error = err;
  }
  
  assert.ok(error instanceof TypeError, 'Should throw TypeError immediately');
  assert.ok(error.message.includes('currentUrl'), 'Error message should mention field name');
});

// Test 14: JSON serialization works correctly
test('Response serializes to JSON correctly', () => {
  const response = new CloseTabSuccessResponse(
    'Tab closed successfully',
    'example.com',
    ['Use fetch_webpage to open new page']
  );
  
  const json = JSON.stringify(response);
  const parsed = JSON.parse(json);
  
  assert.strictEqual(parsed.message, 'Tab closed successfully');
  assert.strictEqual(parsed.hostname, 'example.com');
  assert.deepStrictEqual(parsed.nextSteps, ['Use fetch_webpage to open new page']);
});

console.log();
console.log('==================================================');
console.log(`Tests passed: ${passed}`);
console.log(`Tests failed: ${failed}`);
console.log('==================================================');
console.log();

if (failed > 0) {
  process.exit(1);
}
