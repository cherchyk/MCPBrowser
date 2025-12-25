# Changelog

## [0.2.28] - 2025-12-24

### Changed
- Improved agent-notes.md deployment checklist with stronger safeguards
- Removed exception clause - deployment confirmation now always required
- Reorganized agent-notes.md structure (project info before deployment steps)
- Cleaned up outdated documentation from agent-notes.md

## [0.2.27] - 2025-12-24

### Changed
- Updated VS Code extension icon with modern MCP Browser branding design
- New icon features bold "MCP" typography with "BROWSER" subtitle for better brand visibility

## [0.2.19] - 2025-01-27

### Added
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

### Changed
- Removed HTML truncation - prepareHtml cleanup makes it unnecessary
- Integration tests now use HTML from fetch step (no re-fetch)
- Tests exit immediately with `process.exit(0)` after completion

### Fixed
- Static asset URLs no longer included in test URL extraction
- HTML reuse pattern prevents unnecessary re-fetching

## [0.2.18] - 2025-01-26

### Added
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

### Technical Improvements
- Better hostname extraction and normalization
- Improved tab lifecycle management
- Enhanced error handling for authentication timeout

## [0.2.0] - Previous releases

Initial implementation with basic browser automation and MCP server integration.
