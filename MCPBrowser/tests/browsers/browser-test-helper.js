/**
 * Browser test helper utilities
 * Provides functions to run tests across all available browsers
 */

import { ChromeBrowser } from '../../src/browsers/chrome.js';
import { EdgeBrowser } from '../../src/browsers/edge.js';

/**
 * Get all supported browsers and check their availability
 * @returns {Promise<Array<{type: string, browser: BaseBrowser, available: boolean}>>}
 */
export async function getAllBrowsers() {
  const browsers = [
    { type: 'chrome', browser: new ChromeBrowser() },
    { type: 'edge', browser: new EdgeBrowser() }
  ];

  const results = [];
  for (const { type, browser } of browsers) {
    const available = await browser.isAvailable();
    results.push({ type, browser, available });
  }

  return results;
}

/**
 * Get only available browsers
 * @returns {Promise<Array<{type: string, browser: BaseBrowser}>>}
 */
export async function getAvailableBrowsers() {
  const all = await getAllBrowsers();
  const available = all.filter(b => b.available);
  
  // Show warnings for unavailable browsers
  const unavailable = all.filter(b => !b.available);
  for (const { type } of unavailable) {
    console.error(`⚠️  [WARNING] ${type} browser not detected - tests will be skipped`);
  }
  
  if (available.length === 0) {
    console.error('⚠️  [WARNING] No browsers detected - using Chrome as fallback (tests may fail)');
    return [{ type: 'chrome', browser: new ChromeBrowser() }];
  }
  
  return available.map(({ type, browser }) => ({ type, browser }));
}

/**
 * Run a test function for each available browser
 * @param {string} testName - Name of the test
 * @param {Function} testFn - Test function that receives (browserType, browser)
 */
export async function forEachBrowser(testName, testFn) {
  const browsers = await getAvailableBrowsers();
  
  for (const { type, browser } of browsers) {
    console.error(`\n🌐 Running ${testName} with ${type}...`);
    try {
      await testFn(type, browser);
    } catch (error) {
      console.error(`❌ ${testName} failed with ${type}: ${error.message}`);
      throw error;
    }
  }
}

/**
 * Check if a specific browser is available
 * @param {string} browserType - Browser type (chrome, edge)
 * @returns {Promise<boolean>}
 */
export async function isBrowserAvailable(browserType) {
  const all = await getAllBrowsers();
  const found = all.find(b => b.type === browserType);
  return found ? found.available : false;
}
