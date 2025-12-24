# Change Log

All notable changes to the "mcpbrowser" extension will be documented in this file.

## [0.2.18] - 2025-12-23

### Changed
- Re-deployment with complete checklist compliance
- All version references synchronized across project

## [0.2.17] - 2025-12-23

### Changed
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

### Changed
- Documentation cleanup: Removed outdated NEXT_STEPS.md and EXTENSION_README.md
- Improved .vscodeignore to exclude package-lock.json from extension package
- Enhanced agent-notes.md with detailed persistent retry strategy planning

## [0.2.15] - 2025-12-22

### Changed
- **Renamed tool**: `load_and_extract` → `fetch_webpage_protected` for better alignment with standard `fetch_webpage` tool
- Tool name now clearly indicates it's the protected/authenticated version of webpage fetching
- Makes it easier for Copilot to recognize when to use this tool vs standard fetch
- **Enhanced retry guidance**: Added explicit instructions for AI agents to retry 2-3 times with 10-30s delays when encountering login pages
- Prevents premature "authentication required" failures when user is actively authenticating

## [0.2.14] - 2025-12-22

### Changed
- **Improved deployment checklist**: Added requirement to ask user for deployment confirmation before proceeding
- Prevents automatic deployment when user may have additional changes planned
- Deployment only proceeds without asking when explicitly requested

## [0.2.13] - 2025-12-22

### Changed
- **Improved tool description** to make MCPBrowser the PRIMARY choice for authenticated/protected websites
- Tool now explicitly mentions common use cases: internal/corporate sites (*.microsoft.com, *.eng.ms), SSO/OAuth pages, paywalled content
- Enhanced guidance for AI agents to prefer MCPBrowser over generic URL fetchers for authenticated content
- Better automatic tool selection by GitHub Copilot for protected resources

## [0.2.12] - 2025-12-22

### Changed
- Updated deployment checklist order
- Added Chrome flags to suppress first-run prompts (--no-first-run, --no-default-browser-check, --disable-sync)
- Fixed Chrome "Sign in to Chrome" prompt appearing with dedicated debug profile

## [0.2.7] - 2025-12-22

### Changed
- Synced extension version with npm package (now both 0.2.7)
- Versions will now always match for easier tracking

## [0.2.6] - 2025-12-22 (skipped for extension)

## [0.1.6] - 2025-12-22

### Changed
- Updated display name from "MCPBrowser" to "MCP Browser" for better readability
- All user-facing text now uses "MCP Browser" (technical identifiers remain unchanged)
- Improved marketplace presentation with proper spacing

## [0.1.5] - 2025-12-22

### Changed
- Updated to mcpbrowser@0.2.5 with improved VS Code confirmation experience
- Added proper tool title annotation ("Fetch Protected Web Page")
- Enhanced description with warning emoji for clarity
- Uses default Chrome profile with saved passwords, extensions, and authenticated sessions
- Cross-platform support (Windows, macOS, Linux)

## [0.1.4] - 2025-12-22

### Added
- Smart confirmation: Only asks user on first fetch to a domain
- Subsequent authenticated requests work automatically (session preserved)
- Updated tool description for better UX

## [0.1.3] - 2025-12-22

### Added
- Improved positioning as fallback/alternative tool
- Simplified README with practical usage examples
- Added "How It Works" section explaining browser and auth flow

## [0.1.2] - 2025-12-22

### Added
- Automatic npm package installation
- All-in-one installation experience

## [0.1.1] - 2025-12-22

### Changed
- Renamed from mcpbrowser-config to mcpbrowser for cleaner URL

## [0.1.0] - 2025-12-22

### Added
- Initial release
- One-click MCP Browser configuration for GitHub Copilot
- Automatic detection and notification prompt
- Command to add MCP Browser to mcp.json
- Command to remove MCP Browser from mcp.json
- Smart handling of existing configurations
- Cross-platform support (Windows, macOS, Linux)
