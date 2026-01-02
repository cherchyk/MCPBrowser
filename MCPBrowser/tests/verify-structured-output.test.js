/**
 * Test to verify MCP-compliant structured output format
 * Ensures responses follow the Model Context Protocol specification
 * Updated for MCP spec compliance: errors don't have structuredContent
 */

import assert from 'assert';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Testing MCP Structured Output Format\n');

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

/**
 * Helper to call a tool via MCP protocol and get the response
 */
async function callMcpTool(toolName, args) {
  const mcpProcess = spawn('node', [join(__dirname, '..', 'src', 'mcp-browser.js')], {
    stdio: ['pipe', 'pipe', 'inherit']
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      mcpProcess.kill();
      reject(new Error('Request timeout'));
    }, 10000);

    let buffer = '';
    mcpProcess.stdout.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.id === 2) { // Tool call response
              clearTimeout(timeout);
              mcpProcess.kill();
              resolve(parsed.result);
              return;
            }
          } catch (e) {
            // Not JSON, continue
          }
        }
      }
    });

    mcpProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    // Initialize
    mcpProcess.stdin.write(JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0' }
      }
    }) + '\n');

    // Wait a bit for initialization
    setTimeout(() => {
      // Call the tool
      mcpProcess.stdin.write(JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        }
      }) + '\n');
    }, 500);
  });
}

// ============================================================================
// Structured Output Format Tests
// ============================================================================

await test('fetch_webpage success should have MCP-compliant structure', async () => {
  const result = await callMcpTool('fetch_webpage', { url: 'https://example.com' });
  
  // Check required fields
  assert.ok(result.content, 'Should have content field');
  assert.ok(Array.isArray(result.content), 'content should be an array');
  assert.strictEqual(result.content.length, 1, 'Should have one content item');
  
  // Check content item structure
  const contentItem = result.content[0];
  assert.strictEqual(contentItem.type, 'text', 'Content type should be text');
  assert.ok(contentItem.text, 'Should have text field');
  assert.ok(contentItem.text.includes('Successfully fetched'), 'Text should describe success');
  
  // Check isError flag
  assert.ok(result.hasOwnProperty('isError'), 'Should have isError field');
  assert.strictEqual(result.isError, false, 'isError should be false for success');
  
  // Check structuredContent
  assert.ok(result.structuredContent, 'Should have structuredContent field');
  assert.strictEqual(typeof result.structuredContent, 'object', 'structuredContent should be an object');
  assert.strictEqual(result.structuredContent.success, true, 'structuredContent.success should be true');
  assert.ok(result.structuredContent.html, 'structuredContent should have html');
  assert.ok(result.structuredContent.currentUrl, 'structuredContent should have currentUrl');
  assert.ok(Array.isArray(result.structuredContent.nextSteps), 'structuredContent should have nextSteps array');
  
  console.log(`   Text summary: ${contentItem.text}`);
  console.log(`   Structured data keys: ${Object.keys(result.structuredContent).join(', ')}`);
});

await test('click_element error should have MCP-compliant error structure', async () => {
  const result = await callMcpTool('click_element', { url: 'https://nonexistent-domain-12345.com', selector: '#test' });
  
  // Check required fields
  assert.ok(result.content, 'Should have content field');
  assert.ok(Array.isArray(result.content), 'content should be an array');
  
  // Check content item structure
  const contentItem = result.content[0];
  assert.strictEqual(contentItem.type, 'text', 'Content type should be text');
  assert.ok(contentItem.text.includes('Error:'), 'Text should indicate error');
  
  // Check isError flag
  assert.strictEqual(result.isError, true, 'isError should be true for errors');
  
  // Errors should NOT have structuredContent per MCP spec
  assert.strictEqual(result.structuredContent, undefined, 'Errors should not have structuredContent');
  
  console.log(`   Error text: ${contentItem.text}`);
});

await test('close_tab should return properly formatted response', async () => {
  const result = await callMcpTool('close_tab', { url: 'https://example.com' });
  
  // Check basic structure
  assert.ok(result.content, 'Should have content field');
  assert.ok(result.hasOwnProperty('isError'), 'Should have isError field');
  assert.ok(result.structuredContent, 'Should have structuredContent field');
  
  // Check content is human-readable
  const contentItem = result.content[0];
  assert.strictEqual(contentItem.type, 'text', 'Content type should be text');
  assert.ok(typeof contentItem.text === 'string', 'Text should be a string');
  assert.ok(contentItem.text.length > 0, 'Text should not be empty');
  
  // Structured content should match action result (no success field)
  assert.strictEqual(typeof result.structuredContent, 'object', 'structuredContent should be an object');
  assert.ok(result.structuredContent.message, 'structuredContent should have message field');
  assert.ok(result.structuredContent.hostname, 'structuredContent should have hostname field');
  
  console.log(`   Response: ${contentItem.text}`);
});

await test('Response should NOT have raw JSON.stringify in text field', async () => {
  const result = await callMcpTool('fetch_webpage', { url: 'https://example.com' });
  
  const contentItem = result.content[0];
  
  // Text should be human-readable, not stringified JSON
  assert.ok(!contentItem.text.startsWith('{'), 'Text should not start with {');
  assert.ok(!contentItem.text.includes('"success"'), 'Text should not contain JSON keys');
  assert.ok(!contentItem.text.includes('":'), 'Text should not contain JSON syntax');
  
  console.log(`   ✓ Text is human-readable: "${contentItem.text}"`);
});

await test('All fields should be properly typed', async () => {
  const result = await callMcpTool('fetch_webpage', { url: 'https://example.com' });
  
  // Type checks
  assert.strictEqual(typeof result.isError, 'boolean', 'isError should be boolean');
  assert.strictEqual(typeof result.content, 'object', 'content should be object (array)');
  assert.ok(Array.isArray(result.content), 'content should be an array');
  assert.strictEqual(typeof result.structuredContent, 'object', 'structuredContent should be object');
  assert.ok(!Array.isArray(result.structuredContent), 'structuredContent should not be an array');
  
  console.log(`   ✓ All types correct`);
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
if (testsFailed === 0) {
  console.log(`✅ All ${testsPassed} tests passed!`);
  console.log('MCP structured output format is correct ✓');
} else {
  console.log(`Tests passed: ${testsPassed}`);
  console.log(`Tests failed: ${testsFailed}`);
}
console.log('='.repeat(50) + '\n');

process.exit(testsFailed > 0 ? 1 : 0);
