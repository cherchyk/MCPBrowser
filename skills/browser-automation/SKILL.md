---
name: browser-automation
description: "Browse web pages, extract content, fill forms, click buttons, and automate browser interactions using MCPBrowser MCP tools. Use when the user says 'open a webpage', 'fetch this URL', 'browse to', 'scrape', 'extract from website', 'fill out form', 'click button', 'take screenshot', 'check website', 'log into site', 'navigate to', or needs to interact with any web page — especially those requiring authentication, SSO, CAPTCHAs, or JavaScript rendering."
---

# Browser Automation with MCPBrowser

Browse any web page using a real Chrome/Edge/Brave browser. Handles authentication, SSO, CAPTCHAs, anti-bot protection, and JavaScript-heavy SPAs.

## Prerequisites

- Chrome, Edge, or Brave browser installed on the machine
- Node.js 18+ installed

## Available MCP Tools

| Tool | Purpose |
|------|---------|
| `fetch_webpage` | **Start here.** Load a URL and get page HTML. Supports Chrome/Edge auto-detection. |
| `click_element` | Click buttons, links, or any clickable element by CSS selector or text |
| `type_text` | Type into input fields — supports filling multiple fields at once |
| `execute_javascript` | Run JavaScript on the page for custom extraction or UI actions |
| `get_current_html` | Re-extract HTML from an already-loaded page (no reload) |
| `scroll_page` | Scroll by direction, to an element, or to absolute position |
| `take_screenshot` | Capture a PNG screenshot for visual analysis |
| `close_tab` | Close a browser tab to free resources |
| `navigate_history` | Go back/forward in browser history |
| `plugin_info` | Discover site-specific plugins and their actions |
| `plugin_action` | Execute a site-specific plugin action (e.g., Gmail, Google Calendar) |

## Core Workflow

### Step 1: Always start with `fetch_webpage`

Every browser interaction begins by loading the page:

```
fetch_webpage(url: "https://example.com")
```

This returns cleaned HTML with a `nextSteps` array suggesting what to do next. **Always check nextSteps** — it may recommend a site-specific plugin.

### Step 2: Interact as needed

After fetching, use the appropriate tool:

- **Click something:** `click_element(url, selector: "#submit-btn")` or `click_element(url, text: "Sign In")`
- **Fill a form:** `type_text(url, fields: [{selector: "#email", text: "user@example.com"}, {selector: "#password", text: "..."}])`
- **Read updated state:** `get_current_html(url)` — fast, no reload
- **Debug visually:** `take_screenshot(url)` — see what the page looks like

### Step 3: Clean up when done

Close tabs you no longer need: `close_tab(url: "https://example.com")`

## Authentication Flows

MCPBrowser uses the user's real browser session. If a page requires login:

1. `fetch_webpage` will detect the login page and may pause for the user to authenticate
2. The user logs in manually in the browser window that opens
3. MCPBrowser resumes and returns the authenticated page content

For corporate SSO, CAPTCHAs, and MFA — the user handles these in the real browser. MCPBrowser waits and then extracts the resulting page.

## Site-Specific Plugins

MCPBrowser includes plugins for popular sites that provide optimized, reliable interactions:

1. **Check for plugins** after `fetch_webpage` — look at the `nextSteps` suggestions
2. **Get plugin info:** `plugin_info()` lists all loaded plugins, or `plugin_info(plugin: "gmail")` for details
3. **Use plugin actions:** `plugin_action(plugin: "gmail", action: "list_emails", params: {folder: "inbox"})`

### Available Plugins

- **Gmail** (`mail.google.com`): list, read, search, compose, reply, forward, archive, delete, label, mark read/unread
- **Google Calendar** (`calendar.google.com`): view events, create events, manage calendar

## Best Practices

1. **Always `fetch_webpage` first** — other tools require a page to already be loaded
2. **Use `get_current_html` instead of `fetch_webpage`** to re-read a page you already loaded (faster, no navigation)
3. **Prefer CSS selectors** over text matching for `click_element` when possible — more reliable
4. **Use `take_screenshot`** when HTML parsing is insufficient or you need visual context
5. **Fill multiple fields at once** with `type_text` — pass an array of fields instead of calling it multiple times
6. **Set `removeUnnecessaryHTML: true`** (default) to get cleaner, smaller HTML output
7. **Check `nextSteps`** in every response — MCPBrowser provides contextual guidance
8. **Use plugins when available** — they are faster and more reliable than generic DOM interaction for supported sites

## Error Handling

- If `fetch_webpage` times out, try with a longer `postLoadWait` for slow pages
- If a click doesn't work, try `execute_javascript` as a fallback
- If HTML is too large, use `execute_javascript` to extract specific data from the DOM
- If authentication is needed, MCPBrowser will prompt the user to log in via the browser
