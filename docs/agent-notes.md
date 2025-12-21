# WAAgent notes

## What this project does
- Provides an MCP server exposing a `fetch_and_extract` tool so GitHub Copilot can load authenticated web pages through your Chrome profile.
- Fetch uses Chrome DevTools Protocol (CDP) to reuse your logged-in Chrome (no creds stored) and returns page text/html to the caller.
- No local LLM runs here; Copilot supplies the LLM and invokes this tool.

## Components
- `src/mcp-server.js`: MCP server exposing `fetch_and_extract`; connects to Chrome via CDP and fetches pages.
- `src/launch-chrome.js`: Helper to launch Chrome/Edge with remote debugging and profile (optional if auto-launch works).
- `README.md`: Run instructions.

## Copilot integration concept
- GitHub Copilot in VS Code can attach MCP servers. This repo provides `npm run mcp` to start the server exposing the fetch tool.
- Configure VS Code (Copilot Chat) to attach the MCP server command `node src/mcp-server.js`.
- Copilot handles the LLM; this server only supplies the authenticated fetch tool.

## Chrome/auth assumptions
- MCP server will auto-launch Chrome/Edge with remote debugging if none is running (defaults: port 9222, `%LOCALAPPDATA%/ChromeAuthProfile`).
- If you start Chrome manually, use `--remote-debugging-port=9222 --user-data-dir=%LOCALAPPDATA%/ChromeAuthProfile` and ensure you are logged in to target sites.
- MCP fetch connects to that Chrome instance, so cookies/sessions are reused.

## Next improvements
- Add Playwright fallback for non-Chrome or headless mode.
- Add selector-based chunking or readability extraction to reduce token usage.
- Add tests for the fetcher tool schema.
