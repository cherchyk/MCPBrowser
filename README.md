# MCP Browser (MCP fetch for protected web resources)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/cherchyk.mcpbrowser.svg)](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
[![npm version](https://img.shields.io/npm/v/mcpbrowser.svg)](https://www.npmjs.com/package/mcpbrowser)
[![Claude Desktop](https://img.shields.io/badge/Claude-Desktop-5865F2?logo=anthropic)](https://modelcontextprotocol.io/quickstart/user)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Enables Claude Code, GitHub Copilot, and Claude Desktop to fetch protected web pages** - handles login-protected web pages, corporate SSO, and anti-crawler restrictions that normal fetching can't handle. Uses your Chrome/Edge browser session via DevTools Protocol.

## 🚀 Installation Options

### Option 1: VS Code Extension (Easiest - One Click)

**From VS Code Marketplace:**
```bash
code --install-extension cherchyk.mcpbrowser
```
Or search "MCPBrowser" in VS Code Extensions view.

**From GitHub Release:**
Download from [GitHub Releases](https://github.com/cherchyk/MCPBrowser/releases):
```bash
code --install-extension mcpbrowser-0.2.32.vsix
```

The extension automatically:
- Installs the MCPBrowser npm package globally
- Configures mcp.json for Claude Code & GitHub Copilot
- Complete one-click setup - no manual steps needed

📦 [View on Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)

### Option 2: npm Package (Recommended for Manual Setup)
Published on npm as [mcpbrowser](https://www.npmjs.com/package/mcpbrowser) v0.2.32.

Add to your `mcp.json`:
```jsonc
"MCPBrowser": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "mcpbrowser@latest"],
  "description": "Web page fetching via browser for sites requiring authentication, anti-bot protection, or JavaScript rendering. Use when standard HTTP requests fail for: (1) auth-required pages (401/403, SSO, corporate intranets), (2) anti-bot verification (CAPTCHA, Cloudflare), (3) JavaScript-heavy sites (SPAs, dynamic content). Opens a browser where the user can authenticate, then automatically extracts content."
}
```

**mcp.json Location:**
- Windows: `%APPDATA%\Code\User\mcp.json`
- Mac/Linux: `~/.config/Code/User/mcp.json`

### Option 3: MCP Registry
Available in the [MCP Registry](https://registry.modelcontextprotocol.io/) as `io.github.cherchyk/browser` v0.2.32.

Search for "browser" in the registry to find configuration instructions.

### Option 4: Claude Desktop
Add to your Claude Desktop config file:

**Config Location:**
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "MCPBrowser": {
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

Restart Claude Desktop after configuration.

### Option 5: Clone from GitHub (Development)
```bash
git clone https://github.com/cherchyk/MCPBrowser.git
cd MCPBrowser
npm install
```

## Prereqs
- Chrome or Edge installed.
- Node 18+.

## Run (automatic via AI assistants)
- Add the MCP server entry to your AI assistant's config (see installation options above). The AI assistant will start the server automatically when it needs the tool—no manual launch required.
- On first use, the server auto-launches Chrome/Edge with remote debugging if it cannot find an existing DevTools endpoint. Defaults: port `9222`, user data dir `%LOCALAPPDATA%/ChromeAuthProfile`. Override with `CHROME_PATH`, `CHROME_USER_DATA_DIR`, or `CHROME_REMOTE_DEBUG_PORT`.
- Chrome startup is handled inside the MCP server.

## Manual start (optional)
Only if you want to run it yourself (AI assistants already start it when configured):
```bash
npm run mcp
```
Or manually:
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\ChromeAuthProfile"
```
Set `CHROME_PATH` if auto-detect fails; override profile with `CHROME_USER_DATA_DIR`, port with `CHROME_REMOTE_DEBUG_PORT`.

## (Optional) Local runner
There is no local LLM runner now; AI assistants (Claude Code, GitHub Copilot, Claude Desktop) provide the LLM and call this MCP tool. If you need a standalone agent later, we can add one that reuses the fetch logic.

## Configure in VS Code (Claude Code & GitHub Copilot)

### Step 1: Locate your mcp.json file
- **Windows**: `%APPDATA%\Code\User\mcp.json`
- **Linux/Mac**: `~/.config/Code/User/mcp.json`

### Step 2: Add MCPBrowser server configuration

Add this entry to your `mcp.json` file under the `"servers"` section:

```jsonc
"MCPBrowser": {
	"type": "stdio",
	"command": "node",
	"args": ["<PATH_TO_MCPBROWSER>/src/mcp-browser.js"],
	"description": "Web page fetching via browser for sites requiring authentication, anti-bot protection, or JavaScript rendering. Use when standard HTTP requests fail for: (1) auth-required pages (401/403, SSO, corporate intranets), (2) anti-bot verification (CAPTCHA, Cloudflare), (3) JavaScript-heavy sites (SPAs, dynamic content). Opens a browser where the user can authenticate, then automatically extracts content."
}
```

Replace `<PATH_TO_MCPBROWSER>` with the full path where you cloned this repository, for example:
- Windows: `"D:/dev/MCPBrowser/src/mcp-browser.js"`
- Linux/Mac: `"/home/user/MCPBrowser/src/mcp-browser.js"`

### Step 3: Reload VS Code
Restart VS Code or reload the window for the changes to take effect.

### Step 4: Verify
In Claude Code or Copilot Chat, you should see the `MCPBrowser` server listed. Ask it to fetch an authenticated URL and it will drive your signed-in Chrome session.

## How it works
- Tool `fetch_webpage_protected` (inside the MCP server) drives your live Chrome/Edge (DevTools Protocol) so it inherits your auth cookies, returning `html` (truncated up to 2M chars) for analysis.
- **Smart confirmation**: AI assistant asks for confirmation ONLY on first request to a new domain - explains browser will open for authentication. Subsequent requests to same domain work automatically (session preserved).
- **Domain-aware tab reuse**: Automatically reuses the same tab for URLs on the same domain, preserving authentication session. Different domains open new tabs.
- **Automatic page loading**: Waits for network idle (`networkidle0`) by default, ensuring JavaScript-heavy pages (SPAs, dashboards) fully load before returning content.
- **Automatic auth detection**: Detects ANY authentication redirect (domain changes, login/auth/sso/oauth URLs) and waits for you to complete sign-in, then returns to target page.
- **Universal compatibility**: Works with ANY authenticated site - corporate intranets, SSO, OAuth, SAML, login pages, etc.
- **Smart timeouts**: 60s default for page fetch, 10 min for auth redirects. Tabs stay open indefinitely for reuse (no auto-close).
- The AI assistant's LLM invokes this tool via MCP; this repo itself does not run an LLM.

## Auth-assisted fetch flow
- AI assistant can call with just the URL, or with no params if you set an env default (`DEFAULT_FETCH_URL` or `MCP_DEFAULT_FETCH_URL`). By default tabs stay open indefinitely for reuse (domain-aware).
- First call opens the tab and leaves it open so you can sign in. No extra params needed.
- After you sign in, call the same URL again; tab stays open for reuse. Set `keepPageOpen: false` to close immediately on success.
- Optional fields (`authWaitSelector`, `waitForSelector`, `waitForUrlPattern`, etc.) are available but not required.

## Configuration
Optional environment variables for advanced configuration:
- `CHROME_PATH`: Custom path to Chrome/Edge executable
- `CHROME_USER_DATA_DIR`: Custom browser profile directory
- `CHROME_REMOTE_DEBUG_HOST`: DevTools host (default: `127.0.0.1`)
- `CHROME_REMOTE_DEBUG_PORT`: DevTools port (default: `9222`)
- `CHROME_WS_ENDPOINT`: Explicit WebSocket endpoint URL
- `DEFAULT_FETCH_URL` or `MCP_DEFAULT_FETCH_URL`: Default URL when called without params

Set these in your shell or system environment before running the MCP server.

## Tips
- **Universal auth**: Works with ANY authenticated site - corporate intranets, SSO, OAuth, SAML, login pages, CAPTCHA, human verification, etc.
- **No re-authentication needed**: Automatically reuses the same tab for URLs on the same domain, keeping your auth session alive across multiple page fetches
- **Automatic page loading**: Tool waits for pages to fully load (default 60s timeout, waits for network idle). AI assistant should trust the tool and not retry manually.
- **Auth redirect handling**: Auto-detects auth redirects by monitoring domain changes and common login URL patterns (`/login`, `/auth`, `/signin`, `/sso`, `/oauth`, `/saml`)
- **Tabs stay open**: By default tabs remain open indefinitely for reuse. Set `keepPageOpen: false` to close immediately after successful fetch.
- **Smart domain switching**: When switching domains, automatically closes the old tab and opens a new one to prevent tab accumulation
- If you hit login pages, verify Chrome/Edge instance is signed in and the site opens there.
- Use a dedicated profile directory to avoid interfering with your daily browser.
- For heavy pages, add `waitForSelector` to ensure post-login content appears before extraction.
