# MCPBrowser Tests

Test suite for MCPBrowser covering core functionality, actions, and multi-browser scenarios.

## Quick Start

```bash
# Run all tests (unit + browser integration)
npm test

# Unit tests only (CI/CD safe, no browser required)
npm run test:ci
node tests/run-unit.js

# Browser tests only (requires browser)
node tests/run-browser.js              # All browsers
node tests/run-browser.js chrome       # Chrome only
node tests/run-browser.js edge         # Edge only
node tests/run-browser.js brave        # Brave only

# Individual test suites
node tests/core/browser.test.js         # Browser management (64 tests)
node tests/core/html.test.js            # HTML processing (51 tests)
node tests/core/page.test.js            # Page operations (43 tests)

# Individual action tests (supports browser param)
node tests/actions/browser.click-element.test.js        # All browsers
node tests/actions/browser.click-element.test.js chrome # Chrome only
node tests/actions/browser.fetch-page.test.js edge      # Edge only
node tests/actions/browser.fetch-page.test.js brave     # Brave only
```

## Test Organization

The test suite is split into two runners for optimal execution:

### Unit Tests - `run-unit.js` (8 suites)
**Fast parallel execution, NO browser required** - Perfect for CI/CD

- `core/browser.test.js` - Browser lifecycle and tab pooling (uses mocks)
- `core/html.test.js` - HTML cleaning and enrichment (pure functions)
- `core/page.test.js` - Page navigation and stability (uses mocks)
- `core/responses.test.js` - Response class validation
- `core/informational-response.test.js` - InformationalResponse (soft failures)
- `core/http-status-response.test.js` - HttpStatusResponse (HTTP 4xx/5xx)
- `core/auth.test.js` - Authentication flows (uses mock pages)
- `mcp-browser.test.js` - MCP server initialization (uses mocks)

**Run:** `node tests/run-unit.js` (~35 seconds, parallel execution)

### Browser Tests - `run-browser.js` (10 suites)
**Sequential execution, BROWSER required** - Real browser integration

- `actions/browser.click-element.test.js` - Click action with JS fallback testing
- `actions/browser.execute-javascript.test.js` - JavaScript execution, timeout, truncation
- `actions/browser.type-text.test.js` - Text input action across browsers
- `actions/browser.close-tab.test.js` - Tab management across browsers
- `actions/browser.get-current-html.test.js` - HTML retrieval across browsers
- `actions/browser.fetch-page.test.js` - Page fetching across browsers
- `actions/browser.take-screenshot.test.js` - Screenshot capture across browsers
- `actions/browser.scroll-page.test.js` - Page scrolling across browsers
- `verify-structured-output.test.js` - MCP response structure compliance
- `verify-nextsteps.test.js` - NextSteps field validation

**Run:** `node tests/run-browser.js [browser]`
- Without browser param: Runs on all available browsers
- With browser param: Runs only on specified browser (chrome, edge, brave)

### Complete Test Suite - `run-all.js`
Orchestrates both runners sequentially:
1. Runs `run-unit.js` (all unit tests in parallel)
2. Runs `run-browser.js` (all browser tests sequentially)
3. Reports overall summary

**Run:** `npm test` or `node tests/run-all.js`

## Multi-Browser Support

All browser action tests support running on specific browsers:

```bash
# Using run-browser.js (runs all 5 browser test suites)
node tests/run-browser.js              # All available browsers
node tests/run-browser.js chrome       # Chrome only
node tests/run-browser.js edge         # Edge only
node tests/run-browser.js brave        # Brave only

# Individual test files (runs single test suite)
node tests/actions/browser.click-element.test.js        # All browsers
node tests/actions/browser.click-element.test.js chrome # Chrome only
node tests/actions/browser.type-text.test.js edge       # Edge only
node tests/actions/browser.type-text.test.js brave      # Brave only
```

**Supported Browsers:**
- **Chrome** (CDP) - Port 9222, reuses existing browser session
- **Edge** (CDP) - Port 9223, reuses existing browser session
- **Brave** (CDP) - Port 9224, reuses existing browser session

Tests gracefully skip unavailable browsers with warnings.

## Test Infrastructure

**Browser Runner** ([browsers/browser-runner.js](browsers/browser-runner.js))
```javascript
import { runWithBrowsers } from '../browsers/browser-runner.js';

// Runs on all browsers or specific one via process.argv[2]
await runWithBrowsers(async (browserType) => {
  // Your tests receive browserType: 'chrome', 'edge', 'brave', etc.
}, browserParam);
```

**Browser Helper** ([browsers/browser-test-helper.js](browsers/browser-test-helper.js))
- `getAvailableBrowsers()` - Returns browsers with availability status
- `getAllBrowsers()` - All browsers regardless of availability
- `isBrowserAvailable(type)` - Check specific browser

## Key Features Tested

✅ Browser tab pooling and reuse  
✅ Authentication flows (auto/manual, SSO)  
✅ HTML cleaning and URL enrichment  
✅ Element interaction (click, type)  
✅ Click JS fallback on native timeout  
✅ JavaScript execution with timeout and truncation  
✅ Page stability and navigation  
✅ Permanent redirects (gmail.com → mail.google.com)  
✅ Multi-browser compatibility

## Tool Selection Tests

```bash
npm run test:descriptions
# or
node tests/tool-selection/run-tool-selection-tests.js
```

Validates tool descriptions against 14 scenarios covering auth-required sites, SPAs, JavaScript execution, click fallback, and form interactions. See [tool-selection/TOOL_SELECTION_README.md](tool-selection/TOOL_SELECTION_README.md).

## CI/CD

```bash
npm run test:ci  # Runs run-unit.js: 8 test suites, ~8 seconds, no browser needed
```

Perfect for GitHub Actions - no browser dependencies, all tests use mocks or pure functions.
