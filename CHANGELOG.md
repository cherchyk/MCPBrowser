# Changelog

All notable changes to the MCPBrowser project (both the MCP server and VS Code extension) are documented here.

## [0.2.33] - 2025-12-26

### Project Structure

#### Changed
- Reorganized repository into clear folder structure: MCPBrowser/ and VSCodeExtension/
- Simplified documentation language - removed technical jargon ("monorepo", "workspace dependencies")
- Updated root package.json to use npm workspaces for managing both projects

### VS Code Extension

#### Added
- Comprehensive test suite with 25 tests covering all extension functionality
- Test infrastructure: Mocha, Sinon, Proxyquire for mocking VS Code APIs
- Setup files: test/setup.js, test/mocha.opts, test/README.md

#### Fixed
- Test compatibility - properly mock vscode module without requiring actual VS Code environment
- Process cleanup in tests to prevent test pollution

### MCP Server

#### Changed
- All tests passing (173/174) with improved reliability
- Git history fully preserved through restructuring using git mv

## [0.2.32] - 2025-12-25

### VS Code Extension

#### Changed
- Removed dotenv dependency - no longer needed as environment variables work without it
- Removed unused .env.example file and related documentation
- Cleaned up unused test-mcp.js file from root directory

#### Fixed
- Fixed macOS compatibility: improved module detection to work cross-platform using fileURLToPath
- Added Edge x86 support for Windows (C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe)
- Added Linux Edge support (/usr/bin/microsoft-edge, /opt/microsoft/msedge/msedge)
- Fixed version number inconsistencies across all configuration files

## [0.2.31] - 2025-12-25

### MCP Server

#### Changed
- Aligned integration test file structure with other test files (auth-flow.test.js style)
- Refactored integration tests to use top-level await pattern instead of wrapper function
- Improved test consistency across all test files
- Updated agent-notes.md deployment checklist with mandatory todo list tool usage

### VS Code Extension

#### Changed
- Aligned integration test file structure with other test files (auth-flow.test.js style)
- Refactored integration tests to use top-level await pattern instead of wrapper function
- Improved test consistency across all test files

## [0.2.30] - 2025-12-25

### MCP Server

#### Added
- **Comprehensive redirect and authentication flow handling**:
  - Permanent redirect detection (e.g., gmail.com → mail.google.com)
  - Cross-domain SSO support (Google, Microsoft, Okta patterns)
  - Same-domain authentication path detection (e.g., /dashboard → /login)
  - Requested auth page bypass (direct navigation to auth URLs)
  - False positive prevention for auth-like URLs (e.g., /login-help)
  - Auto-authentication detection with 5-second timeout
  - Manual authentication with subdomain landing support (10-minute timeout)
  - JavaScript redirect detection with 2-second wait after page load
  - Slow page handling with networkidle0 → load fallback

#### Changed
- **Major refactoring of fetchPage function**:
  - Extracted 8 testable functions from monolithic 250-line fetchPage
  - Created modular architecture: getBaseDomain, isLikelyAuthUrl, detectRedirectType, getOrCreatePage, navigateToUrl, waitForAutoAuth, waitForManualAuth, waitForPageStability, extractAndProcessHtml
  - Reduced main fetchPage orchestration to ~80 lines
  - Fixed module import guard to prevent MCP server auto-start during test imports

#### Added
- **Comprehensive test suite (106 tests total, all passing)**:
  - redirect-detection.test.js: 43 tests for redirect logic
  - auth-flow.test.js: 14 tests for authentication flows with MockPage
  - Aligned integration.test.js structure with other test files
  - All tests use consistent assert.strictEqual/assert.ok patterns
  - Test runner executes all suites with summary output

#### Fixed
- gmail.com no longer treated as authentication flow (permanent redirect handled correctly)
- Cross-domain authentication flows properly detected and waited for
- Auth URL pattern matching uses strict boundaries to avoid false positives
- Module imports no longer trigger MCP server startup

### VS Code Extension

#### Added
- Comprehensive redirect and authentication flow handling
- Cross-domain SSO support (Google, Microsoft, Okta patterns)
- Same-domain authentication path detection
- Auto-authentication detection with 5-second timeout
- Manual authentication with subdomain landing support
- JavaScript redirect detection
- False positive prevention for auth-like URLs

#### Changed
- Major refactoring: extracted 8 testable functions from fetchPage
- Reduced main fetchPage orchestration from ~250 lines to ~80 lines

#### Added
- Comprehensive test suite (106 tests total, all passing)
- redirect-detection.test.js: 43 tests
- auth-flow.test.js: 14 tests with MockPage

#### Fixed
- gmail.com permanent redirect handling (no longer treated as auth flow)
- Module imports no longer trigger MCP server auto-start

## [0.2.29] - 2025-12-24

### MCP Server

#### Changed
- Updated deployment checklist to allow skipping confirmation when user clearly requests deployment
- Simplified confirmation question from two questions to one

### VS Code Extension

#### Changed
- Updated deployment checklist to allow skipping confirmation when user clearly requests deployment

## [0.2.28] - 2025-12-24

### MCP Server

#### Changed
- Improved agent-notes.md deployment checklist with stronger safeguards
- Removed exception clause - deployment confirmation now always required
- Reorganized agent-notes.md structure (project info before deployment steps)
- Cleaned up outdated documentation from agent-notes.md

### VS Code Extension

#### Changed
- Improved MCP server description for better clarity and consistency
- Updated description to start with "Web page fetching" and use "the user" instead of "you"
- Enhanced use case explanations for authentication, anti-bot protection, and JavaScript rendering

## [0.2.27] - 2025-12-24

### MCP Server & VS Code Extension

#### Changed
- Updated VS Code extension icon with modern MCP Browser branding design
- New icon features bold "MCP" typography with "BROWSER" subtitle for better brand visibility

## [0.2.25] - 2025-12-24

### VS Code Extension

#### Changed
- Aligned all descriptions with "in-browser web page fetching" terminology
- Updated package.json, extension/package.json, and server.json descriptions for consistency
- Improved extension README to focus on VS Code use case only

## [0.2.24] - 2025-12-24

### VS Code Extension

#### Changed
- Enhanced deployment checklist with branch verification requirement (must deploy from `main` only)
- Updated changelog rules to include only changes present in the `main` branch

## [0.2.23] - 2025-12-24

### VS Code Extension

#### Changed
- Improved deployment checklist to identify two sources of truth for descriptions
- Enhanced documentation to distinguish between MCP Server Purpose (extension.js) and Fetch Tool API (mcp-browser.js)
- Updated test execution instructions to always run from project root directory

## [0.2.22] - 2025-12-24

### VS Code Extension

#### Changed
- Enhanced mcp.json description to include using browser for JavaScript-heavy sites, dynamic content, and SPAs
- Tool now recommended not just for auth barriers but also when real browser rendering would be beneficial
- Improved deployment checklist to verify all description fields across project files

## [0.2.21] - 2025-12-24

### VS Code Extension

#### Changed
- Updated deployment checklist to use `npm test` for all tests
- Improved test automation: now runs all *.test.js files in tests/ folder automatically
- Version synchronization across all package files

## [0.2.19] - 2025-01-27

### MCP Server

#### Added
- **prepareHtml function**: New function that reduces HTML size by 82% (92KB → 16KB) while preserving content
  - Removes: scripts, styles, meta tags, noscript, SVG, link tags, comments
  - Removes bloat attributes: class, id, style, data-*, onclick/onload, role, aria-*
  - Converts relative URLs to absolute for href and src attributes
  - Collapses whitespace and removes inter-tag spaces
- **Comprehensive test suite for prepareHtml**: 28 unit tests validating all cleanup operations
- **Enhanced URL extraction in integration tests**: 
  - Now extracts ALL URLs (54 total, 39 unique after filtering)
  - Filters static assets (.css, .js, .ico, .png, etc.)
  - Converts relative URLs to absolute
  - Randomly selects 5 URLs for varied testing

#### Changed
- Removed HTML truncation - prepareHtml cleanup makes it unnecessary
- Integration tests now use HTML from fetch step (no re-fetch)
- Tests exit immediately with `process.exit(0)` after completion

#### Fixed
- Static asset URLs no longer included in test URL extraction
- HTML reuse pattern prevents unnecessary re-fetching

## [0.2.18] - 2025-01-26

### MCP Server

#### Added
- **Authentication waiting mechanism**: Waits up to 10 minutes for manual authentication
  - Detects login pages by hostname (login.microsoftonline.com, etc.)
  - Allows manual login in browser window
  - Automatically continues when authentication completes
- **Domain-based tab pooling**: Reuses browser tabs per hostname for efficiency
  - Reduces browser resource usage
  - Improves performance for multiple requests to same domain
  - Prevents tab proliferation
- **Comprehensive integration test suite**: 14 tests validating complete workflow
  - Real-world scenario: fetch protected page → extract URLs → load random URLs
  - Tests tab reuse, hostname extraction, and authentication flow
- **49 unit tests** for domain-tab pooling functionality

#### Technical Improvements
- Better hostname extraction and normalization
- Improved tab lifecycle management
- Enhanced error handling for authentication timeout

### VS Code Extension

#### Changed
- Re-deployment with complete checklist compliance
- All version references synchronized across project

## [0.2.17] - 2025-12-23

### VS Code Extension

#### Changed
- **Complete terminology standardization**: Unified all verbs to "fetch" and all nouns to "web page" (two words) across entire project
  - Replaced: load/access/read/open → fetch
  - Replaced: page/pages/webpage → web page/web pages
  - Affects: mcp-browser.js, README.md, extension/README.md, package.json files, agent-notes.md, extension.js, CHANGELOG.md
- **Scope accuracy improvement**: Updated tool annotation title from "Fetch Authenticated Web Page" → "Fetch Protected Web Page"
  - Better reflects capability: handles authentication, SSO, anti-crawler, paywalls
- **Enhanced parameter descriptions**:
  - `keepPageOpen`: Now explains WHEN to use (subsequent same-domain requests preserve auth)
- **Updated descriptions**: Changed "authenticated web pages" → "protected web pages" for accuracy
- **Added usage guidance**: "Should be used when standard fetch_webpage fails"

## [0.2.16] - 2025-12-22

### VS Code Extension

#### Changed
- Documentation cleanup: Removed outdated NEXT_STEPS.md and EXTENSION_README.md
- Improved .vscodeignore to exclude package-lock.json from extension package
- Enhanced agent-notes.md with detailed persistent retry strategy planning

## [0.2.15] - 2025-12-22

### VS Code Extension

#### Changed
- **Renamed tool**: `load_and_extract` → `fetch_webpage_protected` for better alignment with standard `fetch_webpage` tool
- Tool name now clearly indicates it's the protected/authenticated version of webpage fetching
- Makes it easier for Copilot to recognize when to use this tool vs standard fetch
- **Enhanced retry guidance**: Added explicit instructions for AI agents to retry 2-3 times with 10-30s delays when encountering login pages
- Prevents premature "authentication required" failures when user is actively authenticating

## [0.2.14] - 2025-12-22

### VS Code Extension

#### Changed
- **Improved deployment checklist**: Added requirement to ask user for deployment confirmation before proceeding
- Prevents automatic deployment when user may have additional changes planned
- Deployment only proceeds without asking when explicitly requested

## [0.2.13] - 2025-12-22

### VS Code Extension

#### Changed
- **Improved tool description** to make MCPBrowser the PRIMARY choice for authenticated/protected websites
- Tool now explicitly mentions common use cases: internal/corporate sites (*.microsoft.com, *.eng.ms), SSO/OAuth pages, paywalled content
- Enhanced guidance for AI agents to prefer MCPBrowser over generic URL fetchers for authenticated content
- Better automatic tool selection by GitHub Copilot for protected resources

## [0.2.12] - 2025-12-22

### VS Code Extension

#### Changed
- Updated deployment checklist order
- Added Chrome flags to suppress first-run prompts (--no-first-run, --no-default-browser-check, --disable-sync)
- Fixed Chrome "Sign in to Chrome" prompt appearing with dedicated debug profile

## [0.2.7] - 2025-12-22

### VS Code Extension

#### Changed
- Synced extension version with npm package (now both 0.2.7)
- Versions will now always match for easier tracking

## [0.1.6] - 2025-12-22

### VS Code Extension

#### Changed
- Updated display name from "MCPBrowser" to "MCP Browser" for better readability
- All user-facing text now uses "MCP Browser" (technical identifiers remain unchanged)
- Improved marketplace presentation with proper spacing

## [0.1.5] - 2025-12-22

### VS Code Extension

#### Changed
- Updated to mcpbrowser@0.2.5 with improved VS Code confirmation experience
- Added proper tool title annotation ("Fetch Protected Web Page")
- Enhanced description with warning emoji for clarity
- Uses default Chrome profile with saved passwords, extensions, and authenticated sessions
- Cross-platform support (Windows, macOS, Linux)

## [0.1.4] - 2025-12-22

### VS Code Extension

#### Added
- Smart confirmation: Only asks user on first fetch to a domain
- Subsequent authenticated requests work automatically (session preserved)
- Updated tool description for better UX

## [0.1.3] - 2025-12-22

### VS Code Extension

#### Added
- Improved positioning as fallback/alternative tool
- Simplified README with practical usage examples
- Added "How It Works" section explaining browser and auth flow

## [0.1.2] - 2025-12-22

### VS Code Extension

#### Added
- Automatic npm package installation
- All-in-one installation experience

## [0.1.1] - 2025-12-22

### VS Code Extension

#### Changed
- Renamed from mcpbrowser-config to mcpbrowser for cleaner URL

## [0.1.0] - 2025-12-22

### VS Code Extension

#### Added
- Initial release
- One-click MCP Browser configuration for GitHub Copilot
- Automatic detection and notification prompt
- Command to add MCP Browser to mcp.json
- Command to remove MCP Browser from mcp.json
- Smart handling of existing configurations
- Cross-platform support (Windows, macOS, Linux)

## [0.2.0] - Previous releases

### MCP Server

Initial implementation with basic browser automation and MCP server integration.
