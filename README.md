# ✅ MCPBrowser (MCP Browser)

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/cherchyk.mcpbrowser.svg)](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
[![npm version](https://img.shields.io/npm/v/mcpbrowser.svg)](https://www.npmjs.com/package/mcpbrowser)
[![Claude Desktop](https://img.shields.io/badge/Claude-Desktop-5865F2?logo=anthropic)](https://modelcontextprotocol.io/quickstart/user)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> ⚠️ **Security Notice:** MCPBrowser extracts webpage content and provides it to your AI agent (e.g., GitHub Copilot, Claude, Kiro, Antigravity), which then sends it to the LLM provider it uses (e.g., Anthropic, OpenAI, GitHub) for processing. Make sure you trust both your agent and the LLM provider — especially when accessing pages with sensitive or private data.

**MCPBrowser is an MCP browser server that gives AI assistants the ability to browse web pages using a real Chrome, Edge, or Brave browser.** This browser-based MCP server lets AI assistants (Claude, Copilot, Kiro, Antigravity) access any website — especially those protected by authentication, CAPTCHAs, anti-bot restrictions, or requiring JavaScript rendering. Uses your real browser session for web automation, so you log in once, and your AI can navigate, click buttons, fill forms, and extract content from sites that block automated requests.

Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), this web browser MCP server works seamlessly with Claude Desktop, Claude Code (CLI), GitHub Copilot, Kiro, Antigravity, and any MCP-compatible AI assistant. It handles corporate SSO, CAPTCHAs, Cloudflare protection, SPAs, dashboards, and any site that blocks automated requests. Your AI gets the same browser access you have — no special APIs, no headless browser detection, just your authenticated browser session.

Example workflow for AI assistant to use MCPBrowser

```
1. fetch_webpage    → Load the login page
2. type_text        → Enter username & password (multiple fields at once)
3. click_element    → Click "Sign In"
4. get_current_html → Extract the content after login
```


## Contents

- [Requirements](#requirements)
- [Installation](#installation)
  - [Amp](#amp)
  - [Claude Code](#claude-code)
  - [Claude Desktop](#claude-desktop)
  - [Cline](#cline)
  - [Codex](#codex)
  - [Copilot CLI](#copilot-cli)
  - [Cursor](#cursor)
  - [Factory](#factory)
  - [Gemini CLI](#gemini-cli)
  - [Goose](#goose)
  - [Kiro](#kiro)
  - [LM Studio](#lm-studio)
  - [opencode](#opencode)
  - [OpenClaw](#openclaw)
  - [Qodo Gen](#qodo-gen)
  - [VS Code (GitHub Copilot)](#vs-code-github-copilot)
  - [VS Code Extension](#vs-code-extension)
  - [Warp](#warp)
  - [Windsurf](#windsurf)
- [MCP Tools](#mcp-tools)
  - [fetch_webpage](#fetch_webpage)
  - [execute_javascript](#execute_javascript)
  - [click_element](#click_element)
  - [type_text](#type_text)
  - [get_current_html](#get_current_html)
  - [scroll_page](#scroll_page)
  - [take_screenshot](#take_screenshot)
  - [close_tab](#close_tab)
- [CLI Mode](#cli-mode)
- [Configuration](#configuration-optional)
- [Troubleshooting](#troubleshooting)
- [For Developers](#for-developers)
- [Links](#links)
- [License](#license)

## Requirements

- Chrome, Edge, or Brave browser
- [Node.js 18+](https://nodejs.org/) (includes npm)

> **Note:** Node.js must be installed on your system. The VS Code extension and npm package both require Node.js to run the MCP server. Download from [nodejs.org](https://nodejs.org/) if not already installed.

## Installation

### Getting started

First, install MCPBrowser with your MCP client.

**Standard config** works in most tools:

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

[![Install in VS Code](https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522mcpbrowser%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522mcpbrowser%2540latest%2522%255D%257D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5)](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522mcpbrowser%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522mcpbrowser%2540latest%2522%255D%257D)

---

### Amp

Add via the Amp VS Code extension settings screen or by updating your settings.json file:

```json
"amp.mcpServers": {
  "mcpbrowser": {
    "command": "npx",
    "args": ["-y", "mcpbrowser@latest"]
  }
}
```

**Amp CLI Setup:**

```bash
amp mcp add mcpbrowser -- npx -y mcpbrowser@latest
```

---

### Claude Code

Use the Claude Code CLI to add the MCPBrowser MCP server:

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

---

### Claude Desktop

Add to your config file (create it if it doesn't exist):

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json` (e.g., `C:\Users\<username>\AppData\Roaming\Claude\claude_desktop_config.json`)  
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

Restart Claude Desktop after saving.

---

### Cline

Follow the instruction in the section [Configuring MCP Servers](https://docs.cline.bot/mcp/configuring-mcp-servers).

Add the following to your [`cline_mcp_settings.json`](https://docs.cline.bot/mcp/configuring-mcp-servers#editing-mcp-settings-files) file:

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "type": "stdio",
      "command": "npx",
      "timeout": 30,
      "args": ["-y", "mcpbrowser@latest"],
      "disabled": false
    }
  }
}
```

---

### Codex

Use the Codex CLI to add the MCPBrowser MCP server:

```bash
codex mcp add mcpbrowser npx "-y" "mcpbrowser@latest"
```

Alternatively, create or edit the configuration file `~/.codex/config.toml` and add:

```toml
[mcp_servers.mcpbrowser]
command = "npx"
args = ["-y", "mcpbrowser@latest"]
```

For more information, see the [Codex MCP documentation](https://github.com/openai/codex/blob/main/codex-rs/config.md#mcp_servers).

---

### Copilot CLI

Use the Copilot CLI to interactively add the MCPBrowser MCP server:

```bash
/mcp add
```

When prompted, enter the following values:

| Field | Value |
|-------|-------|
| **Server Name** | `mcpbrowser` |
| **Server Type** | `1` (Local) |
| **Command** | `npx -y mcpbrowser@latest` |
| **Environment Variables** | *(leave empty)* |
| **Tools** | `*` |

Alternatively, create or edit the configuration file `~/.copilot/mcp-config.json` and add:

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "type": "local",
      "command": "npx",
      "tools": ["*"],
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

For more information, see the [Copilot CLI documentation](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli).

---

### Cursor

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=MCPBrowser&config=eyJjb21tYW5kIjoibnB4IC15IG1jcGJyb3dzZXJAbGF0ZXN0In0%3D)

**Or install manually:**

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx -y mcpbrowser@latest`. You can also verify config or add command like arguments via clicking `Edit`.

---

### Factory

Use the Factory CLI to add the MCPBrowser MCP server:

```bash
droid mcp add mcpbrowser "npx -y mcpbrowser@latest"
```

Alternatively, type `/mcp` within Factory droid to open an interactive UI for managing MCP servers.

For more information, see the [Factory MCP documentation](https://docs.factory.ai/cli/configuration/mcp).

---

### Gemini CLI

Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use the standard config above.

---

### Goose

[![Install in Goose](https://block.github.io/goose/img/extension-install-dark.svg)](https://block.github.io/goose/extension?cmd=npx&arg=-y&arg=mcpbrowser%40latest&id=mcpbrowser&name=MCPBrowser&description=Browser%20automation%20MCP%20server%20using%20Chrome%2FEdge)

**Or install manually:**

Go to `Advanced settings` -> `Extensions` -> `Add custom extension`. Name to your liking, use type `STDIO`, and set the `command` to `npx -y mcpbrowser@latest`. Click "Add Extension".

---

### Kiro

Follow the MCP Servers [documentation](https://kiro.dev/docs/mcp/). For example in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

---

### LM Studio

[![Add MCP Server mcpbrowser to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=mcpbrowser&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcGJyb3dzZXJAbGF0ZXN0Il19)

**Or install manually:**

Go to `Program` in the right sidebar -> `Install` -> `Edit mcp.json`. Use the standard config above.

---

### opencode

Follow the MCP Servers [documentation](https://opencode.ai/docs/mcp-servers/). For example in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mcpbrowser": {
      "type": "local",
      "command": ["npx", "-y", "mcpbrowser@latest"],
      "enabled": true
    }
  }
}
```

---

### OpenClaw

[OpenClaw](https://openclaw.ai/) is a personal AI assistant that runs on your devices. Add MCPBrowser using the CLI:

```bash
openclaw mcp add mcpbrowser -- npx -y mcpbrowser@latest
```

Verify it's working:
```bash
openclaw mcp list
```

For more information, see the [OpenClaw MCP documentation](https://docs.openclaw.ai/).

---

### Qodo Gen

Open [Qodo Gen](https://docs.qodo.ai/qodo-documentation/qodo-gen) chat panel in VSCode or IntelliJ → Connect more tools → + Add new MCP → Paste the standard config above.

Click `Save`.

---

### VS Code (GitHub Copilot)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522mcpbrowser%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522mcpbrowser%2540latest%2522%255D%257D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5)](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522mcpbrowser%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522mcpbrowser%2540latest%2522%255D%257D)

**Or install manually:**

Follow the MCP install [guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server), use the standard config above. You can also install the MCPBrowser MCP server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"mcpbrowser","command":"npx","args":["-y","mcpbrowser@latest"]}'
```

After installation, the MCPBrowser MCP server will be available for use with your AI agent in VS Code.

---

### VS Code Extension

Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser) or [Open VSX Registry](https://open-vsx.org/extension/cherchyk/mcpbrowser), or run:

```bash
code --install-extension cherchyk.mcpbrowser
```

The extension automatically installs and configures everything for your AI agent (GitHub Copilot, Kiro Agent, Antigravity Agent). Also works with VSCodium and other Open VSX-compatible editors.

---

### Warp

Go to `Settings` -> `AI` -> `Manage MCP Servers` -> `+ Add` to [add an MCP Server](https://docs.warp.dev/knowledge-and-collaboration/mcp#adding-an-mcp-server). Use the standard config above.

Alternatively, use the slash command `/add-mcp` in the Warp prompt and paste the standard config from above.

---

### Windsurf

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.

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

### `execute_javascript`

Executes a JavaScript snippet in the active page context and returns the result with metadata (execution time, truncation flag, URL-change detection). Use for structured data extraction (e.g., inbox rows) or JS-driven UI actions that are unreliable via protocol clicks.

**⚠️ Note:** Page must be already loaded via `fetch_webpage` first.

**Parameters:**
- `url` (string, required) - The URL of the page (must match a previously fetched page)
- `script` (string, required) - JavaScript source to execute in page context
- `timeoutMs` (number, optional, default: `30000`, max: `60000`) - Execution timeout
- `returnType` (string, optional, default: `json`) - `json` | `text` | `void`

**Returns:** Serialized result (`outerHTML` for DOM nodes), `type`, `executionTimeMs`, `truncated`, `urlChanged`, `currentUrl`, and structured `error` on failure.

**Examples:**
```javascript
// Extract structured data from a page
{
  url: "https://mail.google.com/",
  script: "[...document.querySelectorAll('tr.zA')].slice(0,5).map(r => ({sender: r.querySelector('.zF')?.textContent, subject: r.querySelector('.bog')?.textContent}))"
}

// Click an element via JS when protocol clicks fail
{ url: "https://example.com", script: "document.querySelector('#tricky-button').click(); return 'clicked';" }

// Return void (side-effect only)
{ url: "https://example.com", script: "localStorage.clear();", returnType: "void" }
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

**Fallback behavior:** If the native click times out after locating the element, MCPBrowser automatically retries with a JavaScript-based click. The response includes `fallbackUsed`, `nativeAttempt`, and `fallbackAttempt` metadata. If both attempts fail, the response lists both errors so you can choose another strategy.

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

---

## CLI Mode

MCPBrowser can also be used as a **standalone command-line tool**, making it easy to use from shell scripts, CI/CD pipelines, or AI agents that work through shell commands (like GitHub Copilot CLI).

```bash
# Show help
mcpbrowser --help

# Fetch a page (handles auth, SSO, SPAs automatically)
mcpbrowser fetch https://eng.ms/docs/my-page

# Fetch with raw HTML output
mcpbrowser fetch https://github.com --browser chrome --raw

# Take a screenshot
mcpbrowser screenshot https://example.com --output page.png --full-page

# Click an element on a loaded page
mcpbrowser click https://example.com --selector "#login-btn"

# Type into a form field
mcpbrowser type https://example.com --selector "input[name=q]" --text "search query"

# Execute JavaScript
mcpbrowser exec https://example.com --script "document.title"

# Get current HTML of a loaded page
mcpbrowser html https://example.com
```

**CLI vs MCP mode:** When run without arguments, MCPBrowser starts as an MCP server (stdin/stdout JSON-RPC). When run with a subcommand, it executes the command and exits — no MCP protocol needed.

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
- Make sure Chrome, Edge, or Brave is installed
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
- [Open VSX Registry](https://open-vsx.org/extension/cherchyk/mcpbrowser)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
- [Issues](https://github.com/cherchyk/MCPBrowser/issues)

## License

MIT
