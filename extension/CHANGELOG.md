# Change Log

All notable changes to the "mcpbrowser" extension will be documented in this file.

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
- Added proper tool title annotation ("Access Authenticated Web Page")
- Enhanced description with warning emoji for clarity
- Uses default Chrome profile with saved passwords, extensions, and authenticated sessions
- Cross-platform support (Windows, macOS, Linux)

## [0.1.4] - 2025-12-22

### Added
- Smart confirmation: Only asks user on first access to a domain
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
