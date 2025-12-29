/**
 * Tests for close-tab action
 */

import { closeTab } from '../../src/actions/close-tab.js';
import { fetchPage } from '../../src/actions/fetch-page.js';
import { domainPages, getBrowser, closeBrowser } from '../../src/core/browser.js';

/**
 * Test: Close tab for a loaded domain
 */
async function testCloseLoadedTab() {
  console.log('\n=== Test: Close tab for a loaded domain ===');
  
  try {
    // First, load a page
    const fetchResult = await fetchPage({ 
      url: 'https://example.com',
      removeUnnecessaryHTML: false 
    });
    
    if (!fetchResult.success) {
      throw new Error(`Failed to load page: ${fetchResult.error}`);
    }
    
    console.log('✓ Page loaded successfully');
    
    // Verify tab is in the pool
    if (!domainPages.has('example.com')) {
      throw new Error('Domain not found in tab pool after loading');
    }
    console.log('✓ Tab exists in domain pool');
    
    // Close the tab
    const closeResult = await closeTab({ url: 'https://example.com' });
    
    if (!closeResult.success) {
      throw new Error(`Failed to close tab: ${closeResult.error}`);
    }
    
    console.log(`✓ Close result: ${closeResult.message}`);
    
    // Verify tab is removed from pool
    if (domainPages.has('example.com')) {
      throw new Error('Domain still in tab pool after closing');
    }
    console.log('✓ Tab removed from domain pool');
    
    console.log('✅ Test passed: Close loaded tab');
    return true;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test: Close tab for non-existent domain
 */
async function testCloseNonExistentTab() {
  console.log('\n=== Test: Close tab for non-existent domain ===');
  
  try {
    // Try to close a tab that doesn't exist
    const closeResult = await closeTab({ url: 'https://never-loaded-domain.com' });
    
    if (!closeResult.success) {
      throw new Error(`Close failed unexpectedly: ${closeResult.error}`);
    }
    
    if (!closeResult.alreadyClosed) {
      throw new Error('Expected alreadyClosed flag to be true');
    }
    
    console.log(`✓ Close result: ${closeResult.message}`);
    console.log('✅ Test passed: Close non-existent tab');
    return true;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test: Close same domain twice
 */
async function testCloseSameDomainTwice() {
  console.log('\n=== Test: Close same domain twice ===');
  
  try {
    // Load a page
    const fetchResult = await fetchPage({ 
      url: 'https://example.org',
      removeUnnecessaryHTML: false 
    });
    
    if (!fetchResult.success) {
      throw new Error(`Failed to load page: ${fetchResult.error}`);
    }
    
    console.log('✓ Page loaded successfully');
    
    // Close once
    const firstClose = await closeTab({ url: 'https://example.org/some/path' });
    
    if (!firstClose.success) {
      throw new Error(`First close failed: ${firstClose.error}`);
    }
    
    console.log(`✓ First close: ${firstClose.message}`);
    
    // Close again - should handle gracefully
    const secondClose = await closeTab({ url: 'https://example.org' });
    
    if (!secondClose.success) {
      throw new Error(`Second close failed: ${secondClose.error}`);
    }
    
    if (!secondClose.alreadyClosed) {
      throw new Error('Expected alreadyClosed flag to be true on second close');
    }
    
    console.log(`✓ Second close: ${secondClose.message}`);
    console.log('✅ Test passed: Close same domain twice');
    return true;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test: Invalid URL parameter
 */
async function testInvalidUrl() {
  console.log('\n=== Test: Invalid URL parameter ===');
  
  try {
    // Test with missing URL
    const result1 = await closeTab({});
    if (result1.success) {
      throw new Error('Expected failure for missing URL');
    }
    console.log('✓ Correctly rejected missing URL');
    
    // Test with null URL
    const result2 = await closeTab({ url: null });
    if (result2.success) {
      throw new Error('Expected failure for null URL');
    }
    console.log('✓ Correctly rejected null URL');
    
    // Test with empty string
    const result3 = await closeTab({ url: '' });
    if (result3.success) {
      throw new Error('Expected failure for empty URL');
    }
    console.log('✓ Correctly rejected empty URL');
    
    console.log('✅ Test passed: Invalid URL parameter');
    return true;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test: Hostname extraction from various URLs
 */
async function testDomainExtraction() {
  console.log('\n=== Test: Hostname extraction from various URLs ===');
  
  try {
    // Load page with path and query
    await fetchPage({ 
      url: 'https://www.example.net/path/to/page?query=value#hash',
      removeUnnecessaryHTML: false 
    });
    
    console.log('✓ Loaded page with complex URL');
    
    // Close using same hostname (must match exactly)
    const closeResult = await closeTab({ url: 'https://www.example.net' });
    
    if (!closeResult.success) {
      throw new Error(`Close failed: ${closeResult.error}`);
    }
    
    if (closeResult.hostname !== 'www.example.net') {
      throw new Error(`Expected hostname 'www.example.net', got '${closeResult.hostname}'`);
    }
    
    console.log(`✓ Correctly extracted hostname: ${closeResult.hostname}`);
    
    // Verify tab is closed
    if (domainPages.has('www.example.net')) {
      throw new Error('Tab still exists after close');
    }
    
    console.log('✅ Test passed: Hostname extraction');
    return true;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test: Fresh session after closing tab
 */
async function testFreshSessionAfterClose() {
  console.log('\n=== Test: Fresh session after closing tab ===');
  
  try {
    // Load page first time
    const firstLoad = await fetchPage({ 
      url: 'https://httpbin.org/html',
      removeUnnecessaryHTML: false 
    });
    
    if (!firstLoad.success) {
      throw new Error('First load failed');
    }
    
    console.log('✓ First load successful');
    
    // Get page reference
    const firstPage = domainPages.get('httpbin.org');
    
    // Close tab
    const closeResult = await closeTab({ url: 'https://httpbin.org' });
    
    if (!closeResult.success) {
      throw new Error('Close failed');
    }
    
    console.log('✓ Tab closed');
    
    // Load again - should create new page
    const secondLoad = await fetchPage({ 
      url: 'https://httpbin.org/html',
      removeUnnecessaryHTML: false 
    });
    
    if (!secondLoad.success) {
      throw new Error('Second load failed');
    }
    
    console.log('✓ Second load successful');
    
    // Get new page reference
    const secondPage = domainPages.get('httpbin.org');
    
    // Verify it's a different page instance
    if (firstPage === secondPage) {
      throw new Error('Expected different page instance after close');
    }
    
    console.log('✓ New page instance created (fresh session)');
    
    // Clean up
    await closeTab({ url: 'https://httpbin.org' });
    
    console.log('✅ Test passed: Fresh session after close');
    return true;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Test: Close tab after redirect using final URL
 */
async function testCloseAfterRedirect() {
  console.log('\n=== Test: Close tab after redirect using final URL ===');
  
  try {
    // Load a page that redirects (httpbin redirects)
    const fetchResult = await fetchPage({ 
      url: 'https://httpbin.org/redirect-to?url=https%3A%2F%2Fhttpbin.org%2Fhtml',
      removeUnnecessaryHTML: false 
    });
    
    if (!fetchResult.success) {
      throw new Error('Failed to load page');
    }
    
    const finalUrl = fetchResult.currentUrl;
    console.log(`✓ Page loaded: ${finalUrl}`);
    
    // Tab is stored under original hostname
    if (!domainPages.has('httpbin.org')) {
      throw new Error('Tab not found under original hostname');
    }
    
    console.log('✓ Tab stored under original hostname: httpbin.org');
    
    // Close using final URL (should still work via URL search)
    const closeResult = await closeTab({ url: finalUrl });
    
    if (!closeResult.success) {
      throw new Error(`Close failed: ${closeResult.error}`);
    }
    
    console.log(`✓ Closed tab using final URL: ${fetchResult.currentUrl}`);
    
    // Verify tab is removed
    if (domainPages.has('httpbin.org')) {
      throw new Error('Tab still exists after close');
    }
    
    console.log('✓ Tab removed from pool');
    console.log('✅ Test passed: Close after redirect using final URL');
    return true;
    
  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
    return false;
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('Starting close-tab.test.js...\n');
  
  const results = [];
  
  results.push(await testCloseLoadedTab());
  results.push(await testCloseNonExistentTab());
  results.push(await testCloseSameDomainTwice());
  results.push(await testInvalidUrl());
  results.push(await testDomainExtraction());
  results.push(await testFreshSessionAfterClose());
  results.push(await testCloseAfterRedirect());
  
  const passed = results.filter(r => r).length;
  const total = results.length;
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Tests completed: ${passed}/${total} passed`);
  console.log(`${'='.repeat(50)}`);
  
  // Clean up browser
  await closeBrowser();
  
  if (passed === total) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
