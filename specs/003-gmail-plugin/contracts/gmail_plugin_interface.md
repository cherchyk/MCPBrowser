# Contract: Gmail Plugin Interface

**Feature**: 003-gmail-plugin | **Date**: 2026-04-03  
**Implements**: Plugin Interface v1 (from 002-site-plugins)

## Module: `plugins/gmail/index.js`

The Gmail plugin is an ES module exporting the standard plugin interface.

### Exports

| Export | Type | Description |
|--------|------|-------------|
| `manifest` | object | Plugin manifest with URL/DOM patterns for Gmail |
| `matchesPage(url, html)` | function | Returns `{ matched, confidence }` for Gmail pages |
| `getActions()` | function | Returns all Gmail action descriptors |
| `getInfo()` | function | Returns plugin info + action catalog for agent |

### manifest

```javascript
{
  name: "gmail",
  version: "1.0.0",
  description: "Gmail plugin for MCPBrowser — email management with Gmail-specific selectors",
  interfaceVersion: 1,
  urlPatterns: ["mail.google.com"],
  domPatterns: ["div[data-ogsr-up]", ".aH2"]
}
```

### matchesPage(url, html) → MatchResult

| Input | Type | Description |
|-------|------|-------------|
| `url` | string | Current page URL |
| `html` | string | Extracted page HTML |

| Output Field | Type | Description |
|-------------|------|-------------|
| `matched` | boolean | `true` if page is Gmail |
| `confidence` | number | `1.0` for URL match, `0.8` for DOM-only match |

### getActions() → ActionDescriptor[]

Returns array of 11 action descriptors. See [gmail_actions.md](gmail_actions.md) for full action contracts.

### getInfo() → PluginInfo

```javascript
{
  description: "Gmail email management — list, read, search, compose, reply, forward, archive, delete, label, and mark emails using Gmail-specific automation.",
  targetPages: ["Gmail inbox (mail.google.com)"],
  authFlow: "User must be signed into Gmail in the browser before using plugin actions. The plugin does not handle Google account authentication.",
  actions: [/* ActionSummary[] from getActions() without execute */]
}
```
