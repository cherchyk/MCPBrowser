# Project Structure for AI Assistants

This workspace contains two projects:
- **MCPBrowser/** - MCP server (npm package)
- **VSCodeExtension/** - VS Code extension

## Key Files

### MCP Server (MCPBrowser/)
- `MCPBrowser/src/mcp-browser.js` - MCP server entry point
- `MCPBrowser/src/actions/` - Interactive action functions (click, type, wait, etc.)
- `MCPBrowser/src/core/` - Core modules (browser, page, auth, html)
- `MCPBrowser/package.json` - npm package metadata and version
- `MCPBrowser/server.json` - MCP Registry metadata
- `MCPBrowser/README.md` - MCP server documentation
- `MCPBrowser/tests/` - MCP server test suite (195 tests across 11 suites)

### VS Code Extension (VSCodeExtension/)
- `VSCodeExtension/src/extension.js` - Extension for auto-configuration
- `VSCodeExtension/package.json` - Extension metadata and version
- `VSCodeExtension/README.md` - Extension documentation
- `VSCodeExtension/test/` - Extension test suite

### Root
- `package.json` - Workspace configuration (npm workspaces)
- `README.md` - Root overview documentation
- `CHANGELOG.md` - Version history for both packages

## Test Suite Structure

### MCP Server Tests (MCPBrowser/tests/)
**Command**: `npm test` (from root directory - runs both projects)

**195 tests across 11 test suites** (~45 seconds):

**Unit Tests** (run in parallel, ~1 second):
- `core/browser.test.js` - 64 tests for browser management and tab pooling
- `core/html.test.js` - 51 tests for HTML processing
- `core/page.test.js` - 43 tests for page operations

**Integration Tests** (run sequentially, ~44 seconds):
- `actions/click-element.test.js` - 3 tests for clickElement
- `actions/type-text.test.js` - 4 tests for typeText
- `actions/get-interactive-elements.test.js` - 4 tests for getInteractiveElements
- `actions/wait-for-element.test.js` - 3 tests for waitForElement
- `actions/get-current-html.test.js` - 4 tests for getCurrentHtml
- `actions/fetch-page.test.js` - 3 tests for fetchPage integration
- `core/auth.test.js` - 14 tests for authentication flows
- `mcp-browser.test.js` - 2 tests for MCP server protocol

**Note**: Integration tests require Chrome and manual authentication for some scenarios

### Extension Tests (VSCodeExtension/test/)
- `extension.test.js` - Comprehensive unit tests using Mocha/Sinon
- Tests extension functions (getMcpConfigPath, checkNodeInstalled, etc.)

## Source Code Organization

### src/actions/ (Individual action modules)
- `click-element.js` - clickElement function
- `type-text.js` - typeText function
- `get-interactive-elements.js` - getInteractiveElements function
- `wait-for-element.js` - waitForElement function
- `get-current-html.js` - getCurrentHtml function
- `fetch-page.js` - fetchPage function

### src/core/ (Core functionality modules)
- `browser.js` - Browser instance management, tab pooling
- `page.js` - Page navigation, stability detection
- `auth.js` - Authentication flow handling
- `html.js` - HTML processing (cleaning, enrichment)

## Modular Architecture Benefits
- Single file per action for easier maintenance
- Tests mirror source structure (tests/actions/, tests/core/)
- Clear separation of concerns
- Easier to locate and update specific functionality
