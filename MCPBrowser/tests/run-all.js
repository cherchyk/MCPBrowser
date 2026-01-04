#!/usr/bin/env node
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🧪 Running All MCPBrowser Tests');
console.log('='.repeat(60));

let totalPassed = 0;
let totalFailed = 0;

function runRunner(runnerFile, description) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`${description}`);
    console.log('='.repeat(60));
    
    const child = spawn('node', [join(__dirname, runnerFile)], {
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        totalPassed++;
      } else {
        totalFailed++;
      }
      resolve(code);
    });

    child.on('error', (err) => {
      console.error(`Error running ${runnerFile}:`, err.message);
      totalFailed++;
      resolve(1);
    });
  });
}

async function runAllTests() {
  const startTime = Date.now();
  
  // Run unit tests (fast, parallel, no browser)
  const unitCode = await runRunner('run-unit.js', '🚀 UNIT TESTS (No Browser Required)');
  
  // Run browser tests (sequential, requires browser)
  const browserCode = await runRunner('run-browser.js', '🌐 BROWSER TESTS (Integration)');
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 OVERALL TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`   Unit Tests: ${unitCode === 0 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Browser Tests: ${browserCode === 0 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`   Total Duration: ${duration}s`);
  console.log('='.repeat(60));

  process.exit((unitCode === 0 && browserCode === 0) ? 0 : 1);
}

runAllTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
