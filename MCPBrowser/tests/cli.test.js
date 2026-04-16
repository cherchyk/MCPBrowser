import assert from 'assert';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = join(__dirname, '..', 'src', 'mcp-browser.js');

console.log('🧪 Testing CLI Interface\n');

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
 * Run mcpbrowser CLI with args and capture stdout/stderr/exitCode.
 */
function runCli(args, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [serverPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    const timeout = setTimeout(() => {
      proc.kill();
      reject(new Error(`CLI timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      resolve({ stdout, stderr, exitCode: code });
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    // Close stdin so CLI commands don't hang
    proc.stdin.end();
  });
}

// ============================================================================
// CLI Argument Parsing Tests
// ============================================================================

console.log('📋 Testing CLI argument parsing and routing\n');

await test('--help should print usage and exit 0', async () => {
  const { stdout, exitCode } = await runCli(['--help']);
  assert.strictEqual(exitCode, 0, `Expected exit code 0, got ${exitCode}`);
  assert.ok(stdout.includes('MCPBrowser'), 'Should include MCPBrowser name');
  assert.ok(stdout.includes('USAGE'), 'Should include USAGE section');
  assert.ok(stdout.includes('fetch'), 'Should mention fetch command');
  assert.ok(stdout.includes('screenshot'), 'Should mention screenshot command');
});

await test('-h should also print help', async () => {
  const { stdout, exitCode } = await runCli(['-h']);
  assert.strictEqual(exitCode, 0);
  assert.ok(stdout.includes('USAGE'));
});

await test('--version should print version and exit 0', async () => {
  const { stdout, exitCode } = await runCli(['--version']);
  assert.strictEqual(exitCode, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/, 'Should be a semver version');
});

await test('-v should also print version', async () => {
  const { stdout, exitCode } = await runCli(['-v']);
  assert.strictEqual(exitCode, 0);
  assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/);
});

await test('Unknown command should exit 1 with error', async () => {
  const { stderr, exitCode } = await runCli(['badcommand']);
  assert.strictEqual(exitCode, 1);
  assert.ok(stderr.includes('Unknown command'), 'Should show unknown command error');
});

await test('fetch without URL should exit 1 with error', async () => {
  const { stderr, exitCode } = await runCli(['fetch']);
  assert.strictEqual(exitCode, 1);
  assert.ok(stderr.includes('required'), 'Should mention URL is required');
});

await test('click without --selector or --text should exit 1', async () => {
  const { stderr, exitCode } = await runCli(['click', 'https://example.com'], 10000);
  assert.strictEqual(exitCode, 1);
  assert.ok(stderr.includes('--selector') || stderr.includes('required'));
});

await test('type without --selector should exit 1', async () => {
  const { stderr, exitCode } = await runCli(['type', 'https://example.com'], 10000);
  assert.strictEqual(exitCode, 1);
  assert.ok(stderr.includes('--selector') || stderr.includes('required'));
});

await test('exec without --script should exit 1', async () => {
  const { stderr, exitCode } = await runCli(['exec', 'https://example.com'], 10000);
  assert.strictEqual(exitCode, 1);
  assert.ok(stderr.includes('--script') || stderr.includes('required'));
});

// ============================================================================
// MCP Server Mode Backward Compatibility
// ============================================================================

console.log('\n📋 Testing MCP server mode is still working\n');

await test('No args should start MCP server (responds to initialize)', async () => {
  const proc = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
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
        reject(new Error('MCP server did not respond within 5 seconds'));
      }, 5000);

      let buffer = '';
      proc.stdout.on('data', (data) => {
        buffer += data.toString();
        for (const line of buffer.split('\n')) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.id === 1) {
                clearTimeout(timeout);
                resolve(parsed);
                return;
              }
            } catch { /* not JSON */ }
          }
        }
      });

      proc.on('error', (err) => { clearTimeout(timeout); reject(err); });
      proc.stdin.write(JSON.stringify(initRequest) + '\n');
    });

    assert.ok(response.result, 'Should get MCP initialize result');
    assert.strictEqual(response.result.serverInfo.name, 'MCP Browser');
  } finally {
    proc.kill();
  }
});

// ============================================================================
// Test Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('='.repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
