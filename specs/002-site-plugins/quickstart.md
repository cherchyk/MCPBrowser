# Quickstart: Creating an MCPBrowser Plugin

**Feature**: 002-site-plugins

## Overview

MCPBrowser plugins enable site-specific automation for UI-heavy websites. Each plugin provides targeted actions that are faster and more reliable than generic DOM interaction.

**What you'll create**:
- A plugin folder under `MCPBrowser/plugins/<name>/`
- An entry point (`index.js`) exporting the plugin interface
- Registration in `plugins.json`

## Step 1: Create the plugin folder

```
MCPBrowser/
  plugins/
    my-site/
      index.js
```

## Step 2: Implement the plugin interface

Create `plugins/my-site/index.js`:

```javascript
import { MCPResponse } from '../../src/core/responses.js';

// 1. Manifest — declares identity and detection patterns
export const manifest = {
  name: "my-site",
  version: "1.0.0",
  description: "Automation for My Site",
  interfaceVersion: 1,
  urlPatterns: ["mysite.example.com"],
  domPatterns: []  // optional: CSS selectors for embedded content detection
};

// 2. Detection — called after page fetch to check if this plugin applies
export function matchesPage(url, html) {
  // Fast URL check first
  if (url.includes("mysite.example.com")) {
    return { matched: true, confidence: 1.0 };
  }
  return { matched: false };
}

// 3. Actions — the operations this plugin provides
export function getActions() {
  return [
    {
      name: "list_items",
      description: "List items from My Site's main page",
      params: [
        { name: "limit", type: "number", description: "Max items", required: false, default: 10 }
      ],
      execute: async ({ page, params }) => {
        const limit = params?.limit ?? 10;

        // Run site-specific JavaScript on the page
        const items = await page.evaluate((lim) => {
          const rows = document.querySelectorAll('.item-row');
          return Array.from(rows).slice(0, lim).map(row => ({
            title: row.querySelector('.title')?.textContent?.trim(),
            date: row.querySelector('.date')?.textContent?.trim()
          }));
        }, limit);

        // Return MCPResponse-compatible result
        return new PluginActionResponse(items, [
          "Call plugin_action with action 'read_item' to read a specific item"
        ]);
      }
    }
  ];
}

// 4. Info — high-level context for the AI agent
export function getInfo() {
  return {
    description: "Automate My Site — list items, read details, perform actions",
    targetPages: ["My Site dashboard (mysite.example.com)"],
    authFlow: "Standard login — navigate to mysite.example.com and authenticate in browser",
    actions: getActions().map(({ name, description, params }) => ({ name, description, params }))
  };
}

// Helper response class (optional — can also return plain objects with nextSteps)
class PluginActionResponse extends MCPResponse {
  constructor(data, nextSteps) {
    super(nextSteps);
    this.data = data;
  }
  _getAdditionalFields() { return { data: this.data }; }
  getTextSummary() { return `Found ${this.data.length} items`; }
}
```

## Step 3: Register the plugin

Add your plugin name to `MCPBrowser/plugins.json`:

```json
{
  "enabled": ["my-site"]
}
```

## Step 4: Restart and test

Restart the MCPBrowser server. Your plugin is now loaded.

**Verify via agent**:
1. Call `plugin_info({ plugin: "my-site" })` → should return your action catalog
2. Navigate to `mysite.example.com` using `fetch_webpage`
3. The response `nextSteps` should recommend your plugin
4. Call `plugin_action({ plugin: "my-site", action: "list_items", params: { limit: 5 } })`

## Key Rules

- **No auto-navigation**: If the browser is on the wrong site, return an error — don't navigate automatically
- **No exposed internals**: `getInfo()` must not include CSS selectors, XPath, or JavaScript code
- **Use existing browser**: Your `execute` function receives the page object — don't create new browser connections
- **Return MCPResponse**: Your execute function should return an object with a `toMcpFormat()` method (extend MCPResponse) or a plain object with `nextSteps`
- **Keep detection fast**: `matchesPage` should complete in <10ms. Check URLs first, DOM only if needed

## Example Plugin

See `MCPBrowser/plugins/_example/` for a complete working stub plugin used in tests.
