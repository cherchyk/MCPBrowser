# Changelog

All notable changes to the MCPBrowser project (both the MCP server and VS Code extension) are documented here.

## [Unreleased]

## [0.3.4] - 2026-01-02

### MCP Server
- 🧪 **Tool selection testing framework**: Added automated testing to verify AI models select the correct tools based on user queries
- 📝 **Improved tool descriptions**: Enhanced tool descriptions for better AI model understanding and tool selection accuracy
- 📄 **Documentation cleanup**: Removed internal implementation details from README for clearer user-facing documentation

### VS Code Extension
- 📦 **Version sync**: Updated to mcpbrowser@0.3.3 dependency for consistency

## [0.3.3] - 2026-01-01

### Searchability Improvements
- 🔍 **Enhanced discoverability**: Improved npm and VS Code marketplace searchability
- 📝 **README updates**: Added "(MCP Browser)" to all README titles for better search results
- 🏷️ **Keywords expansion**: npm package keywords increased from 8 to 23 (added: browser, web-browser, puppeteer, automation, cloudflare, sso, captcha, spa, claude, ai-assistant, cdp, devtools)
- 🔑 **VS Code keywords**: Extension keywords expanded from 5 to 16 (added: web-browser, scraping, cloudflare, sso, captcha, web-automation, ai-tools, copilot-extension)
- 📋 **Categories**: Added "Testing" and "Machine Learning" categories to VS Code extension
- 📄 **Descriptions**: Updated package descriptions to emphasize "browser server", "real browser", and "browser automation"
- 🎯 **SEO optimization**: Improved README introductions with natural search phrases for better discoverability

## [0.3.2] - 2025-12-31

### MCP Server
- 🏷️ **Rebranding**: Changed product name from "MCP Browser" to "MCPBrowser" for consistency
- 📝 **Documentation**: Updated all README files with improved introduction and consistent branding
- 📦 **Version management**: Now using @latest tag in all npm commands for simpler deployment

### VS Code Extension
- 🏷️ **Rebranding**: Updated displayName to "MCPBrowser" for consistent branding
- 📦 **Version management**: Extension now uses @latest instead of pinned version for automatic updates
- 🚀 **Deployment**: Simplified deployment process by removing version number updates from docs

## [0.3.1] - 2025-12-29

### VS Code Extension
- 🔄 Improved MCP server description for better Copilot integration
- Updated description to clarify when to use MCPBrowser vs standard HTTP requests
- Emphasized interactive capabilities: click elements, fill forms, handle authentication

## [0.2.37] - 2025-12-29

### Fixes
- Minor documentation and deployment updates

## [0.2.36] - 2025-12-29

### MCP Server
- ✨ **Interactive features**: `click_element`, `type_text`, `get_current_html`, `close_tab`
- 🏗️ **Architecture refactor**: Modular structure with separate core/ and actions/ directories
- ⚡ **Performance**: `get_current_html` - 10-50x faster HTML extraction without page reload
- 🧪 **Test infrastructure**: Separated unit (158 tests, CI-safe) and integration tests (37 tests)
- 🔧 **Test runner**: `npm test` runs all, `npm run test:ci` for CI/CD (no browser)
- 📦 **Codebase**: Refactored from monolithic to clean modular architecture

### VS Code Extension
- 🔒 **Version pinning**: Extension now installs specific npm version (not @latest)
- 📝 **Documentation**: Updated deployment checklist with version sync steps

### Documentation
- 📚 **New docs**: `EXAMPLES.md`, `INTERACTIVE_FEATURES.md`, `architecture-html-extraction.md`
- ✅ **Function naming**: All docs updated to use correct snake_case tool names
- 🗂️ **Organization**: Added `.github/instructions/` for AI assistant guidance
- 📄 **LICENSE**: Added to MCPBrowser/ directory for npm distribution

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
