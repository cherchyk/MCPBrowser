/**
 * Tests for InformationalResponse Class
 * Verifies that soft-failure scenarios don't appear as errors (red) in the UI
 * 
 * InformationalResponse is used when:
 * - A prerequisite is not met (e.g., fork doesn't exist yet)
 * - A resource needs to be created first
 * - User action is required before proceeding
 */

import assert from 'assert';
import { MCPResponse, ErrorResponse, InformationalResponse } from '../../src/core/responses.js';

console.log('🧪 Testing InformationalResponse (Non-Error Soft Failures)');
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

test('InformationalResponse requires string message', () => {
  assert.throws(() => {
    new InformationalResponse(123, 'reason', []);
  }, TypeError, 'Should throw TypeError for non-string message');
  
  assert.throws(() => {
    new InformationalResponse(null, 'reason', []);
  }, TypeError, 'Should throw TypeError for null message');
});

test('InformationalResponse requires string reason', () => {
  assert.throws(() => {
    new InformationalResponse('message', 123, []);
  }, TypeError, 'Should throw TypeError for non-string reason');
  
  assert.throws(() => {
    new InformationalResponse('message', null, []);
  }, TypeError, 'Should throw TypeError for null reason');
});

test('InformationalResponse validates nextSteps is an array', () => {
  assert.throws(() => {
    new InformationalResponse('message', 'reason', 'not an array');
  }, TypeError, 'Should throw TypeError for non-array nextSteps');
});

test('InformationalResponse validates nextSteps contains only strings', () => {
  assert.throws(() => {
    new InformationalResponse('message', 'reason', [123, 'valid']);
  }, TypeError, 'Should throw TypeError for non-string in nextSteps');
});

// ============================================================================
// STRUCTURE TESTS
// ============================================================================

test('InformationalResponse creates correct structure', () => {
  const response = new InformationalResponse(
    'Repository fork does not exist yet',
    'The fork needs to be created before a branch can be made',
    ['Fork the repository first', 'Then create the branch']
  );
  
  assert.ok(response instanceof MCPResponse, 'Should be instance of MCPResponse');
  assert.ok(response instanceof InformationalResponse, 'Should be instance of InformationalResponse');
  assert.strictEqual(response.message, 'Repository fork does not exist yet');
  assert.strictEqual(response.reason, 'The fork needs to be created before a branch can be made');
  assert.deepStrictEqual(response.nextSteps, ['Fork the repository first', 'Then create the branch']);
});

test('InformationalResponse toJSON includes status field', () => {
  const response = new InformationalResponse(
    'Action required',
    'Missing prerequisite',
    ['Create the resource first']
  );
  
  const json = response.toJSON();
  
  assert.strictEqual(json.message, 'Action required');
  assert.strictEqual(json.reason, 'Missing prerequisite');
  assert.strictEqual(json.status, 'action_required');
  assert.deepStrictEqual(json.nextSteps, ['Create the resource first']);
});

// ============================================================================
// MCP FORMAT TESTS - CRITICAL: isError must be false
// ============================================================================

test('InformationalResponse.toMcpFormat() returns isError: false (NOT RED)', () => {
  const response = new InformationalResponse(
    'Fork does not exist',
    'Cannot create branch in non-existent fork',
    ['Fork the repository first']
  );
  
  const mcpFormat = response.toMcpFormat();
  
  // CRITICAL: This must be false so the response doesn't appear red in UI
  assert.strictEqual(mcpFormat.isError, false, 'isError must be false for informational responses');
});

test('ErrorResponse.toMcpFormat() returns isError: true (RED)', () => {
  const response = new ErrorResponse(
    'Something went wrong',
    ['Try again']
  );
  
  const mcpFormat = response.toMcpFormat();
  
  // Errors should appear red
  assert.strictEqual(mcpFormat.isError, true, 'isError must be true for error responses');
});

test('InformationalResponse omits structuredContent (like ErrorResponse) to avoid schema violations', () => {
  const infoResponse = new InformationalResponse(
    'Action needed',
    'Prerequisite missing',
    ['Do this first']
  );
  
  const errorResponse = new ErrorResponse(
    'Failed',
    ['Retry']
  );
  
  const infoMcp = infoResponse.toMcpFormat();
  const errorMcp = errorResponse.toMcpFormat();
  
  // InformationalResponse omits structuredContent to avoid tool-specific schema violations
  assert.strictEqual(infoMcp.structuredContent, undefined, 'InformationalResponse should NOT have structuredContent');
  
  // Error responses also do not have structuredContent per MCP spec
  assert.strictEqual(errorMcp.structuredContent, undefined, 'ErrorResponse should NOT have structuredContent');

  // Both convey info via text content
  assert.ok(infoMcp.content[0].text.includes('Action needed'), 'Info text should include message');
  assert.ok(errorMcp.content[0].text.includes('Failed'), 'Error text should include message');
});

// ============================================================================
// TEXT SUMMARY TESTS
// ============================================================================

test('InformationalResponse getTextSummary includes all info', () => {
  const response = new InformationalResponse(
    'Repository fork does not exist yet',
    '404 Not Found when accessing git/ref/heads/main',
    ['Fork the repository using fork_repository', 'Then retry creating the branch']
  );
  
  const summary = response.getTextSummary();
  
  assert.ok(summary.includes('Repository fork does not exist yet'), 'Should include message');
  assert.ok(summary.includes('404 Not Found'), 'Should include reason');
  assert.ok(summary.includes('Fork the repository'), 'Should include next steps');
});

test('InformationalResponse getTextSummary works without nextSteps', () => {
  const response = new InformationalResponse(
    'Action required',
    'Missing prerequisite',
    []
  );
  
  const summary = response.getTextSummary();
  
  assert.ok(summary.includes('Action required'), 'Should include message');
  assert.ok(summary.includes('Missing prerequisite'), 'Should include reason');
  assert.ok(!summary.includes('Suggested actions'), 'Should not include suggested actions when empty');
});

// ============================================================================
// USE CASE TESTS
// ============================================================================

test('Scenario: Fork does not exist - use InformationalResponse not ErrorResponse', () => {
  // This is the scenario from the user's screenshot
  // When a fork doesn't exist, it's not an error - it's an action_required situation
  
  const response = new InformationalResponse(
    'Cannot create branch - fork does not exist',
    'failed to get reference: GET https://api.github.com/repos/cherchyk/awesome-mcp-servers/git/ref/heads/main: 404 Not Found',
    [
      'Fork the repository first using fork_repository tool',
      'Then retry creating the branch'
    ]
  );
  
  const mcpFormat = response.toMcpFormat();
  
  // CRITICAL ASSERTION: Should NOT appear as red error
  assert.strictEqual(mcpFormat.isError, false, 'Missing fork is NOT an error, just needs user action');
  
  // Should NOT have structuredContent (avoids schema violations with tool-specific outputSchemas)
  assert.strictEqual(mcpFormat.structuredContent, undefined, 'Should not have structuredContent');
  
  // Should have helpful text for humans
  assert.ok(mcpFormat.content[0].text.includes('fork_repository'), 'Should suggest using fork_repository');
});

test('Comparison: Error vs Informational response display', () => {
  // Error: unexpected failure, system problem
  const errorResponse = new ErrorResponse(
    'Network timeout after 30 seconds',
    ['Check your internet connection', 'Retry the request']
  );
  
  // Informational: expected situation, user action needed
  const infoResponse = new InformationalResponse(
    'Resource does not exist yet',
    'The resource must be created before this operation',
    ['Create the resource first', 'Then retry this operation']
  );
  
  // Verify the distinction
  assert.strictEqual(errorResponse.toMcpFormat().isError, true, 'Error response should be red');
  assert.strictEqual(infoResponse.toMcpFormat().isError, false, 'Informational response should NOT be red');
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
