import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('MCP Server', () => {
  it('should start and respond to initialize request', async () => {
    const mcpProcess = spawn('node', [join(__dirname, '..', 'src', 'mcp-browser.js')], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    try {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        }
      };

      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server did not respond to initialize request within 5 seconds'));
        }, 5000);

        let buffer = '';
        mcpProcess.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.id === 1) {
                  clearTimeout(timeout);
                  resolve(parsed);
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

        mcpProcess.on('exit', (code) => {
          clearTimeout(timeout);
          reject(new Error(`Server exited with code ${code} before responding`));
        });

        mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');
      });

      assert.ok(response.result, 'Initialize response should have result');
      assert.equal(response.result.protocolVersion, '2024-11-05', 'Protocol version should match');
      assert.ok(response.result.serverInfo, 'Server info should be present');
      assert.equal(response.result.serverInfo.name, 'MCPBrowser', 'Server name should be MCPBrowser');
    } finally {
      mcpProcess.kill();
    }
  });

  it('should respond to tools/list request', async () => {
    const mcpProcess = spawn('node', [join(__dirname, '..', 'src', 'mcp-browser.js')], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    try {
      // First initialize
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        }
      };

      mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');

      // Wait a bit for initialization
      await new Promise(resolve => setTimeout(resolve, 500));

      // Then request tools list
      const toolsRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      };

      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server did not respond to tools/list request within 5 seconds'));
        }, 5000);

        let buffer = '';
        mcpProcess.stdout.on('data', (data) => {
          buffer += data.toString();
          const lines = buffer.split('\n');
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const parsed = JSON.parse(line);
                if (parsed.id === 2) {
                  clearTimeout(timeout);
                  resolve(parsed);
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

        mcpProcess.stdin.write(JSON.stringify(toolsRequest) + '\n');
      });

      assert.ok(response.result, 'Tools/list response should have result');
      assert.ok(response.result.tools, 'Result should have tools array');
      assert.ok(Array.isArray(response.result.tools), 'Tools should be an array');
      assert.ok(response.result.tools.length > 0, 'Should have at least one tool');
      
      const fetchTool = response.result.tools.find(t => t.name === 'fetch_webpage');
      assert.ok(fetchTool, 'Should have fetch_webpage tool');
      assert.ok(fetchTool.description, 'Tool should have description');
      assert.ok(fetchTool.inputSchema, 'Tool should have input schema');
    } finally {
      mcpProcess.kill();
    }
  });
});
