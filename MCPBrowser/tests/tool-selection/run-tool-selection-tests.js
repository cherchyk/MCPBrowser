#!/usr/bin/env node
/**
 * Standalone runner for tool selection tests
 * Tests different tool description versions and reports which performs best
 * 
 * Usage:
 *   node tests/tool-selection/run-tool-selection-tests.js
 *   npm run test:descriptions
 */

import { runTests } from './tool-selection.test.js';

console.log(`
╔═══════════════════════════════════════════════════════════════════════╗
║                  TOOL DESCRIPTION TESTING                             ║
║  Automated testing of AI tool selection with different descriptions   ║
╚═══════════════════════════════════════════════════════════════════════╝
`);

runTests()
  .then(report => {
    console.log('\n' + '═'.repeat(80));
    console.log('SUMMARY');
    console.log('═'.repeat(80));
    console.log(`Best Version: ${report.bestVersion}`);
    console.log(`Best Score: ${report.bestScore}%`);
    console.log(`Pass Threshold: ${85}%`);
    console.log(`Status: ${report.bestScore >= 85 ? '✅ PASS' : '❌ FAIL'}`);
    console.log('═'.repeat(80));
    
    if (report.bestScore < 85) {
      console.log('\n⚠️  WARNING: Best version did not meet passing threshold');
      console.log('Review failed scenarios and update tool descriptions');
      process.exit(1);
    } else {
      console.log('\n✅ All versions tested successfully');
      process.exit(0);
    }
  })
  .catch(err => {
    console.error('\n❌ Testing failed with error:');
    console.error(err);
    process.exit(1);
  });
