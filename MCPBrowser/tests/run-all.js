#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Fast unit tests (no browser required or minimal browser interaction) - CAN RUN IN PARALLEL
const unitTests = [
  'core/browser.test.js',  // Unit test with mocks
  'core/html.test.js',     // Unit test
  'core/page.test.js'      // Unit test
];

// Slow integration tests (require browser) - RUN SEQUENTIALLY
const integrationTests = [
  'actions/click-element.test.js',
  'actions/type-text.test.js',
  'actions/close-tab.test.js',
  'actions/get-current-html.test.js',
  'actions/fetch-page.test.js',
  'core/auth.test.js',
  'mcp-browser.test.js'
];

console.log('🧪 Running MCPBrowser tests');
console.log(`Mode: ALL TESTS`);
console.log(`Parallelization: Unit tests run in parallel, integration tests sequential`);
console.log('='.repeat(60));

let totalPassed = 0;
let totalFailed = 0;

function runTest(testFile, showOutput = true) {
  return new Promise((resolve) => {
    const child = spawn('node', [join(__dirname, testFile)], {
      stdio: showOutput ? 'inherit' : 'pipe',
      shell: true
    });

    let output = '';
    if (!showOutput) {
      child.stdout?.on('data', (data) => output += data.toString());
      child.stderr?.on('data', (data) => output += data.toString());
    }

    child.on('close', (code) => {
      resolve({ testFile, code, output });
    });

    child.on('error', (err) => {
      resolve({ testFile, code: 1, output: err.message });
    });
  });
}

async function runTestsInParallel(tests) {
  console.log(`\n🚀 Running ${tests.length} tests in parallel...`);
  console.log('-'.repeat(60));
  
  const startTime = Date.now();
  const results = await Promise.all(tests.map(test => runTest(test, false)));
  const parallelDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  // Display results with more detail
  console.log(`\n⚡ Parallel execution completed in ${parallelDuration}s\n`);
  
  for (const { testFile, code, output } of results) {
    console.log(`▶️  ${testFile}`);
    
    if (output) {
      // Extract test count from output
      const passMatch = output.match(/Tests Passed: (\d+)|pass (\d+)/i);
      const failMatch = output.match(/Tests Failed: (\d+)|fail (\d+)/i);
      const passCount = passMatch ? (passMatch[1] || passMatch[2]) : '?';
      const failCount = failMatch ? (failMatch[1] || failMatch[2]) : '?';
      
      console.log(`   Tests: ${passCount} passed, ${failCount} failed`);
      
      // Show last few lines for errors
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
}

async function runTestsSequentially(tests) {
  for (const test of tests) {
    console.log(`\n▶️  Running ${test}...`);
    console.log('-'.repeat(60));
    
    const { code } = await runTest(test, true);
    
    if (code === 0) {
      console.log(`✅ ${test} passed`);
      totalPassed++;
    } else {
      console.log(`❌ ${test} failed (exit code: ${code})`);
      totalFailed++;
    }
  }
}

async function runAllTests() {
  const startTime = Date.now();
  
  // Run unit tests in parallel (fast, no browser conflicts)
  await runTestsInParallel(unitTests);
  
  // Run integration tests sequentially
  console.log('\n' + '='.repeat(60));
  console.log('Running integration tests sequentially...');
  await runTestsSequentially(integrationTests);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`   Total test suites: ${unitTests.length + integrationTests.length}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Duration: ${duration}s`);
  console.log('\n' + '='.repeat(60));

  process.exit(totalFailed > 0 ? 1 : 0);
}

runAllTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
