#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pure unit tests - NO BROWSER REQUIRED (perfect for CI/CD)
const parallelTests = [
  'core/browser.test.js',               // Browser management with mocks
  'core/html.test.js',                  // HTML processing (pure functions)
  'core/markdown.test.js',              // Text/Markdown content conversion (pure functions)
  'core/page.test.js',                  // Page operations with mocks
  'core/responses.test.js',             // Response class validation
  'core/informational-response.test.js', // InformationalResponse (soft failures)
  'core/http-status-response.test.js',  // HttpStatusResponse (HTTP 4xx/5xx)
  'core/output-schema-validation.test.js', // outputSchema vs structuredContent compliance
  'core/auth.test.js',                  // Auth flows with mock pages
  'validate-schema-compatibility.test.js' // MCP tool schema cross-client compatibility
  // Browser tests: see run-browser.js
];
const serialTests = [
  'mcp-browser.test.js',                // MCP server initialization
  'cli.test.js'                         // CLI argument parsing and routing
];
const unitTests = [...parallelTests, ...serialTests];

console.log('🧪 Running Unit Tests (No Browser Required)');
console.log(`Mode: CI-SAFE - Perfect for GitHub Actions`);
console.log(
  `Tests: ${parallelTests.length} suites in parallel, then ${serialTests.length} process suites serially`
);
console.log('='.repeat(60));

let totalPassed = 0;
let totalFailed = 0;

function runTest(testFile) {
  return new Promise((resolve) => {
    const child = spawn('node', [join(__dirname, testFile)], {
      stdio: 'pipe'
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
  
  console.log(`\n🚀 Running ${parallelTests.length} tests in parallel...`);
  console.log('-'.repeat(60));
  
  const parallelResults = await Promise.all(parallelTests.map(test => runTest(test)));
  
  console.log('\n🔄 Running process-spawning suites serially...\n');
  const serialResults = [];
  for (const test of serialTests) {
    serialResults.push(await runTest(test));
  }

  const results = [...parallelResults, ...serialResults];
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(`\n⚡ Test execution completed in ${duration}s\n`);
  
  for (const { testFile, code, output } of results) {
    console.log(`▶️  ${testFile}`);
    
    if (output) {
      const passMatch = output.match(/Tests Passed: (\d+)|pass(?:ed)? (\d+)|(\d+) passed/i);
      const failMatch = output.match(/Tests Failed: (\d+)|fail(?:ed)? (\d+)|(\d+) failed/i);
      const passCount = passMatch ? (passMatch[1] || passMatch[2] || passMatch[3]) : '?';
      const failCount = failMatch ? (failMatch[1] || failMatch[2] || failMatch[3]) : '?';
      
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
