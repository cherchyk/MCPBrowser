# ✅ MCPBrowser (MCP Browser)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/cherchyk.mcpbrowser.svg)](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
[![npm version](https://img.shields.io/npm/v/mcpbrowser.svg)](https://www.npmjs.com/package/mcpbrowser)
[![Claude Desktop](https://img.shields.io/badge/Claude-Desktop-5865F2?logo=anthropic)](https://modelcontextprotocol.io/quickstart/user)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> ⚠️ **Security Notice:** MCPBrowser extracts webpage content and provides it to your AI agent (e.g., GitHub Copilot, Claude), which then sends it to the LLM provider it uses (e.g., Anthropic, OpenAI, GitHub) for processing. Make sure you trust both your agent and the LLM provider — especially when accessing pages with sensitive or private data.

**MCPBrowser is an MCP browser server that gives AI assistants the ability to browse web pages using a real Chrome, Edge, or Brave browser.** This browser-based MCP server fetches any web page — especially those protected by authentication, CAPTCHAs, anti-bot protection, or requiring JavaScript rendering. Uses your real browser for web automation so you can log in normally, then automatically extracts content. Works with corporate SSO, login forms, Cloudflare, and JavaScript-heavy sites (SPAs, dashboards).

This is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server using [stdio transport](https://modelcontextprotocol.io/docs/concepts/transports#stdio). Your AI assistant uses this web browser MCP server when standard HTTP requests fail — pages requiring authentication, CAPTCHA protection, or heavy JavaScript (SPAs). Once connected, the browser MCP server can navigate through websites, interact with elements, and send HTML back to the AI assistant. This gives your AI the ability to browse the web just like you do.

Example workflow for AI assistant to use MCPBrowser

```
1. fetch_webpage    → Load the login page
2. type_text        → Enter username and password (multiple fields at once)
3. click_element    → Click "Sign In"
4. get_current_html → Extract the content after login
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
  - [scroll_page](#scroll_page)
  - [take_screenshot](#take_screenshot)
  - [close_tab](#close_tab)
- [Configuration](#configuration-optional)
- [Troubleshooting](#troubleshooting)
- [Links](#links)

## Requirements

- Chrome, Edge, or Brave browser
- [Node.js 18+](https://nodejs.org/) (includes npm)

> **Note:** Node.js must be installed on your system. The VS Code extension and npm package both require Node.js to run the MCP server. Download from [nodejs.org](https://nodejs.org/) if not already installed.

## Installation

| # | Platform | Difficulty |
|---|----------|------------|
| 1 | [VS Code Extension](#option-1-vs-code-extension) | One Click |
| 2 | [Claude Code](#option-2-claude-code) | One Command |
| 3 | [OpenClaw](#option-3-openclaw) | One Command |
| 4 | [Claude Desktop](#option-4-claude-desktop) | Manual |
| 5 | [npm Package](#option-5-npm-package) | Manual |

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

### Option 3: OpenClaw

[OpenClaw](https://openclaw.ai/) is a personal AI assistant that runs on your devices. Add MCPBrowser to give it browser automation capabilities:

```bash
openclaw mcp add mcpbrowser -- npx -y mcpbrowser@latest
```

Verify it's working:
```bash
openclaw mcp list
```

Now OpenClaw can browse authenticated pages, fill forms, and interact with web apps using your existing browser sessions.

### Option 4: Claude Desktop

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

### Option 5: npm Package

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

Fetches web pages using your Chrome/Edge browser. Handles authentication, CAPTCHA, SSO, anti-bot protection, and JavaScript-heavy sites. Opens the URL in a browser tab (reuses existing tab for same domain) and waits for the page to fully load before returning content. **Automatically detects SPAs** (React, Vue, Angular) and waits for JavaScript to render content.

**Parameters:**
- `url` (string, required) - The URL to fetch
- `removeUnnecessaryHTML` (boolean, optional, default: `true`) - Remove unnecessary HTML for size reduction by ~90%
- `postLoadWait` (number, optional, default: `0`) - Additional milliseconds to wait after page load before extracting HTML. Use for pages that need extra time to render.

**Examples:**
```javascript
// Basic fetch
{ url: "https://example.com" }

// Fetch with extra wait time for slow-rendering pages
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

Types text into one or more input fields in a single call. Supports filling entire forms at once for efficient automation. Automatically clears existing text by default.

**⚠️ Note:** Page must be already loaded via `fetch_webpage` first.

**Parameters:**
- `url` (string, required) - The URL of the page (must match a previously fetched page)
- `fields` (array, required) - Array of fields to fill. Each field object contains:
  - `selector` (string, required) - CSS selector for the input element (e.g., `#username`, `input[name="email"]`)
  - `text` (string, required) - Text to type into the field
  - `clear` (boolean, optional, default: `true`) - Whether to clear existing text first
  - `waitForElementTimeout` (number, optional, default: `5000`) - Maximum time to wait for element in milliseconds
- `returnHtml` (boolean, optional, default: `true`) - Whether to wait for stability and return HTML after typing
- `removeUnnecessaryHTML` (boolean, optional, default: `true`) - Remove unnecessary HTML for size reduction. Only used when `returnHtml` is `true`
- `postTypeWait` (number, optional, default: `1000`) - Milliseconds to wait after typing for SPAs to render dynamic content

**Examples:**
```javascript
// Fill multiple fields at once (login form)
{ 
  url: "https://example.com/login", 
  fields: [
    { selector: "#username", text: "john@example.com" },
    { selector: "#password", text: "secretpass123" }
  ]
}

// Single field input
{ url: "https://example.com", fields: [{ selector: "#search", text: "query" }] }

// Append text without clearing
{ url: "https://example.com", fields: [{ selector: "#notes", text: " additional text", clear: false }] }

// Fast form fill without HTML return
{ 
  url: "https://example.com/signup", 
  fields: [
    { selector: "#firstName", text: "John" },
    { selector: "#lastName", text: "Doe" },
    { selector: "#email", text: "john@example.com" }
  ],
  returnHtml: false 
}
```

**Error handling:** If a field fails, the response indicates:
- Which field number failed (e.g., "Failed on field 2 of 3")
- Which fields were successfully filled
- Clear guidance to NOT re-type already filled fields

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

### `scroll_page`

Scrolls within an already-loaded page. Use before `take_screenshot` to capture different parts of the page, or to bring elements into view before interaction. Supports multiple scroll modes:

- **By direction**: Scroll up/down/left/right by pixel amount
- **To element**: Scroll until a specific element is visible
- **To position**: Scroll to absolute coordinates

**⚠️ Note:** Page must be already loaded via `fetch_webpage` first.

**Parameters:**
- `url` (string, required) - The URL of the page (must match a previously fetched page)
- `direction` (string, optional) - Direction to scroll: `up`, `down`, `left`, `right`. Use with `amount`.
- `amount` (number, optional, default: `500`) - Pixels to scroll in the specified direction (~half a viewport)
- `selector` (string, optional) - CSS selector of element to scroll into view. Ignores direction/amount.
- `x` (number, optional) - Absolute horizontal scroll position. Use with `y`.
- `y` (number, optional) - Absolute vertical scroll position. Use with `x`.

**Examples:**
```javascript
// Scroll down by 500px (default)
{ url: "https://example.com", direction: "down" }

// Scroll down by 1000px
{ url: "https://example.com", direction: "down", amount: 1000 }

// Scroll an element into view
{ url: "https://example.com", selector: "#footer" }

// Scroll to specific position
{ url: "https://example.com", x: 0, y: 2000 }

// Scroll to top of page
{ url: "https://example.com", x: 0, y: 0 }
```

**Returns:** Current scroll position, page dimensions, and viewport size — useful for understanding where you are on the page.

---

### `take_screenshot`

Takes a screenshot of an already-loaded page for visual analysis. **Useful when HTML parsing is insufficient** — for example, pages with charts, images, complex layouts, popups, or visual content that's hard to understand from HTML alone. Returns a PNG image.

**⚠️ Note:** Page must be already loaded via `fetch_webpage` first.

**Parameters:**
- `url` (string, required) - The URL of the page (must match a previously fetched page)
- `fullPage` (boolean, optional, default: `false`) - Capture the full scrollable page instead of just the viewport

**Examples:**
```javascript
// Capture viewport screenshot (default)
{ url: "https://example.com" }

// Capture full scrollable page
{ url: "https://dashboard.example.com", fullPage: true }
```

**Use cases:**
- Visualize page layout when HTML is hard to parse
- Capture charts, graphs, or data visualizations
- Debug popups, modals, or overlays
- Understand visual feedback (highlights, animations)
- See what's blocking an element click

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



## Configuration (Optional)

Environment variables for advanced setup:

| Variable | Description | Default |
|----------|-------------|---------|
| `CHROME_PATH` | Path to Chrome/Edge | Auto-detect |
| `CHROME_USER_DATA_DIR` | Browser profile directory | `%LOCALAPPDATA%/ChromeAuthProfile` |
| `CHROME_REMOTE_DEBUG_PORT` | DevTools port | `9222` |

## Observability & Logging

MCPBrowser logs all operations to help you understand what's happening:

```
[MCPBrowser] fetch_webpage called: url=https://example.com
[MCPBrowser] Tab created: example.com
[MCPBrowser] Navigating to: https://example.com
[MCPBrowser] Navigation complete: https://example.com (1234ms)
[MCPBrowser] SPA detected: React, minimal content (0 chars)
[MCPBrowser] SPA content ready
[MCPBrowser] fetch_webpage completed: https://example.com
```

**Error messages are marked with ❌:**
```
[MCPBrowser] ❌ fetch_webpage failed: net::ERR_NAME_NOT_RESOLVED
[MCPBrowser] ❌ No open page found for example.com
```

Logs go to `stderr` so they don't interfere with MCP protocol on `stdout`.

## Troubleshooting

**Browser doesn't open?**
- Make sure Chrome, Edge, or Brave is installed
- Try setting `CHROME_PATH` explicitly

**Can't connect to browser?**
- Close all Chrome instances and try again
- Check if port 9222 is in use

**Authentication not preserved?**
- Keep the browser tab open (default behavior)
- Use the same domain for related requests

## Links

- [GitHub](https://github.com/cherchyk/MCPBrowser)
- [npm](https://www.npmjs.com/package/mcpbrowser)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
- [Issues](https://github.com/cherchyk/MCPBrowser/issues)

## License

MIT
