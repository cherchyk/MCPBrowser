# Changelog

All notable changes to the MCPBrowser project (both the MCP server and VS Code extension) are documented here.

## [Unreleased]

### MCP Server
- Interactive features: `click_element`, `type_text`, `wait_for_element`, `get_interactive_elements`
- `get_current_html` - Efficient HTML extraction without page reload (10-50x faster)
- `close_tab` - Browser tab management
- Architecture improvement: separated navigation from HTML extraction

### Documentation
- Updated all docs to use correct function names (snake_case)
- Version synchronization to 0.2.35 across all files
- Added LICENSE to MCPBrowser/ directory
- Removed redundant root DEPLOYMENT.md file

## [0.2.35] - 2025-12-26
- Updated deployment checklist with chained commands and proper flags
- Version synchronization improvements

## [0.2.34] - 2025-12-26
- Updated MCP name to `io.github.cherchyk/mcpbrowser` for consistency
- Removed npm workspaces to avoid package name conflicts

## [0.2.33] - 2025-12-26
- Reorganized repository structure: MCPBrowser/ and VSCodeExtension/
- Added comprehensive extension test suite (25 tests)
- Improved test infrastructure with Mocha, Sinon, Proxyquire

## [0.2.32] - 2025-12-25
- Removed dotenv dependency
- Added Edge browser support (x86, Linux)
- Fixed macOS compatibility issues

## [0.2.31] - 2025-12-25
- Aligned test file structure
- Improved test consistency

## [0.2.30] - 2025-12-25
- Added redirect and authentication flow handling
- Permanent redirect detection, cross-domain SSO support
- Comprehensive test suite (106 tests)
- Refactored fetchPage function (8 modular functions)

## [0.2.29 - 0.2.21] - 2025-12-24
- Deployment checklist improvements
- Description and terminology standardization
- Test automation improvements

## [0.2.19] - 2025-01-27
- Added prepareHtml function (82% size reduction)
- Enhanced URL extraction in tests

## [0.2.18] - 2025-01-26
- Authentication waiting mechanism (10min timeout)
- Domain-based tab pooling
- Integration test suite

## [0.2.17 - 0.1.0] - 2025-12-22 to 2025-12-23
- Initial releases and iterations
- VS Code extension initial release
