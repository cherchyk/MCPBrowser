import assert from 'assert';
import { waitForAutoAuth, waitForManualAuth } from '../../src/mcp-browser.js';

console.log('🧪 Testing authentication flow functions\n');
console.log('📝 Note: Auth functions detect completion when page leaves auth URL\n');

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

await test('Should detect successful auto-auth when leaving auth page', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth',
    'https://login.example.com/auth',
    'https://app.example.com/dashboard' // Left auth page
  ]);

  const result = await waitForAutoAuth(mockPage, 2000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'app.example.com', 'Should return final hostname');
});

await test('Should detect auto-auth to any non-auth domain', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth',
    'https://completely-different.com/page' // Any non-auth page is success
  ]);

  const result = await waitForAutoAuth(mockPage, 2000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'completely-different.com', 'Should return final hostname');
});

await test('Should timeout if staying on auth page', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth' // Stays on auth page
  ]);

  const result = await waitForAutoAuth(mockPage, 1000);
  
  assert.strictEqual(result.success, false, 'Should fail on timeout');
  assert.strictEqual(result.hostname, undefined, 'Should not have hostname');
});

await test('Should NOT accept navigation to another auth URL', async () => {
  const mockPage = new MockPage([
    'https://auth.site.com/login',
    'https://site.com/login' // Still on /login path
  ]);

  const result = await waitForAutoAuth(mockPage, 1000);
  
  assert.strictEqual(result.success, false, 'Should fail - still on auth URL');
});

await test('Should handle gmail -> google -> mail.google flow', async () => {
  // This is the critical test case: gmail.com -> accounts.google.com -> mail.google.com
  const mockPage = new MockPage([
    'https://accounts.google.com/signin',
    'https://accounts.google.com/signin',
    'https://mail.google.com/mail' // Final destination after auth
  ]);

  const result = await waitForAutoAuth(mockPage, 2000);
  
  assert.strictEqual(result.success, true, 'Should succeed - left auth page');
  assert.strictEqual(result.hostname, 'mail.google.com', 'Should return mail.google.com');
});

await test('Should handle page navigation errors gracefully', async () => {
  const mockPage = {
    url: () => {
      throw new Error('Page not accessible');
    }
  };

  const result = await waitForAutoAuth(mockPage, 1000);
  
  assert.strictEqual(result.success, false, 'Should handle errors and timeout');
});

// ============================================================================
// waitForManualAuth Tests
// ============================================================================

console.log('\n📋 Testing waitForManualAuth()');

await test('Should detect successful manual auth when leaving auth page', async () => {
  const mockPage = new MockPage({
    urls: [
      'https://login.microsoftonline.com/oauth',
      'https://app.example.com/dashboard' // User completes auth
    ],
    timing: { changeAfterCalls: 3 }
  });

  const result = await waitForManualAuth(mockPage, 10000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'app.example.com', 'Should return final hostname');
});

await test('Should detect auth complete to any non-auth URL', async () => {
  const mockPage = new MockPage({
    urls: [
      'https://accounts.google.com/signin',
      'https://myapp.com/home' // Left auth page
    ],
    timing: { changeAfterCalls: 2 }
  });

  const result = await waitForManualAuth(mockPage, 10000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'myapp.com', 'Should return myapp.com');
});

await test('Should timeout if user does not complete auth', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth' // User never completes
  ]);

  const result = await waitForManualAuth(mockPage, 2000);
  
  assert.strictEqual(result.success, false, 'Should timeout');
  assert.ok(result.error, 'Should have error message');
  assert.ok(result.hint, 'Should have hint for user');
});

await test('Should handle gmail -> google -> mail.google flow', async () => {
  // Critical test: gmail.com -> accounts.google.com -> mail.google.com
  const mockPage = new MockPage({
    urls: [
      'https://accounts.google.com/signin',
      'https://accounts.google.com/signin', 
      'https://mail.google.com/mail' // Final destination
    ],
    timing: { changeAfterCalls: 2 }  // Faster transition for test
  });

  const result = await waitForManualAuth(mockPage, 10000);
  
  assert.strictEqual(result.success, true, 'Should succeed');
  assert.strictEqual(result.hostname, 'mail.google.com', 'Should return mail.google.com');
});

await test('Should NOT accept navigation to another auth page', async () => {
  const mockPage = new MockPage([
    'https://auth0.company.com/login',
    'https://auth0.company.com/login',
    'https://company.com/login' // Still on /login
  ]);

  const result = await waitForManualAuth(mockPage, 2000);
  
  assert.strictEqual(result.success, false, 'Should timeout - still on auth page');
});

await test('Should handle page navigation errors gracefully', async () => {
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

  const result = await waitForManualAuth(mockPage, 5000);
  
  assert.strictEqual(result.success, true, 'Should handle temporary errors and succeed');
});

await test('Should include current URL in timeout hint', async () => {
  const mockPage = new MockPage([
    'https://login.stuck-site.com/auth'  // Use a proper auth URL
  ]);

  const result = await waitForManualAuth(mockPage, 1000);
  
  assert.strictEqual(result.success, false);
  assert.ok(result.hint.includes('login.stuck-site.com'), 'Should include stuck URL in hint');
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
