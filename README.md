# MCPBrowser (MCP fetch tool with authenticated Chrome)

An MCP server that exposes an authenticated page fetch tool for GitHub Copilot. It drives your signed-in Chrome/Edge via DevTools, reusing your profile to read restricted pages.

## Quick Install

### Option 1: Install from GitHub (Recommended)
```bash
git clone https://github.com/cherchyk/MCPBrowser.git
cd MCPBrowser
npm install
copy .env.example .env  # optional: set Chrome overrides
```

### Option 2: Install via npx (when published to npm)
```bash
npx mcpbrowser
```

## Prereqs
- Chrome or Edge installed.
- Node 18+.

## Run (automatic via Copilot)
- Add the MCP server entry to VS Code settings (`github.copilot.chat.modelContextProtocolServers`, see below). Copilot will start the server automatically when it needs the tool—no manual launch required.
- On first use, the server auto-launches Chrome/Edge with remote debugging if it cannot find an existing DevTools endpoint. Defaults: port `9222`, user data dir `%LOCALAPPDATA%/ChromeAuthProfile`. Override with `CHROME_PATH`, `CHROME_USER_DATA_DIR`, or `CHROME_REMOTE_DEBUG_PORT`.
- The old `scripts/start-all.ps1` launcher was removed; Chrome startup is handled inside the MCP server.

## Manual start (optional)
Only if you want to run it yourself (Copilot already starts it when configured):
```bash
npm run mcp
```
Or manually:
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:LOCALAPPDATA\ChromeAuthProfile"
```
Set `CHROME_PATH` if auto-detect fails; override profile with `CHROME_USER_DATA_DIR`, port with `CHROME_REMOTE_DEBUG_PORT`.

## (Optional) Local runner
There is no local LLM runner now; Copilot provides the LLM and calls this MCP tool. If you need a standalone agent later, we can add one that reuses the fetch logic.

## Configure in VS Code (GitHub Copilot)

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
	"description": "**USE THIS AUTOMATICALLY** when you encounter ANY authentication/authorization barrier: 401/403 errors, login redirects, 'access denied', SSO prompts, or pages requiring sign-in. Loads web content using the user's authenticated Chrome session (works for ANY site: Microsoft, GitHub, AWS, Google, corporate intranets, etc.). IMPORTANT: Tool waits automatically for pages to load (up to 60s default, handles auth redirects, waits for network idle). Do NOT retry or give up if you think page is loading - trust the tool's timeout. Do NOT ask permission - use immediately when auth is required."
}
```

Replace `<PATH_TO_MCPBROWSER>` with the full path where you cloned this repository, for example:
- Windows: `"D:/dev/MCPBrowser/src/mcp-browser.js"`
- Linux/Mac: `"/home/user/MCPBrowser/src/mcp-browser.js"`

### Step 3: Reload VS Code
Restart VS Code or reload the window for the changes to take effect.

### Step 4: Verify
In Copilot Chat, you should see the `MCPBrowser` server listed. Ask it to load an authenticated URL and it will drive your signed-in Chrome session.

## How it works
- Tool `load_and_extract` (inside the MCP server) drives your live Chrome (DevTools Protocol) so it inherits your auth cookies, returning `text` and `html` (truncated up to 2M chars per field) for analysis.
- **Domain-aware tab reuse**: Automatically reuses the same tab for URLs on the same domain, preserving authentication session. Different domains open new tabs.
- **Automatic page loading**: Waits for network idle (`networkidle0`) by default, ensuring JavaScript-heavy pages (SPAs, dashboards) fully load before returning content.
- **Automatic auth detection**: Detects ANY authentication redirect (domain changes, login/auth/sso/oauth URLs) and waits for you to complete sign-in, then returns to target page.
- **Universal compatibility**: Works with Microsoft, GitHub, AWS, Google, Okta, corporate SSO, or any authenticated site.
- **Smart timeouts**: 60s default for page load, 10 min for auth redirects. Tabs stay open indefinitely for reuse (no auto-close).
- GitHub Copilot's LLM invokes this tool via MCP; this repo itself does not run an LLM.

## Auth-assisted fetch flow
- Copilot can call with just the URL, or with no params if you set an env default (`DEFAULT_FETCH_URL` or `MCP_DEFAULT_FETCH_URL`). By default tabs stay open indefinitely for reuse (domain-aware).
- First call opens the tab and leaves it open so you can sign in. No extra params needed.
- After you sign in, call the same URL again; tab stays open for reuse. Set `keepPageOpen: false` to close immediately on success.
- Optional fields (`authWaitSelector`, `waitForSelector`, `waitForUrlPattern`, etc.) are available but not required.

## Configuration
- `.env`: optional overrides for `CHROME_WS_ENDPOINT`, `CHROME_REMOTE_DEBUG_HOST/PORT`, `CHROME_PATH`, `CHROME_USER_DATA_DIR`.
- To use a specific WS endpoint: set `CHROME_WS_ENDPOINT` from Chrome `chrome://version` DevTools JSON.

## Tips
- **Universal auth**: Works with ANY authenticated site (Microsoft, GitHub, AWS, Google, corporate intranets, SSO, OAuth, etc.)
- **No re-authentication needed**: Automatically reuses the same tab for URLs on the same domain, keeping your auth session alive across multiple page fetches
- **Automatic page loading**: Tool waits for pages to fully load (default 60s timeout, waits for network idle). Copilot should trust the tool and not retry manually.
- **Auth redirect handling**: Auto-detects auth redirects by monitoring domain changes and common login URL patterns (`/login`, `/auth`, `/signin`, `/sso`, `/oauth`, `/saml`)
- **Tabs stay open**: By default tabs remain open indefinitely for reuse. Set `keepPageOpen: false` to close immediately after successful fetch.
- **Smart domain switching**: When switching domains, automatically closes the old tab and opens a new one to prevent tab accumulation
- If you hit login pages, verify Chrome instance is signed in and the site opens there.
- Use a dedicated profile directory to avoid interfering with your daily Chrome.
- For heavy pages, add `waitForSelector` to ensure post-login content appears before extraction.
