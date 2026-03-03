import assert from 'assert';
import { pollUntilAuthDone, waitForAuth } from '../../src/mcp-browser.js';

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
      this.urls = urlsOrConfig;
      this.timing = null;
    } else {
      this.urls = urlsOrConfig.urls;
      this.timing = urlsOrConfig.timing || null;
    }
    this.callCount = 0;
    this._evaluateResult = { isLoginPage: false, indicators: [] };
  }

  url() {
    this.callCount++;
    const changeEvery = this.timing?.changeAfterCalls || 2;
    const targetIndex = Math.min(
      Math.floor(this.callCount / changeEvery),
      this.urls.length - 1
    );
    return this.urls[targetIndex];
  }

  async evaluate(fn) {
    return this._evaluateResult;
  }

  withLoginPage(isLoginPage = true) {
    this._evaluateResult = {
      isLoginPage,
      indicators: isLoginPage ? ['password field', 'login button'] : []
    };
    return this;
  }
}

// ============================================================================
// pollUntilAuthDone Tests
// ============================================================================

console.log('\n📋 Testing pollUntilAuthDone()');

await test('Should detect success when leaving auth page', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth',
    'https://login.example.com/auth',
    'https://app.example.com/dashboard'
  ]);

  const result = await pollUntilAuthDone(mockPage, 2000, 100);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.hostname, 'app.example.com');
});

await test('Should detect auth to any non-auth domain', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth',
    'https://completely-different.com/page'
  ]);

  const result = await pollUntilAuthDone(mockPage, 2000, 100);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.hostname, 'completely-different.com');
});

await test('Should timeout if staying on auth page', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth'
  ]);

  const result = await pollUntilAuthDone(mockPage, 500, 100);
  assert.strictEqual(result.success, false);
  assert.strictEqual(result.hostname, undefined);
});

await test('Should NOT accept navigation to another auth URL', async () => {
  const mockPage = new MockPage([
    'https://auth.site.com/login',
    'https://site.com/login'
  ]);

  const result = await pollUntilAuthDone(mockPage, 500, 100);
  assert.strictEqual(result.success, false);
});

await test('Should handle gmail -> google -> mail.google flow', async () => {
  const mockPage = new MockPage([
    'https://accounts.google.com/signin',
    'https://accounts.google.com/signin',
    'https://mail.google.com/mail'
  ]);

  const result = await pollUntilAuthDone(mockPage, 2000, 100);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.hostname, 'mail.google.com');
});

await test('Should handle page navigation errors gracefully', async () => {
  const mockPage = {
    url: () => { throw new Error('Page not accessible'); }
  };

  const result = await pollUntilAuthDone(mockPage, 500, 100);
  assert.strictEqual(result.success, false);
});

await test('Should include current URL in timeout hint', async () => {
  const mockPage = new MockPage([
    'https://login.stuck-site.com/auth'
  ]);

  const result = await pollUntilAuthDone(mockPage, 500, 100);
  assert.strictEqual(result.success, false);
  assert.ok(result.hint.includes('login.stuck-site.com'));
});

await test('Should return error with timeout duration', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth'
  ]);

  // Keep the timeout tiny so the test suite stays fast while still exercising
  // the timeout branch of pollUntilAuthDone.
  const fastResult = await pollUntilAuthDone(mockPage, 500, 100);
  assert.ok(fastResult.error);
  assert.ok(fastResult.hint);
});

// ============================================================================
// waitForAuth Tests (two-phase integration)
// ============================================================================

console.log('\n📋 Testing waitForAuth()');

await test('Should succeed quickly on auto-auth (phase 1)', async () => {
  const mockPage = new MockPage([
    'https://login.example.com/auth',
    'https://app.example.com/dashboard'
  ]);

  const result = await waitForAuth(mockPage);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.hostname, 'app.example.com');
});

await test('Should succeed on manual auth after phase 1 fails', async () => {
  // URL stays on auth for many calls (past phase 1), then leaves
  const mockPage = new MockPage({
    urls: [
      'https://login.microsoftonline.com/oauth',
      'https://login.microsoftonline.com/oauth',
      'https://login.microsoftonline.com/oauth',
      'https://app.example.com/dashboard'
    ],
    timing: { changeAfterCalls: 8 }
  });

  const result = await waitForAuth(mockPage);
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.hostname, 'app.example.com');
});

await test('Should handle page errors in waitForAuth', async () => {
  let callCount = 0;
  const mockPage = {
    url: () => {
      callCount++;
      if (callCount < 3) throw new Error('Navigation in progress');
      return 'https://app.example.com/home';
    },
    async evaluate() { return { isLoginPage: false, indicators: [] }; }
  };

  const result = await waitForAuth(mockPage);
  assert.strictEqual(result.success, true);
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
