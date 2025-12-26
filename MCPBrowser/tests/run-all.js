#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = [
  'redirect-detection.test.js',
  'auth-flow.test.js',
  'prepare-html.test.js'
];

console.log('🧪 Running all MCPBrowser tests\n');
console.log('='.repeat(60));

let totalPassed = 0;
let totalFailed = 0;
let completedTests = 0;

function runTest(testFile) {
  return new Promise((resolve) => {
    console.log(`\n▶️  Running ${testFile}...`);
    console.log('-'.repeat(60));
    
    const child = spawn('node', [join(__dirname, testFile)], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      completedTests++;
      if (code === 0) {
        console.log(`✅ ${testFile} passed`);
      } else {
        console.log(`❌ ${testFile} failed (exit code: ${code})`);
        totalFailed++;
      }
      resolve(code);
    });

    child.on('error', (err) => {
      console.error(`❌ Failed to run ${testFile}:`, err);
      totalFailed++;
      completedTests++;
      resolve(1);
    });
  });
}

async function runAllTests() {
  for (const test of tests) {
    const exitCode = await runTest(test);
    if (exitCode !== 0) {
      totalFailed++;
    } else {
      totalPassed++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Test Summary:');
  console.log(`   Total test suites: ${tests.length}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log('\n' + '='.repeat(60));

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Error running tests:', err);
  process.exit(1);
});
