import assert from 'assert';
import { getBaseDomain, isLikelyAuthUrl, detectRedirectType } from '../../src/mcp-browser.js';

console.log('🧪 Testing redirect detection functions\n');

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (err) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${err.message}`);
    testsFailed++;
  }
}

// ============================================================================
// getBaseDomain Tests
// ============================================================================

console.log('\n📋 Testing getBaseDomain()');

test('Should extract base domain from subdomain', () => {
  const result = getBaseDomain('mail.google.com');
  assert.strictEqual(result, 'google.com', 'Should return google.com');
});

test('Should handle simple domain', () => {
  const result = getBaseDomain('example.com');
  assert.strictEqual(result, 'example.com', 'Should return same domain');
});

test('Should handle deep subdomain', () => {
  const result = getBaseDomain('app.dashboard.example.com');
  assert.strictEqual(result, 'example.com', 'Should return base domain');
});

test('Should handle single part hostname', () => {
  const result = getBaseDomain('localhost');
  assert.strictEqual(result, 'localhost', 'Should return same hostname');
});

test('Should handle IP address', () => {
  const result = getBaseDomain('192.168.1.1');
  assert.strictEqual(result, '1.1', 'Should return last two parts');
});

// ============================================================================
// isLikelyAuthUrl Tests
// ============================================================================

console.log('\n📋 Testing isLikelyAuthUrl()');

// Path-based auth patterns
test('Should detect /login path', () => {
  const result = isLikelyAuthUrl('https://example.com/login');
  assert.strictEqual(result, true, 'Should detect /login');
});

test('Should detect /signin path', () => {
  const result = isLikelyAuthUrl('https://example.com/signin');
  assert.strictEqual(result, true, 'Should detect /signin');
});

test('Should detect /auth path', () => {
  const result = isLikelyAuthUrl('https://example.com/auth');
  assert.strictEqual(result, true, 'Should detect /auth');
});

test('Should detect /sso path', () => {
  const result = isLikelyAuthUrl('https://example.com/sso');
  assert.strictEqual(result, true, 'Should detect /sso');
});

test('Should detect /oauth path', () => {
  const result = isLikelyAuthUrl('https://example.com/oauth');
  assert.strictEqual(result, true, 'Should detect /oauth');
});

test('Should detect /authenticate path', () => {
  const result = isLikelyAuthUrl('https://example.com/authenticate');
  assert.strictEqual(result, true, 'Should detect /authenticate');
});

test('Should detect /saml path', () => {
  const result = isLikelyAuthUrl('https://example.com/saml');
  assert.strictEqual(result, true, 'Should detect /saml');
});

// Subdomain-based auth patterns
test('Should detect login. subdomain', () => {
  const result = isLikelyAuthUrl('https://login.example.com');
  assert.strictEqual(result, true, 'Should detect login. subdomain');
});

test('Should detect auth. subdomain', () => {
  const result = isLikelyAuthUrl('https://auth.example.com');
  assert.strictEqual(result, true, 'Should detect auth. subdomain');
});

test('Should detect sso. subdomain', () => {
  const result = isLikelyAuthUrl('https://sso.example.com');
  assert.strictEqual(result, true, 'Should detect sso. subdomain');
});

test('Should detect accounts. subdomain', () => {
  const result = isLikelyAuthUrl('https://accounts.google.com/signin');
  assert.strictEqual(result, true, 'Should detect accounts. subdomain');
});

test('Should detect id. subdomain', () => {
  const result = isLikelyAuthUrl('https://id.example.com');
  assert.strictEqual(result, true, 'Should detect id. subdomain');
});

test('Should detect identity. subdomain', () => {
  const result = isLikelyAuthUrl('https://identity.example.com');
  assert.strictEqual(result, true, 'Should detect identity. subdomain');
});

test('Should detect signin. subdomain', () => {
  const result = isLikelyAuthUrl('https://signin.example.com');
  assert.strictEqual(result, true, 'Should detect signin. subdomain');
});

test('Should detect authentication. subdomain', () => {
  const result = isLikelyAuthUrl('https://authentication.example.com');
  assert.strictEqual(result, true, 'Should detect authentication. subdomain');
});

test('Should detect idp. subdomain', () => {
  const result = isLikelyAuthUrl('https://idp.example.com');
  assert.strictEqual(result, true, 'Should detect idp. subdomain');
});

// False positives - should NOT be detected
test('Should NOT detect non-auth path with login word', () => {
  const result = isLikelyAuthUrl('https://example.com/login-help');
  assert.strictEqual(result, false, 'Should not detect /login-help');
});

test('Should NOT detect blog post about login', () => {
  const result = isLikelyAuthUrl('https://example.com/blog/how-to-login');
  assert.strictEqual(result, false, 'Should not detect blog post');
});

test('Should NOT detect accounts in middle of hostname', () => {
  const result = isLikelyAuthUrl('https://myaccounts.example.com');
  assert.strictEqual(result, false, 'Should not detect accounts in middle');
});

test('Should NOT detect normal page', () => {
  const result = isLikelyAuthUrl('https://example.com/dashboard');
  assert.strictEqual(result, false, 'Should not detect dashboard');
});

test('Should NOT detect home page', () => {
  const result = isLikelyAuthUrl('https://example.com');
  assert.strictEqual(result, false, 'Should not detect home page');
});

test('Should NOT detect gmail.com', () => {
  const result = isLikelyAuthUrl('https://gmail.com');
  assert.strictEqual(result, false, 'Should not detect gmail.com');
});

test('Should NOT detect mail.google.com', () => {
  const result = isLikelyAuthUrl('https://mail.google.com');
  assert.strictEqual(result, false, 'Should not detect mail.google.com');
});

// Edge cases
test('Should handle invalid URL gracefully', () => {
  const result = isLikelyAuthUrl('not-a-url');
  assert.strictEqual(result, false, 'Should return false for invalid URL');
});

test('Should be case insensitive', () => {
  const result = isLikelyAuthUrl('https://example.com/LOGIN');
  assert.strictEqual(result, true, 'Should detect uppercase LOGIN');
});

test('Should detect /sign-in with hyphen', () => {
  const result = isLikelyAuthUrl('https://example.com/sign-in');
  assert.strictEqual(result, true, 'Should detect /sign-in');
});

// ============================================================================
// detectRedirectType Tests
// ============================================================================

console.log('\n📋 Testing detectRedirectType()');

test('No redirect - same domain, same path', () => {
  const result = detectRedirectType(
    'https://example.com/page',
    'example.com',
    'https://example.com/page',
    'example.com'
  );
  assert.strictEqual(result.type, 'none', 'Should detect no redirect');
});

test('Permanent redirect - gmail.com → mail.google.com', () => {
  const result = detectRedirectType(
    'https://gmail.com',
    'gmail.com',
    'https://mail.google.com',
    'mail.google.com'
  );
  assert.strictEqual(result.type, 'permanent', 'Should detect permanent redirect');
  assert.strictEqual(result.currentHostname, 'mail.google.com', 'Should include current hostname');
});

test('Permanent redirect - different domain, no auth pattern', () => {
  const result = detectRedirectType(
    'https://oldsite.com',
    'oldsite.com',
    'https://newsite.com',
    'newsite.com'
  );
  assert.strictEqual(result.type, 'permanent', 'Should detect permanent redirect');
});

test('Auth flow - cross-domain to SSO provider', () => {
  const result = detectRedirectType(
    'https://app.example.com/dashboard',
    'app.example.com',
    'https://login.microsoftonline.com/oauth',
    'login.microsoftonline.com'
  );
  assert.strictEqual(result.type, 'auth', 'Should detect auth flow');
  assert.strictEqual(result.flowType, 'cross-domain redirect', 'Should be cross-domain');
});

test('Auth flow - same domain path change', () => {
  const result = detectRedirectType(
    'https://example.com/dashboard',
    'example.com',
    'https://example.com/login',
    'example.com'
  );
  assert.strictEqual(result.type, 'auth', 'Should detect auth flow');
  assert.strictEqual(result.flowType, 'same-domain path change', 'Should be same-domain');
});

test('Auth flow - to Google accounts', () => {
  const result = detectRedirectType(
    'https://myapp.com',
    'myapp.com',
    'https://accounts.google.com/signin',
    'accounts.google.com'
  );
  assert.strictEqual(result.type, 'auth', 'Should detect auth flow');
  assert.strictEqual(result.flowType, 'cross-domain redirect', 'Should be cross-domain');
});

test('Requested auth page - user requested login page directly', () => {
  const result = detectRedirectType(
    'https://example.com/login',
    'example.com',
    'https://example.com/login',
    'example.com'
  );
  assert.strictEqual(result.type, 'requested_auth', 'Should detect requested auth page');
  assert.strictEqual(result.currentHostname, 'example.com', 'Should include hostname');
});

test('Requested auth page - user requested accounts.google.com', () => {
  const result = detectRedirectType(
    'https://accounts.google.com',
    'accounts.google.com',
    'https://accounts.google.com/signin',
    'accounts.google.com'
  );
  assert.strictEqual(result.type, 'requested_auth', 'Should detect requested auth page');
});

test('Auth flow - subdomain auth (login.example.com)', () => {
  const result = detectRedirectType(
    'https://example.com/app',
    'example.com',
    'https://login.example.com',
    'login.example.com'
  );
  assert.strictEqual(result.type, 'auth', 'Should detect auth flow');
  assert.strictEqual(result.flowType, 'cross-domain redirect', 'Should be cross-domain');
  assert.strictEqual(result.originalBase, 'example.com', 'Should preserve original base');
});

test('Auth flow - Okta SSO', () => {
  const result = detectRedirectType(
    'https://mycompany.com',
    'mycompany.com',
    'https://mycompany.okta.com/login',
    'mycompany.okta.com'
  );
  assert.strictEqual(result.type, 'auth', 'Should detect auth flow');
});

test('Permanent redirect - subdomain change without auth', () => {
  const result = detectRedirectType(
    'https://www.example.com',
    'www.example.com',
    'https://app.example.com',
    'app.example.com'
  );
  assert.strictEqual(result.type, 'permanent', 'Should detect permanent redirect');
});

test('Should include all required fields for auth flow', () => {
  const result = detectRedirectType(
    'https://site.com',
    'site.com',
    'https://auth.site.com/login',
    'auth.site.com'
  );
  assert.strictEqual(result.type, 'auth');
  assert.ok(result.flowType, 'Should have flowType');
  assert.ok(result.originalBase, 'Should have originalBase');
  assert.ok(result.currentUrl, 'Should have currentUrl');
  assert.ok(result.hostname, 'Should have hostname');
  assert.ok(result.currentHostname, 'Should have currentHostname');
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
