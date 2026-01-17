#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pure unit tests - NO BROWSER REQUIRED (perfect for CI/CD)
const unitTests = [
  'core/browser.test.js',     // Browser management with mocks
  'core/html.test.js',        // HTML processing (pure functions)
  'core/page.test.js',        // Page operations with mocks
  'core/responses.test.js',   // Response class validation
  'core/auth.test.js',        // Auth flows with mock pages
  'mcp-browser.test.js'       // MCP server initialization
  // Excluded from CI: verify-structured-output.test.js, verify-nextsteps.test.js (require browser)
];

console.log('🧪 Running Unit Tests (No Browser Required)');
console.log(`Mode: CI-SAFE - Perfect for GitHub Actions`);
console.log(`Tests: ${unitTests.length} suites running in parallel`);
console.log('='.repeat(60));

let totalPassed = 0;
let totalFailed = 0;

function runTest(testFile) {
  return new Promise((resolve) => {
    const child = spawn('node', [join(__dirname, testFile)], {
      stdio: 'pipe',
      shell: true
    });

    let output = '';
    child.stdout?.on('data', (data) => output += data.toString());
    child.stderr?.on('data', (data) => output += data.toString());

    child.on('close', (code) => {
      resolve({ testFile, code, output });
    });

    child.on('error', (err) => {
      resolve({ testFile, code: 1, output: err.message });
    });
  });
}

async function runUnitTests() {
  const startTime = Date.now();
  
  console.log(`\n🚀 Running ${unitTests.length} tests in parallel...`);
  console.log('-'.repeat(60));
  
  const results = await Promise.all(unitTests.map(test => runTest(test)));
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n⚡ Parallel execution completed in ${duration}s\n`);
  
  for (const { testFile, code, output } of results) {
    console.log(`▶️  ${testFile}`);
    
    if (output) {
      const passMatch = output.match(/Tests Passed: (\d+)|pass (\d+)/i);
      const failMatch = output.match(/Tests Failed: (\d+)|fail (\d+)/i);
      const passCount = passMatch ? (passMatch[1] || passMatch[2]) : '?';
      const failCount = failMatch ? (failMatch[1] || failMatch[2]) : '?';
      
      console.log(`   Tests: ${passCount} passed, ${failCount} failed`);
      
      if (code !== 0) {
        const lines = output.trim().split('\n');
        const errorLines = lines.slice(-10);
        console.log(errorLines.join('\n'));
      }
    }
    
    if (code === 0) {
      console.log(`   ✅ PASSED`);
      totalPassed++;
    } else {
      console.log(`   ❌ FAILED (exit code: ${code})`);
      totalFailed++;
    }
    console.log();
  }
  
  console.log('='.repeat(60));
  console.log('\n📊 Unit Test Summary:');
  console.log(`   Total test suites: ${unitTests.length}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Duration: ${duration}s`);
  console.log('\n' + '='.repeat(60));

  process.exit(totalFailed > 0 ? 1 : 0);
}

runUnitTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
