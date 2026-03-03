# MCPBrowser Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-03

## Active Technologies

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

- 001-js-action-fallback: Added Node.js 18+ (ESM) + puppeteer-core, @modelcontextprotocol/sdk

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
