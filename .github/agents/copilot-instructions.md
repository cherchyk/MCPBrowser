# MCPBrowser Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-03

## Active Technologies
- JavaScript (ES Modules), Node.js 18+ + `@modelcontextprotocol/sdk` ^1.25.1, `puppeteer-core` ^23.4.1 (002-site-plugins)
- File-based plugin registry (`plugins.json`), plugin folders on disk (002-site-plugins)
- JavaScript (ES Modules), Node.js 18+ + `@modelcontextprotocol/sdk` ^1.25.1, `puppeteer-core` ^23.4.1, MCPBrowser plugin system (002-site-plugins) (003-gmail-plugin)
- N/A (plugin registry is file-based `plugins.json`, already implemented) (003-gmail-plugin)
- JavaScript (ES modules), Node.js 18+ + Puppeteer-core (for `page.keyboard`, `page.$()`, `page.evaluate()`), MCPBrowser core (responses.js, plugin-loader.js, browser.js, logger.js) (003-gmail-plugin)
- N/A (stateless plugin, no persistence) (003-gmail-plugin)
- JavaScript (ES Modules), Node.js 18+ + MCPBrowser plugin system (002-site-plugins), Puppeteer (page object provided by plugin-action dispatcher), MCPBrowser core responses (`MCPResponse`, `ErrorResponse`) (004-google-calendar-plugin)
- N/A — stateless plugin, no persistence (004-google-calendar-plugin)

- Node.js 18+ (ESM) + puppeteer-core, @modelcontextprotocol/sdk (001-js-action-fallback)

## Project Structure

```text
MCPBrowser/
├── src/
│   ├── actions/
│   ├── browsers/
│   ├── core/
│   └── mcp-browser.js
└── tests/
	├── actions/
	├── browsers/
	├── core/
	├── tool-selection/
	└── run-*.js
```

## Commands

- `cd MCPBrowser && npm install && npm test`
- `cd MCPBrowser && node tests/run-unit.js`
- `cd MCPBrowser && node tests/tool-selection/run-tool-selection-tests.js`

## Code Style

- Node.js ESM modules; structured responses for MCP tools; prefer explicit async/await and try/catch with structured errors.

## Recent Changes
- 004-google-calendar-plugin: Added JavaScript (ES Modules), Node.js 18+ + MCPBrowser plugin system (002-site-plugins), Puppeteer (page object provided by plugin-action dispatcher), MCPBrowser core responses (`MCPResponse`, `ErrorResponse`)
- 003-gmail-plugin: Added JavaScript (ES modules), Node.js 18+ + Puppeteer-core (for `page.keyboard`, `page.$()`, `page.evaluate()`), MCPBrowser core (responses.js, plugin-loader.js, browser.js, logger.js)
- 003-gmail-plugin: Added JavaScript (ES Modules), Node.js 18+ + `@modelcontextprotocol/sdk` ^1.25.1, `puppeteer-core` ^23.4.1, MCPBrowser plugin system (002-site-plugins)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
