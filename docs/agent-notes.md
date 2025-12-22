# MCPBrowser notes

## What this project does
- Provides an MCP server exposing a `load_and_extract` tool so GitHub Copilot can load authenticated web pages through your Chrome profile.
- **Universal auth handling**: Automatically detects and handles authentication for ANY site (Microsoft, GitHub, AWS, Google, corporate SSO, OAuth, etc.)
- Fetch uses Chrome DevTools Protocol (CDP) to reuse your logged-in Chrome (no creds stored) and returns page text/html to the caller.
- Auto-detects auth redirects by monitoring domain changes and common login URL patterns (`/login`, `/auth`, `/signin`, `/sso`, `/oauth`, `/saml`)
- No local LLM runs here; Copilot supplies the LLM and invokes this tool.

## Distribution
MCPBrowser is available through three channels:
1. **VS Code Extension**: [cherchyk.mcpbrowser-config](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser-config) - One-click automated configuration
2. **npm**: [mcpbrowser](https://www.npmjs.com/package/mcpbrowser) v0.2.1 - Use with `npx mcpbrowser@latest`
3. **MCP Registry**: [io.github.cherchyk/browser](https://registry.modelcontextprotocol.io/) v0.2.1 - Discoverable in the official registry

All three methods configure the same underlying MCP server.

## Components
- `src/mcp-browser.js`: MCP server exposing `load_and_extract`; connects to Chrome via CDP and fetches pages. Single implementation file.
- `extension/`: VS Code extension for automated mcp.json configuration
- `README.md`: Complete installation and usage guide.
- `server.json`: MCP Registry metadata file.

## Copilot integration concept
- GitHub Copilot in VS Code can attach MCP servers. This repo provides `npm run mcp` to start the server exposing the fetch tool.
- Configure VS Code (Copilot Chat) to attach the MCP server command `node src/mcp-browser.js`.
- **Configured to auto-trigger**: mcp.json description instructs Copilot to use this tool automatically on ANY auth barrier (401/403, login redirects, SSO, access denied)
- Copilot handles the LLM; this server only supplies the authenticated fetch tool.

## Auth flow usage
- **Default behavior**: Tabs stay open indefinitely and are reused for same-domain requests to preserve auth sessions.
- Use `keepPageOpen: true` (default) on the first call to leave the tab open and complete login.
- Set `keepPageOpen: false` to close the tab immediately after successful fetch.
- **Domain-aware tab reuse**: Same-domain requests reuse the existing tab; different domains automatically close the old tab and open a new one.
- Optional: `authWaitSelector` to wait for a post-login element (10 min timeout); on timeout the tab stays open so you can finish auth and retry.
- Optional: `waitForUrlPattern` to specify exact URL pattern for auth redirect completion.

## Chrome/auth assumptions
- MCP server will auto-launch Chrome/Edge with remote debugging if none is running (defaults: port 9222, `%LOCALAPPDATA%/ChromeAuthProfile`).
- If you start Chrome manually, use `--remote-debugging-port=9222 --user-data-dir=%LOCALAPPDATA%/ChromeAuthProfile` and ensure you are logged in to target sites.
- MCP fetch connects to that Chrome instance, so cookies/sessions are reused.

## Next improvements
- Add Playwright fallback for non-Chrome or headless mode.
- Add selector-based chunking or readability extraction to reduce token usage.
- Add tests for the fetcher tool schema.
