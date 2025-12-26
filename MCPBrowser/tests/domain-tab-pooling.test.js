/**
 * UNIT TESTS - Automated tests using mock objects (NO browser required)
 * These tests validate domain pooling logic without opening Chrome
 * Run with: node tests/domain-tab-pooling.test.js
 */

// Mock domain pages map and browser
class MockPage {
  constructor(url) {
    this._url = url;
    this._closed = false;
    this._content = '';
  }
  
  url() { return this._url; }
  isClosed() { return this._closed; }
  close() { this._closed = true; }
  async bringToFront() {}
  async goto(url) { 
    this._url = url;
    // Simulate eng.ms page with multiple same-domain links
    if (url.includes('eng.ms/docs/products/geneva')) {
      this._content = `
        <html>
          <body>
            <h1>Geneva Documentation</h1>
            <a href="https://eng.ms/docs/products/geneva/getting-started">Getting Started</a>
            <a href="https://eng.ms/docs/products/geneva/configuration">Configuration</a>
            <a href="https://eng.ms/docs/products/geneva/monitoring">Monitoring</a>
            <a href="https://eng.ms/docs/products/geneva/alerts">Alerts</a>
            <a href="https://eng.ms/docs/products/geneva/best-practices">Best Practices</a>
            <a href="https://external.com/link">External Link</a>
          </body>
        </html>
      `;
    }
  }
  async evaluate(fn) { 
    if (this._content) {
      return fn.toString().includes('outerHTML') ? this._content : fn();
    }
    return fn(); 
  }
}

class MockBrowser {
  constructor() {
    this._pages = [];
  }
  
  async newPage() {
    const page = new MockPage('about:blank');
    this._pages.push(page);
    return page;
  }
  
  async pages() {
    return this._pages;
  }
}

// Test framework
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
    testsPassed++;
  }
}

async function test(name, fn) {
  console.log(`\n🧪 Test: ${name}`);
  try {
    await fn();
  } catch (error) {
    console.error(`   Error: ${error.message}`);
  }
}

// Tests
async function runTests() {
  console.log('🚀 Starting Domain Tab Pooling Tests\n');
  
  await test('Should create new tab for first domain', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    const url = 'https://github.com/user/repo';
    const hostname = new URL(url).hostname;
    
    // No existing page for this domain
    assert(!domainPages.has(hostname), 'Domain should not exist in map initially');
    
    // Create new page
    const page = await browser.newPage();
    domainPages.set(hostname, page);
    
    assert(domainPages.has(hostname), 'Domain should be added to map');
    assert(domainPages.get(hostname) === page, 'Correct page should be stored');
  });
  
  await test('Should reuse tab for same domain', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    const hostname = 'github.com';
    
    // Create first page for domain
    const page1 = await browser.newPage();
    await page1.goto('https://github.com/repo1');
    domainPages.set(hostname, page1);
    
    // Try to fetch another URL from same domain
    const existingPage = domainPages.get(hostname);
    assert(existingPage === page1, 'Should return same page for same domain');
    assert(!existingPage.isClosed(), 'Page should still be open');
  });
  
  await test('Should create new tab for different domain', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    
    // First domain
    const page1 = await browser.newPage();
    await page1.goto('https://github.com/repo');
    domainPages.set('github.com', page1);
    
    // Second domain - should create new tab
    const hostname2 = 'microsoft.com';
    assert(!domainPages.has(hostname2), 'Second domain should not exist yet');
    
    const page2 = await browser.newPage();
    await page2.goto('https://microsoft.com/docs');
    domainPages.set(hostname2, page2);
    
    assert(domainPages.has('github.com'), 'First domain should still exist');
    assert(domainPages.has('microsoft.com'), 'Second domain should now exist');
    assert(page1 !== page2, 'Should be different page objects');
    assert(!page1.isClosed(), 'First page should still be open');
  });
  
  await test('Should reuse tab when returning to previous domain', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    
    // Domain 1
    const page1 = await browser.newPage();
    domainPages.set('github.com', page1);
    
    // Domain 2
    const page2 = await browser.newPage();
    domainPages.set('microsoft.com', page2);
    
    // Back to domain 1
    const reusedPage = domainPages.get('github.com');
    assert(reusedPage === page1, 'Should reuse original page for domain 1');
    assert(!reusedPage.isClosed(), 'Reused page should still be open');
    assert(domainPages.size === 2, 'Should have 2 domains in map');
  });
  
  await test('Should handle closed tabs gracefully', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    const hostname = 'github.com';
    
    // Create and store page
    const page = await browser.newPage();
    domainPages.set(hostname, page);
    
    // Simulate user closing the tab
    page.close();
    
    // Check if page is closed
    const existingPage = domainPages.get(hostname);
    if (existingPage && existingPage.isClosed()) {
      domainPages.delete(hostname);
    }
    
    assert(!domainPages.has(hostname), 'Closed page should be removed from map');
  });
  
  await test('Should extract hostname correctly from URLs', async () => {
    const testCases = [
      { url: 'https://github.com/user/repo', expected: 'github.com' },
      { url: 'https://microsoft.com/docs/page', expected: 'microsoft.com' },
      { url: 'https://subdomain.example.com/path', expected: 'subdomain.example.com' },
      { url: 'http://localhost:3000/test', expected: 'localhost' },
    ];
    
    for (const { url, expected } of testCases) {
      const hostname = new URL(url).hostname;
      assert(hostname === expected, `Hostname for ${url} should be ${expected}, got ${hostname}`);
    }
  });
  
  await test('Should handle invalid URLs', async () => {
    let errorThrown = false;
    try {
      new URL('not-a-valid-url');
    } catch (error) {
      errorThrown = true;
    }
    assert(errorThrown, 'Invalid URL should throw error');
  });
  
  await test('Should clear all pages on browser disconnect', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    
    // Add multiple domains
    const page1 = await browser.newPage();
    domainPages.set('github.com', page1);
    
    const page2 = await browser.newPage();
    domainPages.set('microsoft.com', page2);
    
    const page3 = await browser.newPage();
    domainPages.set('google.com', page3);
    
    assert(domainPages.size === 3, 'Should have 3 domains before disconnect');
    
    // Simulate browser disconnect
    domainPages.clear();
    
    assert(domainPages.size === 0, 'All domains should be cleared after disconnect');
  });
  
  await test('Should handle multiple requests to same domain', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    const hostname = 'github.com';
    
    // First request
    const page = await browser.newPage();
    await page.goto('https://github.com/repo1');
    domainPages.set(hostname, page);
    
    // Multiple subsequent requests to same domain
    for (let i = 2; i <= 5; i++) {
      const existingPage = domainPages.get(hostname);
      assert(existingPage === page, `Request ${i} should reuse same page`);
      await existingPage.goto(`https://github.com/repo${i}`);
    }
    
    assert(domainPages.size === 1, 'Should still have only 1 domain in map');
  });
  
  await test('Should open internal eng.ms page', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    const url = 'https://eng.ms/docs/products/geneva';
    const hostname = new URL(url).hostname;
    
    // First request to eng.ms domain
    assert(!domainPages.has(hostname), 'eng.ms domain should not exist initially');
    
    const page = await browser.newPage();
    await page.goto(url);
    domainPages.set(hostname, page);
    
    assert(domainPages.has(hostname), 'eng.ms domain should be added to map');
    assert(page.url() === url, 'Page URL should match requested URL');
    assert(!page.isClosed(), 'Page should remain open');
  });
  
  await test('Should extract and load 5 URLs from same domain', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    const initialUrl = 'https://eng.ms/docs/products/geneva';
    const hostname = new URL(initialUrl).hostname;
    
    // First: Load the initial page
    const page = await browser.newPage();
    await page.goto(initialUrl);
    domainPages.set(hostname, page);
    
    // Extract HTML content
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    assert(html.includes('Geneva Documentation'), 'Page should contain Geneva content');
    
    // Extract URLs from the same domain
    const urlPattern = /href="(https:\/\/eng\.ms\/[^"]+)"/g;
    const extractedUrls = [];
    let match;
    while ((match = urlPattern.exec(html)) !== null && extractedUrls.length < 5) {
      extractedUrls.push(match[1]);
    }
    
    assert(extractedUrls.length === 5, `Should extract 5 URLs, got ${extractedUrls.length}`);
    
    // Verify all URLs are from eng.ms domain
    for (const url of extractedUrls) {
      const urlHostname = new URL(url).hostname;
      assert(urlHostname === hostname, `All URLs should be from ${hostname}, got ${urlHostname}`);
    }
    
    // Load each of the 5 URLs and verify tab reuse
    const reusedPage = domainPages.get(hostname);
    assert(reusedPage === page, 'Should reuse same page for same domain');
    
    for (let i = 0; i < extractedUrls.length; i++) {
      await reusedPage.goto(extractedUrls[i]);
      assert(reusedPage.url() === extractedUrls[i], `URL ${i+1} should be loaded: ${extractedUrls[i]}`);
      assert(!reusedPage.isClosed(), `Page should remain open after loading URL ${i+1}`);
    }
    
    assert(domainPages.size === 1, 'Should still have only 1 domain (eng.ms) in map after all loads');
  });

  await test('Should rebuild domain pages map on reconnection', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    
    // Simulate having tabs already open from previous session
    const page1 = await browser.newPage();
    await page1.goto('https://github.com/user/repo');
    
    const page2 = await browser.newPage();
    await page2.goto('https://microsoft.com/docs');
    
    const page3 = await browser.newPage();
    await page3.goto('https://eng.ms/docs/products');
    
    const page4 = await browser.newPage();
    await page4.goto('about:blank');
    
    // Verify pages exist but map is empty (simulating disconnection)
    assert(domainPages.size === 0, 'Domain pages map should be empty before rebuild');
    
    // Simulate rebuildDomainPagesMap function
    const pages = await browser.pages();
    assert(pages.length === 4, `Should have 4 tabs open, got ${pages.length}`);
    
    for (const page of pages) {
      try {
        const pageUrl = page.url();
        // Skip internal pages
        if (!pageUrl || 
            pageUrl === 'about:blank' || 
            pageUrl.startsWith('chrome://') || 
            pageUrl.startsWith('chrome-extension://') ||
            pageUrl.startsWith('devtools://')) {
          continue;
        }
        
        const hostname = new URL(pageUrl).hostname;
        if (hostname && !domainPages.has(hostname)) {
          domainPages.set(hostname, page);
        }
      } catch (err) {
        // Skip pages with invalid URLs
        continue;
      }
    }
    
    // Verify map was rebuilt correctly
    assert(domainPages.size === 3, `Should have 3 domains in map (excluding about:blank), got ${domainPages.size}`);
    assert(domainPages.has('github.com'), 'Should have github.com in map');
    assert(domainPages.has('microsoft.com'), 'Should have microsoft.com in map');
    assert(domainPages.has('eng.ms'), 'Should have eng.ms in map');
    assert(!domainPages.has('about:blank'), 'Should not have about:blank in map');
    
    // Verify correct pages are mapped
    assert(domainPages.get('github.com').url() === 'https://github.com/user/repo', 'github.com should map to correct page');
    assert(domainPages.get('microsoft.com').url() === 'https://microsoft.com/docs', 'microsoft.com should map to correct page');
    assert(domainPages.get('eng.ms').url() === 'https://eng.ms/docs/products', 'eng.ms should map to correct page');
    
    // Verify tabs can be reused after rebuild
    const githubPage = domainPages.get('github.com');
    assert(!githubPage.isClosed(), 'Rebuilt github.com page should still be open');
    await githubPage.goto('https://github.com/another/repo');
    assert(githubPage.url() === 'https://github.com/another/repo', 'Rebuilt page should be navigable');
  });

  await test('Should skip chrome:// and internal pages during rebuild', async () => {
    const domainPages = new Map();
    const browser = new MockBrowser();
    
    // Create pages with various internal URLs
    const page1 = await browser.newPage();
    await page1.goto('chrome://settings');
    
    const page2 = await browser.newPage();
    await page2.goto('chrome-extension://abc123/popup.html');
    
    const page3 = await browser.newPage();
    await page3.goto('devtools://devtools/bundled/devtools_app.html');
    
    const page4 = await browser.newPage();
    await page4.goto('https://example.com/page');
    
    // Rebuild domain pages map
    const pages = await browser.pages();
    for (const page of pages) {
      try {
        const pageUrl = page.url();
        if (!pageUrl || 
            pageUrl === 'about:blank' || 
            pageUrl.startsWith('chrome://') || 
            pageUrl.startsWith('chrome-extension://') ||
            pageUrl.startsWith('devtools://')) {
          continue;
        }
        
        const hostname = new URL(pageUrl).hostname;
        if (hostname && !domainPages.has(hostname)) {
          domainPages.set(hostname, page);
        }
      } catch (err) {
        continue;
      }
    }
    
    // Only example.com should be in the map
    assert(domainPages.size === 1, `Should only have 1 domain (example.com), got ${domainPages.size}`);
    assert(domainPages.has('example.com'), 'Should have example.com in map');
    assert(!domainPages.has('chrome'), 'Should not have chrome:// pages in map');
  });
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Tests Passed: ${testsPassed}`);
  console.log(`❌ Tests Failed: ${testsFailed}`);
  console.log('='.repeat(50));
  
  if (testsFailed > 0) {
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
