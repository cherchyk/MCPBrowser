#!/usr/bin/env node
import { spawn } from 'child_process';

const mcpProcess = spawn('node', ['src/mcp-browser.js'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'inherit']
});

// Send initialize request
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

console.log('Sending initialize request...');
mcpProcess.stdin.write(JSON.stringify(initRequest) + '\n');

// Send list tools request
const listToolsRequest = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/list',
  params: {}
};

setTimeout(() => {
  console.log('Sending tools/list request...');
  mcpProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 1000);

let responseBuffer = '';
mcpProcess.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop() || '';
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('Response:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Raw output:', line);
      }
    }
  });
});

mcpProcess.on('error', (err) => {
  console.error('Error:', err);
});

setTimeout(() => {
  console.log('Closing...');
  mcpProcess.kill();
  process.exit(0);
}, 3000);
