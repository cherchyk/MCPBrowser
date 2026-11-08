# ✅ MCPBrowser (MCP Browser)

[![VS Code Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-007ACC?logo=visualstudiocode&logoColor=white)](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
[![Open VSX](https://img.shields.io/open-vsx/v/cherchyk/mcpbrowser?logo=eclipseide&logoColor=white)](https://open-vsx.org/extension/cherchyk/mcpbrowser)
[![npm version](https://img.shields.io/npm/v/mcpbrowser.svg)](https://www.npmjs.com/package/mcpbrowser)
[![Claude Desktop](https://img.shields.io/badge/Claude-Desktop-5865F2?logo=anthropic)](https://modelcontextprotocol.io/quickstart/user)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Privacy:** Pages you browse are shared with your AI assistant and its model provider. Only access content you're authorized to share. See [privacy and security details](MCPBrowser/docs/MCP_COMPLIANCE.md).

> 💡 **Why MCPBrowser over Puppeteer/Playwright MCP servers?** Puppeteer and Playwright are browser automation libraries — their MCP servers give agents raw, low-level browser commands. MCPBrowser uses Puppeteer under the hood and was built specifically for AI agents, adding an intelligence layer that handles the hard parts automatically.
>
> The agent gets clean HTML (90% smaller), automatic SPA detection (React, Vue, Angular), authentication flow handling (SSO, redirects, multi-step login), form discovery with multi-field filling, structured responses with next-step guidance, domain-based tab reuse, and instant DOM re-extraction without page reloads. Each MCPBrowser tool call replaces 5-8 raw browser automation calls — a typical 4-step workflow in MCPBrowser would take 20+ calls with Puppeteer/Playwright MCP, saving tokens and making the agent significantly faster. [See full comparison below.](#why-mcpbrowser-over-puppeteerplaywright-mcp-servers)

**MCPBrowser is an MCP browser server that gives AI assistants the ability to browse web pages using a real Chrome, Edge, or Brave browser.** This browser-based MCP server lets AI assistants (Claude, Copilot, Kiro, Antigravity) access any website — especially those protected by authentication, CAPTCHAs, anti-bot restrictions, or requiring JavaScript rendering. Uses your real browser session for web automation, so you log in once, and your AI can navigate, click buttons, fill forms, and extract content from sites that block automated requests.

Built on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/), this web browser MCP server works seamlessly with Claude Desktop, Claude Code (CLI), GitHub Copilot, Kiro, Antigravity, and any MCP-compatible AI assistant. It handles corporate SSO, CAPTCHAs, Cloudflare protection, SPAs, dashboards, and any site that blocks automated requests. Your AI gets the same browser access you have — no special APIs, no headless browser detection, just your authenticated browser session.

Example workflow for AI assistant to use MCPBrowser

```
1. browser_fetch_webpage    → Load the login page
2. browser_type_text        → Enter username & password (multiple fields at once)
3. browser_click_element    → Click "Sign In"
4. browser_get_current_html → Extract the content after login
```

## Contents

- [Why MCPBrowser over Puppeteer/Playwright MCP servers?](#why-mcpbrowser-over-puppeteerplaywright-mcp-servers)
- [Requirements](#requirements)
- [Installation](#installation)
- [MCP Tools](#mcp-tools)
  - [browser_fetch_webpage](#browser_fetch_webpage)
  - [browser_execute_javascript](#browser_execute_javascript)
  - [browser_click_element](#browser_click_element)
  - [browser_type_text](#browser_type_text)
  - [browser_get_current_html](#browser_get_current_html)
  - [browser_scroll_page](#browser_scroll_page)
  - [browser_take_screenshot](#browser_take_screenshot)
  - [browser_close_tab](#browser_close_tab)
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

## Why MCPBrowser over Puppeteer/Playwright MCP servers?

Puppeteer and Playwright are browser automation libraries — their MCP servers expose low-level browser commands and the agent has to handle SPAs, auth flows, messy HTML, and edge cases on its own. **MCPBrowser was built specifically for AI agents.** It uses Puppeteer under the hood and adds an intelligence layer so the agent can focus on the task instead of fighting the browser.

|                       | MCPBrowser                                                                                                                   | Puppeteer/Playwright MCP                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **HTML output**       | Clean, LLM-optimized (~90% smaller) — strips scripts, styles, SVGs, tracking attrs, converts relative URLs                   | Raw DOM                                                           |
| **SPA support**       | Auto-detects React, Vue, Angular, Svelte, Next.js, Nuxt — applies framework-aware wait strategies                            | Agent must configure waits manually                               |
| **Authentication**    | Detects login pages, SSO redirects, multi-step auth — follows redirect chains, two-phase timeouts (5s SSO → 20min manual)    | Agent must script each auth step                                  |
| **Form interaction**  | `browser_detect_forms` discovers all fields, labels, constraints; `browser_type_text` fills multiple fields at once          | One field at a time, manual selectors                             |
| **Response format**   | Typed, structured with `nextSteps` guidance — soft vs hard failure distinction with recovery actions                         | Raw results, generic errors                                       |
| **Tab management**    | Domain-pooled — reuses tabs, survives browser reconnection                                                                   | New context per request                                           |
| **DOM re-extraction** | `browser_get_current_html` — instant, no reload (10-50x faster)                                                              | Must re-fetch full page                                           |
| **Plugin system**     | Detects known sites by URL/DOM patterns, offers site-specific actions with confidence scoring                                | N/A                                                               |
| **Built for**         | AI agents                                                                                                                    | Browser test automation                                           |
| **Agent efficiency**  | 1 tool call replaces 5-8 raw browser calls — a 4-step login flow takes 4 calls instead of 20+, saving tokens and round-trips | Each step (navigate, wait, query, type, click) is a separate call |

## Installation

Add this configuration to your MCP client, or use a VS Code install button below:

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

For client-specific setup, see the [installation guide](docs/INSTALLATION.md), including Claude, Copilot CLI, Cursor, and the VS Code extension.

For a version-pinned server with a browser workflow skill, see the [Copilot plugin installation](AgentPlugin/README.md#install). Use the plugin instead of configuring a second copy of the server.

## MCP Tools

### `browser_fetch_webpage`

Fetches web pages using your Chrome/Edge/Brave browser. Handles authentication, CAPTCHA, SSO, anti-bot protection, and JavaScript-heavy sites. Opens the URL in a browser tab (reuses existing tab for same domain) and waits for the page to fully load before returning content. **Automatically detects SPAs** (React, Vue, Angular) and waits for JavaScript to render content.

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

### `browser_execute_javascript`

Executes a JavaScript snippet in the active page context and returns the result with metadata (execution time, truncation flag, URL-change detection). Use for structured data extraction (e.g., inbox rows) or JS-driven UI actions that are unreliable via protocol clicks.

**⚠️ Note:** Page must be already loaded via `browser_fetch_webpage` first.

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

### `browser_click_element`

Clicks on any clickable element (buttons, links, divs with onclick handlers, etc.). Can target by CSS selector or visible text content. Automatically scrolls element into view and waits for page stability after clicking.

**⚠️ Note:** Page must be already loaded via `browser_fetch_webpage` first.

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

### `browser_type_text`

Types text into one or more input fields in a single call. Supports filling entire forms at once for efficient automation. Automatically clears existing text by default.

**⚠️ Note:** Page must be already loaded via `browser_fetch_webpage` first.

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

### `browser_get_current_html`

Gets the current HTML from an already-loaded page **WITHOUT** navigating or reloading. Much faster than `browser_fetch_webpage` since it only extracts the current DOM state. Use this after interactions (click, type) to get the updated page content efficiently.

**⚠️ Note:** Page must be already loaded via `browser_fetch_webpage` first.

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

- `browser_fetch_webpage`: 2-5 seconds (full page reload)
- `browser_get_current_html`: 0.1-0.3 seconds (just extracts HTML) ✅

---

### `browser_scroll_page`

Scrolls within an already-loaded page. Use before `browser_take_screenshot` to capture different parts of the page, or to bring elements into view before interaction. Supports multiple scroll modes:

- **By direction**: Scroll up/down/left/right by pixel amount
- **To element**: Scroll until a specific element is visible
- **To position**: Scroll to absolute coordinates

**⚠️ Note:** Page must be already loaded via `browser_fetch_webpage` first.

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

### `browser_take_screenshot`

Takes a screenshot of an already-loaded page for visual analysis. **Useful when HTML parsing is insufficient** — for example, pages with charts, images, complex layouts, popups, or visual content that's hard to understand from HTML alone. Returns a PNG image.

**⚠️ Note:** Page must be already loaded via `browser_fetch_webpage` first.

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

### `browser_close_tab`

Closes the browser tab for the given URL's hostname. Removes the page from the tab pool and forces a fresh session on the next visit to that hostname. Useful for clearing authentication state, managing memory, or starting fresh with a domain.

**⚠️ Note:** Uses exact hostname match (`www.example.com` and `example.com` are treated as different tabs).

**Parameters:**

- `url` (string, required) - The URL whose hostname tab should be closed

**Examples:**

```javascript
// Close tab for a domain
{
  url: 'https://example.com';
}

// This will close the tab for portal.azure.com
{
  url: 'https://portal.azure.com/dashboard';
}
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

| Variable                   | Description               | Default                            |
| -------------------------- | ------------------------- | ---------------------------------- |
| `CHROME_PATH`              | Path to Chrome/Edge/Brave | Auto-detect                        |
| `CHROME_USER_DATA_DIR`     | Browser profile directory | `%LOCALAPPDATA%/ChromeAuthProfile` |
| `CHROME_REMOTE_DEBUG_PORT` | DevTools port             | `9222`                             |

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

**E401 error with `npx` / private npm registry?**

If your project has a `.npmrc` that points to a private registry (e.g., Azure Artifacts, GitHub Packages, Artifactory), `npx` will try to fetch `mcpbrowser` from that registry instead of npmjs.org and fail with `E401`.

**Fix:** Add `npm_config_registry` to the `env` block in your MCP config:

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"],
      "env": {
        "npm_config_registry": "https://registry.npmjs.org"
      }
    }
  }
}
```

**Alternative:** Install globally to skip `npx` entirely:

```bash
npm install -g mcpbrowser
```

Then use `"command": "mcpbrowser"` with no `args` in your MCP config.

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

**Build and format both projects:**

```bash
pnpm build   # Creates the MCP server .tgz and VS Code extension .vsix
pnpm format  # Formats the entire workspace
```

### MCP Registry publication

The release workflow publishes npm first, then calls the **Publish to MCP Registry** workflow with the same commit's `server.json`. The npm package's `mcpName` must match `server.json.name`, and both package versions must match.

If registry publication fails after npm succeeds, rerun only the registry job. You can also run **Publish to MCP Registry** manually from GitHub Actions, selecting a ref that contains this workflow and the intended release's metadata. This retries metadata publication without republishing npm or the extensions. If the registry reports that the npm version is missing, verify the exact version is publicly available before retrying; repeated retries do not prove availability.

Publication to the [MCP Community Registry](https://registry.modelcontextprotocol.io) is distinct from inclusion in GitHub's curated catalog or Copilot's Recommended list. GitHub's [registry guide](https://github.blog/ai-and-ml/generative-ai/how-to-find-install-and-manage-mcp-servers-with-the-github-mcp-registry/) directs authors to request inclusion by emailing `partnerships@github.com` after publication. Listing and recommendation are not guaranteed.

## Links

- [GitHub](https://github.com/cherchyk/MCPBrowser)
- [npm](https://www.npmjs.com/package/mcpbrowser)
- [Open VSX Registry](https://open-vsx.org/extension/cherchyk/mcpbrowser)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
- [Issues](https://github.com/cherchyk/MCPBrowser/issues)

## License

MIT
