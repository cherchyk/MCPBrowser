/**
 * Browser test runner utility
 * Provides a clean API to run tests across multiple browsers
 */

import { getAvailableBrowsers } from './browser-test-helper.js';
import { getBrowser, closeBrowser } from '../../src/mcp-browser.js';

/**
 * Run test function across browsers
 * @param {Function} testFn - Test function to run, receives browserType as parameter
 * @param {string} [browser=''] - Specific browser to test (empty = all browsers)
 * @returns {Promise<void>}
 */
export async function runWithBrowsers(testFn, browser = '') {
  const browsers = browser 
    ? [{ type: browser, available: true }] 
    : await getAvailableBrowsers();

  for (const { type: browserType } of browsers) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`Testing with ${browserType.toUpperCase()}`);
    console.log(`${'='.repeat(50)}`);
    
    // Try to connect to browser, skip if connection fails
    try {
      await getBrowser(browserType);
    } catch (err) {
      console.error(`⚠️  [WARNING] Failed to connect to ${browserType}: ${err.message}`);
      console.error(`⚠️  [WARNING] Skipping ${browserType} tests`);
      continue;
    }
    
    // Run the test function with browserType
    try {
      await testFn(browserType);
    } finally {
      // Clean up after each browser
      await closeBrowser();
    }
  }
}
