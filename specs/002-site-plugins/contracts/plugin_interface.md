# Contract: Plugin Interface

**Feature**: 002-site-plugins | **Version**: 1 (interfaceVersion)

## Overview

Every plugin MUST export the following from its entry point (`plugins/<name>/index.js`). The core system interacts with plugins exclusively through these exports. No other methods or properties are accessed.

## Required Exports

### `manifest` (object)

```javascript
export const manifest = {
  name: "gmail",                    // string, required, matches folder name
  version: "1.0.0",                 // string, required, semver
  description: "Gmail automation",  // string, required
  interfaceVersion: 1,              // integer, required, must match core's CURRENT_INTERFACE_VERSION
  urlPatterns: [                    // string[], required, at least one entry
    "mail.google.com"
  ],
  domPatterns: [                    // string[], optional, CSS selectors or text markers
    ".powerbi-grid"                 // Example: for embeddable content plugins
  ]
};
```

### `matchesPage(url, html)` (function)

Called by the detection system after page content is extracted.

**Parameters**:
- `url` (string): Current page URL
- `html` (string): Extracted page HTML (may be cleaned/trimmed)

**Returns**: `{ matched: boolean, confidence?: number }`
- `matched`: Whether this plugin recognizes the page
- `confidence`: Optional, 0.0–1.0. Default 1.0 for URL matches. Used for ranking when multiple plugins match.

**Contract**:
- MUST be synchronous or return a resolved value quickly (<10ms)
- MUST NOT throw — return `{ matched: false }` on any error
- MUST NOT modify the page or make network requests
- URL pattern matching SHOULD be checked first (fast path)
- DOM/HTML inspection SHOULD only run if URL patterns are inconclusive

### `getActions()` (function)

Returns the complete list of actions this plugin provides.

**Parameters**: None

**Returns**: `ActionDescriptor[]`

```javascript
[
  {
    name: "list_emails",           // string, unique within plugin
    description: "List emails...", // string, human-readable
    params: [                      // ParamDescriptor[]
      { name: "folder", type: "string", description: "...", required: false, default: "inbox" },
      { name: "limit", type: "number", description: "...", required: false, default: 20 }
    ],
    execute: async ({ page, params }) => { ... }  // function → MCPResponse
  }
]
```

**Contract**:
- MUST return a non-empty array (at least one action)
- Action names MUST be unique within the plugin
- `execute` functions MUST return an object conforming to MCPResponse (has `toMcpFormat()` method) or a plain object with `{ nextSteps: string[] }` at minimum
- `execute` receives `{ page, params }` where `page` is the active Puppeteer Page object
- `execute` MUST NOT auto-navigate to a different page; return an error if the page context is wrong

### `getInfo()` (function)

Returns high-level plugin context for the AI agent. Called by `browser_plugin_info` tool.

**Parameters**: None

**Returns**: `PluginInfo`

```javascript
{
  description: "Automate Gmail...",        // string, high-level description
  targetPages: [                           // string[], human-readable
    "Gmail inbox (mail.google.com)"
  ],
  authFlow: "Google SSO — authenticate via browser, wait for redirect back to mail.google.com",  // string, optional
  actions: [                               // ActionSummary[] — NO execute functions
    {
      name: "list_emails",
      description: "List emails in a folder",
      params: [
        { name: "folder", type: "string", description: "...", required: false, default: "inbox" }
      ]
    }
  ]
}
```

**Contract**:
- MUST NOT include `execute` functions in the `actions` array (serialization safety)
- MUST NOT expose CSS selectors, XPath, or internal JavaScript code
- `authFlow` is optional but recommended for sites requiring authentication

## Validation at Load Time

The plugin loader validates:
1. All required exports exist and are correct types
2. `manifest.interfaceVersion === CURRENT_INTERFACE_VERSION`
3. `manifest.name` matches the plugin's folder name
4. `manifest.urlPatterns` has at least one entry
5. `getActions()` returns a non-empty array
6. Each action has `name`, `description`, `params`, and `execute`

Validation failure → plugin skipped with warning log. No exception thrown.
