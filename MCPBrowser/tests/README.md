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

# Individual test suites
node tests/core/browser.test.js         # Browser management (64 tests)
node tests/core/html.test.js            # HTML processing (51 tests)
node tests/core/page.test.js            # Page operations (43 tests)

# Individual action tests (supports browser param)
node tests/actions/browser.click-element.test.js        # All browsers
node tests/actions/browser.click-element.test.js chrome # Chrome only
node tests/actions/browser.fetch-page.test.js edge      # Edge only
```

## Test Organization

The test suite is split into two runners for optimal execution:

### Unit Tests - `run-unit.js` (8 suites)
**Fast parallel execution, NO browser required** - Perfect for CI/CD

- `core/browser.test.js` - Browser lifecycle and tab pooling (uses mocks)
- `core/html.test.js` - HTML cleaning and enrichment (pure functions)
- `core/page.test.js` - Page navigation and stability (uses mocks)
- `core/responses.test.js` - Response class validation
- `core/auth.test.js` - Authentication flows (uses mock pages)
- `mcp-browser.test.js` - MCP server initialization (uses mocks)
- `verify-structured-output.test.js` - MCP output format compliance
- `verify-nextsteps.test.js` - NextSteps field validation

**Run:** `node tests/run-unit.js` (~8 seconds, parallel execution)

### Browser Tests - `run-browser.js` (5 suites)
**Sequential execution, BROWSER required** - Real browser integration

- `actions/browser.click-element.test.js` - Click action across browsers
- `actions/browser.type-text.test.js` - Text input action across browsers
- `actions/browser.close-tab.test.js` - Tab management across browsers
- `actions/browser.get-current-html.test.js` - HTML retrieval across browsers
- `actions/browser.fetch-page.test.js` - Page fetching across browsers

**Run:** `node tests/run-browser.js [browser]`
- Without browser param: Runs on all available browsers
- With browser param: Runs only on specified browser (chrome, edge)

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

# Individual test files (runs single test suite)
node tests/actions/browser.click-element.test.js        # All browsers
node tests/actions/browser.click-element.test.js chrome # Chrome only
node tests/actions/browser.type-text.test.js edge       # Edge only
```

**Supported Browsers:**
- **Chrome** (CDP) - Port 9222, reuses existing browser session
- **Edge** (CDP) - Port 9223, reuses existing browser session

Tests gracefully skip unavailable browsers with warnings.

## Test Infrastructure

**Browser Runner** ([browsers/browser-runner.js](browsers/browser-runner.js))
```javascript
import { runWithBrowsers } from '../browsers/browser-runner.js';

// Runs on all browsers or specific one via process.argv[2]
await runWithBrowsers(async (browserType) => {
  // Your tests receive browserType: 'chrome', 'edge', etc.
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
✅ Page stability and navigation  
✅ Permanent redirects (gmail.com → mail.google.com)  
✅ Multi-browser compatibility

## Tool Selection Tests

```bash
npm run test:descriptions
# or
node tests/tool-selection/run-tool-selection-tests.js
```

Validates tool descriptions against 12 scenarios covering auth-required sites, SPAs, and form interactions. See [tool-selection/TOOL_SELECTION_README.md](tool-selection/TOOL_SELECTION_README.md).

## CI/CD

```bash
npm run test:ci  # Runs run-unit.js: 8 test suites, ~8 seconds, no browser needed
```

Perfect for GitHub Actions - no browser dependencies, all tests use mocks or pure functions.
