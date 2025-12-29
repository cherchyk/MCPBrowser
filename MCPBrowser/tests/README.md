# MCPBrowser Tests

Comprehensive test suite for MCPBrowser covering core functionality, actions, and integration scenarios.

## Test Organization

Tests are organized to mirror the source code structure:
- **Unit Tests** - Run in parallel for fast execution (core modules)
- **Integration Tests** - Run sequentially with real browser instances (actions and MCP server)

## Test Suites

### Core Tests (Unit - Parallel Execution)

#### 1. `core/browser.test.js` - **64 tests**
Tests for browser management and tab pooling:
- Browser instance lifecycle
- Domain-to-tab mapping
- Tab creation and reuse
- Browser reconnection

#### 2. `core/html.test.js` - **51 tests**
Tests for HTML processing:
- **`cleanHtml()`** - Removes scripts, styles, attributes
- **`enrichHtml()`** - Converts relative URLs to absolute
- **`prepareHtml()`** - Combined clean + enrich

#### 3. `core/page.test.js` - **43 tests**
Tests for page operations and stability:
- Page navigation
- Stability detection
- HTML extraction and processing
- Page state management

### Action Tests (Integration - Sequential Execution)

#### 4. `actions/click-element.test.js` - **3 tests**
Tests for `clickElement()`:
- Parameter validation (url, selector/text)
- Error handling for unloaded pages

#### 5. `actions/type-text.test.js` - **4 tests**
Tests for `typeText()`:
- Parameter validation (url, selector, text)
- Error handling for unloaded pages

#### 6. `actions/get-interactive-elements.test.js` - **4 tests**
Tests for `getInteractiveElements()`:
- Parameter validation
- Limit parameter handling
- Real page element discovery

#### 7. `actions/wait-for-element.test.js` - **3 tests**
Tests for `waitForElement()`:
- Parameter validation (url, selector/text)
- Error handling for unloaded pages

#### 8. `actions/get-current-html.test.js` - **4 tests**
Tests for `getCurrentHtml()`:
- Parameter validation
- HTML retrieval from loaded pages
- `removeUnnecessaryHTML` parameter behavior

#### 9. `actions/fetch-page.test.js` - **3 tests**
Integration tests for `fetchPage()`:
- Permanent redirect handling (gmail.com → mail.google.com)
- Multi-page workflow (eng.ms)
- HTML cleaning parameter validation

### Authentication & MCP Tests (Integration - Sequential)

#### 10. `core/auth.test.js` - **14 tests**
Tests for authentication flow handling:
- **`waitForAutoAuth()`** - Auto-authentication detection
- **`waitForManualAuth()`** - Manual auth completion
- Cross-domain SSO flows
- Subdomain landing after auth
- Timeout handling

#### 11. `mcp-browser.test.js` - **2 tests**
Tests for MCP server:
- Server initialization
- Tool listing

## Running Tests

### Run All Tests
```bash
node tests/run-all.js
```
Runs all unit tests in parallel, then integration tests sequentially.

### Run Individual Test Suite
```bash
# Unit tests
node tests/core/browser.test.js
node tests/core/html.test.js
node tests/core/page.test.js

# Action tests
node tests/actions/click-element.test.js
node tests/actions/type-text.test.js
node tests/actions/get-interactive-elements.test.js
node tests/actions/wait-for-element.test.js
node tests/actions/get-current-html.test.js
node tests/actions/fetch-page.test.js

# Authentication & MCP tests
nodeBrowser Management
- Browser instance creation and reuse
- Domain-to-tab mapping and pooling
- Tab persistence across browser reconnections
- Proper cleanup and resource management

### Page Actions
- Element clicking (navigation and form interactions)
- Text input to form fields
- Interactive element discovery
- Dynamic element waiting
- Current HTML state retrieval

### Redirect & Navigation
- Permanent redirects (gmail.com → mail.google.com)
- Cross-domain SSO flows (Google, Microsoft, Okta)
- Same-domain authentication redirects
- Multi-page navigation workflows

### Authentication Flows
- Auto-authentication with valid cookies
- Manual auth with cross-domain SSO providers
- Landing on different subdomain after auth
- Timeout scenarios with user hints

### HTML Processing
- Script/style removal
- Attribute cleaning (class, id, data-*, events)
- Relative → absolute URL conversion
- SVG and comment removal
- Configurable cleaning via `removeUnnecessaryHTML` parameter

### MCP Server Integration
- Server initialization and lifecycle
- Tool discovery and listing
- Export validation for testing

## Test Execution Strategy

**Fast Parallel Execution** for unit tests:
- Core tests run simultaneously (~1 second)
- No browser dependencies or minimal mocking

**Sequential Integration Tests**:
- Actions run one at a time with real browser
- Ensures tab state isolation
- Prevents race conditions

**Total execution time: ~45 seconds**
- Unit tests (parallel): ~1 second
- Integration tests (sequential): ~44 seconds
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
