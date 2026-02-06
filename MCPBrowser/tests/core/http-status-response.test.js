/**
 * Tests for HttpStatusResponse Class
 * Verifies that HTTP 4xx/5xx responses are shown as informational (NOT red errors)
 * 
 * The MCP server didn't fail - the HTTP request completed successfully,
 * it just returned a non-2xx status code. This should be conveyed clearly
 * without appearing as an MCP error.
 */

import assert from 'assert';
import { MCPResponse, ErrorResponse, HttpStatusResponse } from '../../src/core/responses.js';

console.log('🧪 Testing HttpStatusResponse (Non-Error HTTP Status Handling)');
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

// ============================================================================
// VALIDATION TESTS
// ============================================================================

test('HttpStatusResponse requires string url', () => {
  assert.throws(() => {
    new HttpStatusResponse(123, 404, 'Not Found', '<html></html>');
  }, TypeError, 'Should throw TypeError for non-string url');
});

test('HttpStatusResponse requires number statusCode', () => {
  assert.throws(() => {
    new HttpStatusResponse('https://example.com', '404', 'Not Found', '<html></html>');
  }, TypeError, 'Should throw TypeError for non-number statusCode');
});

test('HttpStatusResponse requires string statusText', () => {
  assert.throws(() => {
    new HttpStatusResponse('https://example.com', 404, null, '<html></html>');
  }, TypeError, 'Should throw TypeError for non-string statusText');
});

test('HttpStatusResponse requires string html', () => {
  assert.throws(() => {
    new HttpStatusResponse('https://example.com', 404, 'Not Found', null);
  }, TypeError, 'Should throw TypeError for non-string html');
});

// ============================================================================
// STRUCTURE TESTS
// ============================================================================

test('HttpStatusResponse creates correct structure for 404', () => {
  const response = new HttpStatusResponse(
    'https://example.com/missing-page',
    404,
    'Not Found',
    '<html><body>Page not found</body></html>'
  );
  
  assert.ok(response instanceof MCPResponse, 'Should be instance of MCPResponse');
  assert.ok(response instanceof HttpStatusResponse, 'Should be instance of HttpStatusResponse');
  assert.strictEqual(response.url, 'https://example.com/missing-page');
  assert.strictEqual(response.statusCode, 404);
  assert.strictEqual(response.statusText, 'Not Found');
  assert.strictEqual(response.statusCategory, 'client_error');
  assert.ok(response.description.includes('Not Found'), 'Should have description');
});

test('HttpStatusResponse creates correct structure for 503', () => {
  const response = new HttpStatusResponse(
    'https://example.com/api',
    503,
    'Service Unavailable',
    '<html><body>Service temporarily unavailable</body></html>'
  );
  
  assert.strictEqual(response.statusCode, 503);
  assert.strictEqual(response.statusCategory, 'server_error');
  assert.ok(response.description.includes('temporarily unavailable'), 'Should have description');
});

test('HttpStatusResponse toJSON includes all fields', () => {
  const response = new HttpStatusResponse(
    'https://example.com/page',
    500,
    'Internal Server Error',
    '<html><body>Error</body></html>'
  );
  
  const json = response.toJSON();
  
  assert.strictEqual(json.url, 'https://example.com/page');
  assert.strictEqual(json.statusCode, 500);
  assert.strictEqual(json.statusText, 'Internal Server Error');
  assert.strictEqual(json.statusCategory, 'server_error');
  assert.ok(json.description, 'Should have description');
  assert.ok(json.html, 'Should have html');
  assert.ok(Array.isArray(json.nextSteps), 'Should have nextSteps array');
});

// ============================================================================
// MCP FORMAT TESTS - CRITICAL: isError must be false
// ============================================================================

test('HttpStatusResponse.toMcpFormat() returns isError: false for 404 (NOT RED)', () => {
  const response = new HttpStatusResponse(
    'https://example.com/not-found',
    404,
    'Not Found',
    '<html></html>'
  );
  
  const mcpFormat = response.toMcpFormat();
  
  // CRITICAL: Must be false - 404 is a valid HTTP response, not an MCP failure
  assert.strictEqual(mcpFormat.isError, false, 'isError must be false for HTTP 404');
});

test('HttpStatusResponse.toMcpFormat() returns isError: false for 500 (NOT RED)', () => {
  const response = new HttpStatusResponse(
    'https://example.com/error',
    500,
    'Internal Server Error',
    '<html></html>'
  );
  
  const mcpFormat = response.toMcpFormat();
  
  // CRITICAL: Must be false - 500 is a valid HTTP response, not an MCP failure
  assert.strictEqual(mcpFormat.isError, false, 'isError must be false for HTTP 500');
});

test('HttpStatusResponse.toMcpFormat() returns isError: false for 503 (NOT RED)', () => {
  const response = new HttpStatusResponse(
    'https://example.com/unavailable',
    503,
    'Service Unavailable',
    '<html></html>'
  );
  
  const mcpFormat = response.toMcpFormat();
  
  // CRITICAL: Must be false - 503 is a valid HTTP response, not an MCP failure
  assert.strictEqual(mcpFormat.isError, false, 'isError must be false for HTTP 503');
});

test('HttpStatusResponse has structuredContent (unlike ErrorResponse)', () => {
  const httpResponse = new HttpStatusResponse(
    'https://example.com',
    404,
    'Not Found',
    '<html></html>'
  );
  
  const errorResponse = new ErrorResponse('Network error', []);
  
  const httpMcp = httpResponse.toMcpFormat();
  const errorMcp = errorResponse.toMcpFormat();
  
  // HTTP responses have structuredContent for programmatic handling
  assert.ok(httpMcp.structuredContent, 'HttpStatusResponse should have structuredContent');
  assert.strictEqual(httpMcp.structuredContent.statusCode, 404);
  
  // Error responses do not have structuredContent per MCP spec
  assert.strictEqual(errorMcp.structuredContent, undefined, 'ErrorResponse should NOT have structuredContent');
});

// ============================================================================
// AUTO-GENERATED NEXT STEPS TESTS
// ============================================================================

test('HttpStatusResponse auto-generates helpful next steps for 401', () => {
  const response = new HttpStatusResponse(
    'https://example.com/protected',
    401,
    'Unauthorized',
    '<html></html>'
  );
  
  assert.ok(response.nextSteps.length > 0, 'Should have auto-generated nextSteps');
  assert.ok(
    response.nextSteps.some(s => s.toLowerCase().includes('auth') || s.toLowerCase().includes('login')),
    'Should suggest authentication-related action'
  );
});

test('HttpStatusResponse auto-generates helpful next steps for 404', () => {
  const response = new HttpStatusResponse(
    'https://example.com/missing',
    404,
    'Not Found',
    '<html></html>'
  );
  
  assert.ok(response.nextSteps.length > 0, 'Should have auto-generated nextSteps');
  assert.ok(
    response.nextSteps.some(s => s.toLowerCase().includes('url') || s.toLowerCase().includes('verify')),
    'Should suggest verifying URL'
  );
});

test('HttpStatusResponse auto-generates helpful next steps for 429', () => {
  const response = new HttpStatusResponse(
    'https://api.example.com/data',
    429,
    'Too Many Requests',
    '<html></html>'
  );
  
  assert.ok(response.nextSteps.length > 0, 'Should have auto-generated nextSteps');
  assert.ok(
    response.nextSteps.some(s => s.toLowerCase().includes('wait') || s.toLowerCase().includes('rate')),
    'Should suggest waiting or mention rate limit'
  );
});

test('HttpStatusResponse auto-generates helpful next steps for 5xx', () => {
  const response = new HttpStatusResponse(
    'https://example.com/api',
    503,
    'Service Unavailable',
    '<html></html>'
  );
  
  assert.ok(response.nextSteps.length > 0, 'Should have auto-generated nextSteps');
  assert.ok(
    response.nextSteps.some(s => s.toLowerCase().includes('server') || s.toLowerCase().includes('wait') || s.toLowerCase().includes('try')),
    'Should suggest server issue or retry'
  );
});

test('HttpStatusResponse allows custom next steps', () => {
  const customSteps = ['Custom step 1', 'Custom step 2'];
  const response = new HttpStatusResponse(
    'https://example.com',
    404,
    'Not Found',
    '<html></html>',
    customSteps
  );
  
  assert.deepStrictEqual(response.nextSteps, customSteps, 'Should use custom nextSteps');
});

// ============================================================================
// TEXT SUMMARY TESTS
// ============================================================================

test('HttpStatusResponse getTextSummary includes status info', () => {
  const response = new HttpStatusResponse(
    'https://example.com/page',
    404,
    'Not Found',
    '<html></html>'
  );
  
  const summary = response.getTextSummary();
  
  assert.ok(summary.includes('404'), 'Should include status code');
  assert.ok(summary.includes('Not Found'), 'Should include status text');
  assert.ok(summary.includes('https://example.com/page'), 'Should include URL');
});

// ============================================================================
// SEMANTIC TESTS - THIS IS THE KEY DISTINCTION
// ============================================================================

test('SEMANTIC: HTTP 404 is NOT an MCP error - it is a valid response', () => {
  // When a webpage returns 404, the MCP server worked correctly!
  // It fetched the page and got back a 404 response - that's the answer.
  // Showing this as "red" would incorrectly suggest the MCP server failed.
  
  const response = new HttpStatusResponse(
    'https://example.com/nonexistent',
    404,
    'Not Found',
    '<html><body>Page not found</body></html>'
  );
  
  const mcpFormat = response.toMcpFormat();
  
  // The MCP request succeeded - we got information about the page
  assert.strictEqual(mcpFormat.isError, false, 'HTTP 404 is NOT an MCP error');
  
  // We have structured data about what happened
  assert.ok(mcpFormat.structuredContent, 'Should have structured data');
  assert.strictEqual(mcpFormat.structuredContent.statusCode, 404);
  
  // The HTML content (even if it's an error page) is included
  assert.ok(mcpFormat.structuredContent.html, 'Should include the response HTML');
});

test('SEMANTIC: HTTP 503 is NOT an MCP error - server responded', () => {
  // The server responded with 503 - the MCP request succeeded in getting a response
  
  const response = new HttpStatusResponse(
    'https://example.com/api',
    503,
    'Service Unavailable',
    '<html><body>Try again later</body></html>'
  );
  
  const mcpFormat = response.toMcpFormat();
  
  assert.strictEqual(mcpFormat.isError, false, 'HTTP 503 is NOT an MCP error');
});

test('CONTRAST: Network failure IS an MCP error', () => {
  // Compare: when the browser itself fails to connect, THAT is an error
  
  const errorResponse = new ErrorResponse(
    'net::ERR_CONNECTION_REFUSED',
    ['Check if the server is running', 'Verify the URL is correct']
  );
  
  const mcpFormat = errorResponse.toMcpFormat();
  
  // This IS an error because we couldn't complete the request
  assert.strictEqual(mcpFormat.isError, true, 'Network failure IS an MCP error');
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log();
console.log('═══════════════════════════════════════════════════════════════');
console.log(`  Results: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════════════════════════════');

if (failed > 0) {
  process.exit(1);
}
