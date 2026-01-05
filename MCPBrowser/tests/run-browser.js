#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get browser parameter from command line (e.g., "chrome", "edge")
const browserParam = process.argv[2] || '';

// Browser-based integration tests - REQUIRE BROWSER
const browserTests = [
  'actions/browser.click-element.test.js',
  'actions/browser.type-text.test.js',
  'actions/browser.close-tab.test.js',
  'actions/browser.get-current-html.test.js',
  'actions/browser.fetch-page.test.js'
];

const browserDisplay = browserParam ? browserParam.toUpperCase() : 'ALL BROWSERS';

console.log('🌐 Running Browser-Based Integration Tests');
console.log(`Mode: BROWSER REQUIRED - Tests run sequentially`);
console.log(`Browser: ${browserDisplay}`);
console.log(`Tests: ${browserTests.length} suites`);
console.log('='.repeat(60));

let totalPassed = 0;
let totalFailed = 0;

function runTest(testFile) {
  return new Promise((resolve) => {
    const args = [join(__dirname, testFile)];
    if (browserParam) {
      args.push(browserParam);
    }
    
    const child = spawn('node', args, {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      resolve({ testFile, code });
    });

    child.on('error', (err) => {
      console.error(`Error running ${testFile}:`, err.message);
      resolve({ testFile, code: 1 });
    });
  });
}

async function runBrowserTests() {
  const startTime = Date.now();
  
  console.log(`\n🚀 Running ${browserTests.length} browser tests sequentially...\n`);
  
  for (const test of browserTests) {
    console.log(`▶️  Running ${test}...`);
    console.log('-'.repeat(60));
    
    const { code } = await runTest(test);
    
    if (code === 0) {
      console.log(`✅ ${test} passed\n`);
      totalPassed++;
    } else {
      console.log(`❌ ${test} failed (exit code: ${code})\n`);
      totalFailed++;
    }
  }
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('='.repeat(60));
  console.log('\n📊 Browser Test Summary:');
  console.log(`   Total test suites: ${browserTests.length}`);
  console.log(`   Passed: ${totalPassed}`);
  console.log(`   Failed: ${totalFailed}`);
  console.log(`   Duration: ${duration}s`);
  console.log('\n' + '='.repeat(60));

  process.exit(totalFailed > 0 ? 1 : 0);
}

runBrowserTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
