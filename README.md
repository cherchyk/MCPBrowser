# WAAgent (MCP fetch tool with authenticated Chrome)

An MCP server that exposes an authenticated page fetch tool for GitHub Copilot. It drives your signed-in Chrome/Edge via DevTools, reusing your profile to read restricted pages.

## Prereqs
- Chrome or Edge installed.
- Node 18+.

## Install
```bash
npm install
copy .env.example .env  # optional: set Chrome overrides
```

## Run (standard)
```bash
npm run mcp
```
Starts the MCP server (with embedded fetch) and will auto-launch Chrome/Edge with remote debugging if it cannot find an existing DevTools endpoint. Defaults: port `9222`, user data dir `%LOCALAPPDATA%/ChromeAuthProfile`. Override with `CHROME_PATH`, `CHROME_USER_DATA_DIR`, or `CHROME_REMOTE_DEBUG_PORT`.

The old `scripts/start-all.ps1` launcher was removed; it is no longer needed because the MCP server handles Chrome startup.

## Manual Chrome (optional)
If you prefer to start Chrome yourself before running `npm run mcp`:
```bash
npm run chrome
```
Or manually:
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\ChromeAuthProfile"
```
Set `CHROME_PATH` if auto-detect fails; override profile with `CHROME_USER_DATA_DIR`, port with `CHROME_REMOTE_DEBUG_PORT`.

## (Optional) Local runner
There is no local LLM runner now; Copilot provides the LLM and calls this MCP tool. If you need a standalone agent later, we can add one that reuses the fetch logic.

## Use as a Copilot custom agent/tool (MCP server)
- This repo includes an MCP server exposing `fetch_and_extract` for GitHub Copilot in VS Code (fetching is built-in).
- Start it:
```bash
npm run mcp
```
-- Attach in VS Code settings (`github.copilot.chat.modelContextProtocolServers`). Example entry:
```jsonc
[
	{
		"name": "waagent-mcp",
		"command": "node",
		"args": ["${workspaceFolder}/src/mcp-server.js"],
		"description": "Fetches web content from internal/authenticated resources via your signed-in Chrome; use when pages are restricted."
	}
]
```
- In Copilot Chat, you should see the `waagent-mcp` tool; ask it to load a URL and it will drive your signed-in Chrome session.

## How it works
- Tool `fetch_and_extract` (inside the MCP server) drives your live Chrome (DevTools Protocol) so it inherits your auth cookies, returning `text` and `html` (truncated ~200k chars) for analysis.
- GitHub Copilot’s LLM invokes this tool via MCP; this repo itself does not run an LLM.

## Configuration
- `.env`: optional overrides for `CHROME_WS_ENDPOINT`, `CHROME_REMOTE_DEBUG_HOST/PORT`, `CHROME_PATH`, `CHROME_USER_DATA_DIR`.
- To use a specific WS endpoint: set `CHROME_WS_ENDPOINT` from Chrome `chrome://version` DevTools JSON.

## Tips
- If you hit login pages, verify Chrome instance is signed in and the site opens there.
- Use a dedicated profile directory to avoid interfering with your daily Chrome.
- For heavy pages, add `waitForSelector` to ensure post-login content appears before extraction.
