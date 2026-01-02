# MCPBrowser (MCP Browser)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/cherchyk.mcpbrowser.svg)](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
[![npm version](https://img.shields.io/npm/v/mcpbrowser.svg)](https://www.npmjs.com/package/mcpbrowser)
[![Claude Desktop](https://img.shields.io/badge/Claude-Desktop-5865F2?logo=anthropic)](https://modelcontextprotocol.io/quickstart/user)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**MCPBrowser is an MCP browser server that gives AI assistants the ability to browse web pages using a real Chrome or Edge browser.** This browser-based MCP server lets AI assistants (Claude, Copilot) access any website — especially those protected by authentication, CAPTCHAs, anti-bot restrictions, or requiring JavaScript rendering. Uses your real Chrome/Edge browser session for web automation, so you log in once, and your AI can navigate, click buttons, fill forms, and extract content from sites that block automated requests.

Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), this web browser MCP server works seamlessly with Claude Desktop, Claude Code (CLI), GitHub Copilot, and any MCP-compatible AI assistant. It handles corporate SSO, CAPTCHAs, Cloudflare protection, SPAs, dashboards, and any site that blocks automated requests. Your AI gets the same browser access you have — no special APIs, no headless browser detection, just your authenticated browser session.

Example workflow for AI assistant to use MCPBrowser

```
1. fetch_webpage    → Load the login page
2. type_text        → Enter username
3. type_text        → Enter password
4. click_element    → Click "Sign In"
5. get_current_html → Extract the content after login
```


## Contents

- [Requirements](#requirements)
- [Installation](#installation)
  - [VS Code Extension](#option-1-vs-code-extension)
  - [Claude Code](#option-2-claude-code)
  - [Claude Desktop](#option-3-claude-desktop)
  - [npm Package](#option-4-npm-package)
- [MCP Tools](#mcp-tools)
  - [fetch_webpage](#fetch_webpage)
  - [click_element](#click_element)
  - [type_text](#type_text)
  - [get_current_html](#get_current_html)
  - [close_tab](#close_tab)
- [Configuration](#configuration-optional)
- [Troubleshooting](#troubleshooting)
- [For Developers](#for-developers)
- [Links](#links)
- [License](#license)

## Requirements

- Chrome or Edge browser
- Node.js 18+

## Installation

| # | Platform | Difficulty |
|---|----------|------------|
| 1 | [VS Code Extension](#option-1-vs-code-extension) | One Click |
| 2 | [Claude Code](#option-2-claude-code) | One Command |
| 3 | [Claude Desktop](#option-3-claude-desktop) | Manual |
| 4 | [npm Package](#option-4-npm-package) | Manual |

### Option 1: VS Code Extension

Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser) or run:
```bash
code --install-extension cherchyk.mcpbrowser
```

The extension automatically installs and configures everything for GitHub Copilot.

### Option 2: Claude Code

```bash
claude mcp add mcpbrowser --scope user -- npx -y mcpbrowser@latest
```

Verify it's working:
```bash
claude mcp list
```

You should see:
```
mcpbrowser: npx -y mcpbrowser@latest - ✓ Connected
```

That's it! Ask Claude to fetch any protected page:
> "Fetch https://portal.azure.com using mcpbrowser"

### Option 3: Claude Desktop

Add to your config file:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

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

Restart Claude Desktop after saving.

### Option 4: npm Package

For VS Code (GitHub Copilot) manual setup, add to your `mcp.json`:

**Windows:** `%APPDATA%\Code\User\mcp.json`
**Mac/Linux:** `~/.config/Code/User/mcp.json`

```json
{
  "servers": {
    "MCPBrowser": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

## MCP Tools

### `fetch_webpage`

Fetches web pages using your Chrome/Edge browser. Handles authentication, CAPTCHA, SSO, anti-bot protection, and JavaScript-heavy sites. Opens the URL in a browser tab (reuses existing tab for same domain) and waits for the page to fully load before returning content.

**Parameters:**
- `url` (string, required) - The URL to fetch
- `removeUnnecessaryHTML` (boolean, optional, default: `true`) - Remove unnecessary HTML for size reduction by ~90%
- `postLoadWait` (number, optional, default: `1000`) - Milliseconds to wait after page load for SPAs to render dynamic content

**Examples:**
```javascript
// Basic fetch
{ url: "https://example.com" }

// Fetch with custom wait time for slow SPAs
{ url: "https://dashboard.example.com", postLoadWait: 2000 }

// Keep full HTML without cleanup
{ url: "https://example.com", removeUnnecessaryHTML: false }
```

---

### `click_element`

Clicks on any clickable element (buttons, links, divs with onclick handlers, etc.). Can target by CSS selector or visible text content. Automatically scrolls element into view and waits for page stability after clicking.

**⚠️ Note:** Page must be already loaded via `fetch_webpage` first.

**Parameters:**
- `url` (string, required) - The URL of the page (must match a previously fetched page)
- `selector` (string, optional) - CSS selector for the element (e.g., `#submit-btn`, `.login-button`)
- `text` (string, optional) - Text content to search for if selector not provided (e.g., "Sign In", "Submit")
- `returnHtml` (boolean, optional, default: `true`) - Whether to wait for stability and return HTML after clicking. Set to `false` for fast form interactions (checkboxes, radio buttons)
- `removeUnnecessaryHTML` (boolean, optional, default: `true`) - Remove unnecessary HTML for size reduction. Only used when `returnHtml` is `true`
- `postClickWait` (number, optional, default: `1000`) - Milliseconds to wait after click for SPAs to render dynamic content
- `waitForElementTimeout` (number, optional, default: `1000`) - Maximum time to wait for element in milliseconds

**Examples:**
```javascript
// Click by text content
{ url: "https://example.com", text: "Sign In" }

// Click by CSS selector
{ url: "https://example.com", selector: "#login-button" }

// Click without waiting for HTML (fast checkbox toggle)
{ url: "https://example.com", selector: "#agree-checkbox", returnHtml: false }

// Click with custom wait time
{ url: "https://example.com", text: "Load More", postClickWait: 2000 }
```

---

### `type_text`

Types text into an input field, textarea, or other editable element. Simulates human-like typing with configurable delay between keystrokes. Automatically clears existing text by default.

**⚠️ Note:** Page must be already loaded via `fetch_webpage` first.

**Parameters:**
- `url` (string, required) - The URL of the page (must match a previously fetched page)
- `selector` (string, required) - CSS selector for the input element (e.g., `#username`, `input[name="email"]`)
- `text` (string, required) - Text to type into the field
- `clear` (boolean, optional, default: `true`) - Whether to clear existing text first
- `typeDelay` (number, optional, default: `50`) - Delay between keystrokes in milliseconds (simulates human typing)
- `returnHtml` (boolean, optional, default: `true`) - Whether to wait for stability and return HTML after typing
- `removeUnnecessaryHTML` (boolean, optional, default: `true`) - Remove unnecessary HTML for size reduction. Only used when `returnHtml` is `true`
- `postTypeWait` (number, optional, default: `1000`) - Milliseconds to wait after typing for SPAs to render dynamic content
- `waitForElementTimeout` (number, optional, default: `5000`) - Maximum time to wait for element in milliseconds

**Examples:**
```javascript
// Basic text input
{ url: "https://example.com", selector: "#email", text: "user@example.com" }

// Append text without clearing
{ url: "https://example.com", selector: "#search", text: " advanced", clear: false }

// Fast typing without human simulation
{ url: "https://example.com", selector: "#username", text: "john", typeDelay: 0 }

// Type without waiting for HTML return (faster)
{ url: "https://example.com", selector: "#field", text: "value", returnHtml: false }
```

---

### `get_current_html`

Gets the current HTML from an already-loaded page **WITHOUT** navigating or reloading. Much faster than `fetch_webpage` since it only extracts the current DOM state. Use this after interactions (click, type) to get the updated page content efficiently.

**⚠️ Note:** Page must be already loaded via `fetch_webpage` first.

**Parameters:**
- `url` (string, required) - The URL of the page (must match a previously fetched page)
- `removeUnnecessaryHTML` (boolean, optional, default: `true`) - Remove unnecessary HTML for size reduction by ~90%

**Examples:**
```javascript
// Get current HTML after interactions
{ url: "https://example.com" }

// Get full HTML without cleanup
{ url: "https://example.com", removeUnnecessaryHTML: false }
```

**Performance comparison:**
- `fetch_webpage`: 2-5 seconds (full page reload)
- `get_current_html`: 0.1-0.3 seconds (just extracts HTML) ✅

---

### `close_tab`

Closes the browser tab for the given URL's hostname. Removes the page from the tab pool and forces a fresh session on the next visit to that hostname. Useful for clearing authentication state, managing memory, or starting fresh with a domain.

**⚠️ Note:** Uses exact hostname match (`www.example.com` and `example.com` are treated as different tabs).

**Parameters:**
- `url` (string, required) - The URL whose hostname tab should be closed

**Examples:**
```javascript
// Close tab for a domain
{ url: "https://example.com" }

// This will close the tab for portal.azure.com
{ url: "https://portal.azure.com/dashboard" }
```

**Use cases:**
- Clear authentication/session state
- Free up browser memory
- Reset to fresh state before new login

---

## Configuration (Optional)

Environment variables for advanced setup:

| Variable | Description | Default |
|----------|-------------|---------|
| `CHROME_PATH` | Path to Chrome/Edge | Auto-detect |
| `CHROME_USER_DATA_DIR` | Browser profile directory | `%LOCALAPPDATA%/ChromeAuthProfile` |
| `CHROME_REMOTE_DEBUG_PORT` | DevTools port | `9222` |

## Troubleshooting

**Browser doesn't open?**
- Make sure Chrome or Edge is installed
- Try setting `CHROME_PATH` explicitly

**Can't connect to browser?**
- Close all Chrome instances and try again
- Check if port 9222 is in use

**Authentication not preserved?**
- Keep the browser tab open (default behavior)
- Use the same domain for related requests

## For Developers

## For Developers

**Clone and setup:**
```bash
git clone https://github.com/cherchyk/MCPBrowser.git
cd MCPBrowser
npm run install:all  # Installs dependencies for all workspace packages
```

**Run tests:**
```bash
# Test everything
npm test

# Test MCP server only
npm run test:mcp

# Test extension only
npm run test:extension
```

## Links

- [GitHub](https://github.com/cherchyk/MCPBrowser)
- [npm](https://www.npmjs.com/package/mcpbrowser)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
- [Issues](https://github.com/cherchyk/MCPBrowser/issues)

## License

MIT
