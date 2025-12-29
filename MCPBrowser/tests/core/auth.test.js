import assert from 'assert';
import { waitForAutoAuth, waitForManualAuth } from '../../src/mcp-browser.js';

console.log('🧪 Testing authentication flow functions\n');

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  return new Promise((resolve) => {
    fn()
      .then(() => {
        console.log(`✅ ${description}`);
        testsPassed++;
        resolve();
      })
      .catch((err) => {
        console.log(`❌ ${description}`);
        console.log(`   Error: ${err.message}`);
        testsFailed++;
        resolve();
      });
  });
}

// Mock page object for testing
class MockPage {
  constructor(urlsOrConfig) {
    if (Array.isArray(urlsOrConfig)) {
      // Simple array of URLs
      this.urls = urlsOrConfig;
      this.timing = null;
    } else {
      // Config object with timing
      this.urls = urlsOrConfig.urls;
      this.timing = urlsOrConfig.timing || null; // { delayMs: 500, changeAfterCalls: 3 }
    }
    this.currentIndex = 0;
    this.callCount = 0;
  }

  url() {
    this.callCount++;
    
    if (this.timing) {
      // Change URL every N calls (simulating time passing)
      const changeEvery = this.timing.changeAfterCalls || 3;
      const targetIndex = Math.min(
        Math.floor(this.callCount / changeEvery),
        this.urls.length - 1
      );
      return this.urls[targetIndex];
    } else {
      // Advance to next URL every 2 calls by default
      const advanceEvery = 2;
      const targetIndex = Math.min(
        Math.floor(this.callCount / advanceEvery),
        this.urls.length - 1
      );
      return this.urls[targetIndex];
    }
  }

  reset() {
    this.currentIndex = 0;
    this.callCount = 0;
  }
}

// ============================================================================
// waitForAutoAuth Tests
// ============================================================================

console.log('\n📋 Testing waitForAutoAuth()');

await test('Should detect successful auto-auth', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth',
    'https://login.example.com/auth',
    'https://app.example.com/dashboard' // Returns to app domain
  ]);

  const result = await waitForAutoAuth(mockPage, 'example.com', 'example.com', 2000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'app.example.com', 'Should return final hostname');
});

await test('Should detect auto-auth to original domain', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth',
    'https://example.com/dashboard' // Returns to exact original domain
  ]);

  const result = await waitForAutoAuth(mockPage, 'example.com', 'example.com', 2000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'example.com', 'Should return original hostname');
});

await test('Should timeout if auto-auth does not complete', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth' // Stays on auth page
  ]);

  const result = await waitForAutoAuth(mockPage, 'example.com', 'example.com', 1000);
  
  assert.strictEqual(result.success, false, 'Should fail on timeout');
  assert.strictEqual(result.hostname, undefined, 'Should not have hostname');
});

await test('Should NOT accept return to auth URL on same domain', async () => {
  const mockPage = new MockPage([
    'https://auth.site.com/login',
    'https://site.com/login' // Returns to site.com but still on /login
  ]);

  const result = await waitForAutoAuth(mockPage, 'site.com', 'site.com', 1000);
  
  assert.strictEqual(result.success, false, 'Should fail - still on auth URL');
});

await test('Should accept return to different subdomain', async () => {
  const mockPage = new MockPage([
    'https://accounts.google.com/signin',
    'https://accounts.google.com/signin',
    'https://mail.google.com' // Different subdomain but same base
  ]);

  const result = await waitForAutoAuth(mockPage, 'gmail.com', 'google.com', 2000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'mail.google.com', 'Should return new hostname');
});

await test('Should handle page navigation errors gracefully', async () => {
  const mockPage = {
    url: () => {
      throw new Error('Page not accessible');
    }
  };

  const result = await waitForAutoAuth(mockPage, 'example.com', 'example.com', 1000);
  
  assert.strictEqual(result.success, false, 'Should handle errors and timeout');
});

// ============================================================================
// waitForManualAuth Tests
// ============================================================================

console.log('\n📋 Testing waitForManualAuth()');

await test('Should detect successful manual auth', async () => {
  // Manual auth polls every 2 seconds, so we need URL to change after ~2 polling attempts
  const mockPage = new MockPage({
    urls: [
      'https://login.microsoftonline.com/oauth',
      'https://app.example.com/dashboard' // User completes auth
    ],
    timing: { changeAfterCalls: 3 } // Change URL after 3 calls (simulating ~4 seconds)
  });

  const result = await waitForManualAuth(mockPage, 'example.com', 'example.com', 10000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'app.example.com', 'Should return final hostname');
});

await test('Should return to original domain after auth', async () => {
  const mockPage = new MockPage({
    urls: [
      'https://accounts.google.com/signin',
      'https://myapp.com/home' // Returns to original
    ],
    timing: { changeAfterCalls: 2 }
  });

  const result = await waitForManualAuth(mockPage, 'myapp.com', 'myapp.com', 10000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'myapp.com', 'Should return to myapp.com');
});

await test('Should timeout if user does not complete auth', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth' // User never completes
  ]);

  const result = await waitForManualAuth(mockPage, 'example.com', 'example.com', 2000);
  
  assert.strictEqual(result.success, false, 'Should timeout');
  assert.ok(result.error, 'Should have error message');
  assert.ok(result.hint, 'Should have hint for user');
  assert.ok(result.hint.includes('Authentication timeout'), 'Hint should mention timeout');
});

await test('Should detect landing on different subdomain', async () => {
  const mockPage = new MockPage({
    urls: [
      'https://sso.company.com/login',
      'https://dashboard.company.com' // Different subdomain, same base
    ],
    timing: { changeAfterCalls: 3 }
  });

  const result = await waitForManualAuth(mockPage, 'company.com', 'company.com', 10000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'dashboard.company.com', 'Should accept different subdomain');
});

await test('Should NOT accept return to auth page on same base domain', async () => {
  const mockPage = new MockPage([
    'https://auth0.company.com/login',
    'https://auth0.company.com/login',
    'https://company.com/login' // Returns to base but still on /login
  ]);

  const result = await waitForManualAuth(mockPage, 'company.com', 'company.com', 2000);
  
  assert.strictEqual(result.success, false, 'Should timeout - still on auth page');
});

await test('Should handle page navigation errors', async () => {
  let callCount = 0;
  const mockPage = {
    url: () => {
      callCount++;
      if (callCount < 3) {
        throw new Error('Navigation in progress');
      }
      return 'https://app.example.com/home';
    }
  };

  const result = await waitForManualAuth(mockPage, 'example.com', 'example.com', 5000);
  
  assert.strictEqual(result.success, true, 'Should handle temporary errors and succeed');
});

await test('Should include current URL in timeout hint', async () => {
  const mockPage = new MockPage([
    'https://stuck.on.auth.com/page'
  ]);

  const result = await waitForManualAuth(mockPage, 'example.com', 'example.com', 1000);
  
  assert.strictEqual(result.success, false);
  assert.ok(result.hint.includes('stuck.on.auth.com/page'), 'Should include stuck URL in hint');
});

await test('Should accept cross-domain SSO completion', async () => {
  const mockPage = new MockPage({
    urls: [
      'https://accounts.google.com/signin',
      'https://myapp.com' // Different domain entirely
    ],
    timing: { changeAfterCalls: 3 }
  });

  const result = await waitForManualAuth(mockPage, 'myapp.com', 'myapp.com', 10000);
  
  assert.strictEqual(result.success, true, 'Should succeed for cross-domain SSO');
  assert.strictEqual(result.hostname, 'myapp.com', 'Should return to original app');
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  process.exit(1);
}
