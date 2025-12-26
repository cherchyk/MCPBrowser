# MCPBrowser Tests

Comprehensive test suite for MCPBrowser redirect detection and authentication flow handling.

## Test Suites

### 1. `redirect-detection.test.js`
Tests for redirect detection and URL analysis functions:
- **`getBaseDomain()`** - Extracts base domain from hostnames
- **`isLikelyAuthUrl()`** - Detects authentication URLs using patterns
- **`detectRedirectType()`** - Classifies redirects (permanent, auth flow, etc.)

**43 tests** covering:
- Gmail → mail.google.com permanent redirects
- Cross-domain SSO (Google, Microsoft, Okta)
- Same-domain auth path changes
- Requested auth page detection
- False positive prevention

### 2. `auth-flow.test.js`
Tests for authentication flow handling:
- **`waitForAutoAuth()`** - Auto-authentication detection (5s timeout)
- **`waitForManualAuth()`** - Manual auth completion (10min timeout)

**14 tests** covering:
- Auto-authentication with valid cookies
- Cross-domain SSO flows
- Subdomain landing after auth
- Timeout handling
- Error resilience

### 3. `prepare-html.test.js`
Tests for HTML processing:
- **`cleanHtml()`** - Removes scripts, styles, attributes
- **`enrichHtml()`** - Converts relative URLs to absolute
- **`prepareHtml()`** - Combined clean + enrich

**49 tests** for HTML sanitization and URL enrichment.

## Running Tests

### Run All Tests
```bash
node tests/run-all.js
```

### Run Individual Test Suite
```bash
node tests/redirect-detection.test.js
node tests/auth-flow.test.js
node tests/prepare-html.test.js
```

## Test Coverage

**Total: 106 tests**
- ✅ All redirect scenarios (permanent, auth, same-domain)
- ✅ Authentication flows (auto-auth, manual, SSO)
- ✅ HTML processing and sanitization
- ✅ Edge cases and error handling

## Key Scenarios Tested

### Redirect Detection
- `gmail.com` → `mail.google.com` (permanent redirect)
- `site.com` → `accounts.google.com` (SSO auth)
- `site.com/dashboard` → `site.com/login` (same-domain auth)
- `accounts.google.com` requested directly (no redirect)

### Auth Flows
- Auto-auth with valid session cookies
- Manual auth with cross-domain SSO providers
- Landing on different subdomain after auth
- Timeout scenarios with user hints

### HTML Processing
- Script/style removal
- Attribute cleaning (class, id, data-*, events)
- Relative → absolute URL conversion
- SVG and comment removal

## Mock Objects

Tests use mock `Page` objects that simulate Puppeteer's page behavior:
- Configurable URL transitions
- Timing controls for async auth flows
- Error simulation for robustness testing

## Fast Execution

All tests complete in **~15 seconds**:
- Pure function tests (redirect detection): instant
- Async tests (auth flows): ~10 seconds
- HTML processing: instant

Fixed module import issue that previously caused hanging by preventing MCP server auto-start during test imports.
