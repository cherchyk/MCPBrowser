# Data Model: Site-Specific Plugin Mechanism

**Feature**: 002-site-plugins | **Date**: 2026-04-02

## Entities

### Plugin Manifest

Declared in `plugins/<name>/manifest.json` (or exported from `index.js`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique plugin identifier (matches folder name). Lowercase, alphanumeric + hyphens. |
| `version` | string | yes | Plugin version (semver format, e.g., `"1.0.0"`). |
| `description` | string | yes | Human-readable plugin description. |
| `interfaceVersion` | integer | yes | Plugin interface version this plugin implements (e.g., `1`). |
| `urlPatterns` | string[] | yes | URL patterns for detection (matched against page URL). Glob or substring match. |
| `domPatterns` | string[] | no | CSS selectors or text patterns to detect in page HTML/DOM. Used when URL matching is inconclusive. |

**Validation rules**:
- `name` must match the folder name under `plugins/`
- `interfaceVersion` must equal the current supported version
- `urlPatterns` must have at least one entry
- All required fields must be present and non-empty

### Plugin Instance (runtime)

In-memory representation after loading.

| Field | Type | Source | Description |
|-------|------|--------|-------------|
| `manifest` | object | `index.js` export | Validated manifest data |
| `matchesPage` | function(url, html) → MatchResult | `index.js` export | Detection function |
| `getActions` | function() → ActionDescriptor[] | `index.js` export | Returns available actions |
| `getInfo` | function() → PluginInfo | `index.js` export | Returns high-level site context + action catalog |

### MatchResult

Returned by `matchesPage(url, html)`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `matched` | boolean | yes | Whether the plugin recognizes this page |
| `confidence` | number (0-1) | no | Confidence level. Default 1.0 for URL matches, lower for DOM-only matches. |

### ActionDescriptor

Returned by `getActions()`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Action name (e.g., `"list_emails"`). Unique within plugin. |
| `description` | string | yes | Human-readable description of what the action does. |
| `params` | ParamDescriptor[] | yes | Parameters this action accepts (can be empty array). |
| `execute` | function({ page, params }) → MCPResponse | yes | Implementation function. Receives browser page object and caller params. |

### ParamDescriptor

Describes a single parameter for an action.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Parameter name (e.g., `"folder"`). |
| `type` | string | yes | Parameter type: `"string"`, `"number"`, `"boolean"`. |
| `description` | string | yes | Human-readable description. |
| `required` | boolean | yes | Whether the parameter is required. |
| `default` | any | no | Default value if not provided. |

### PluginInfo

Returned by `getInfo()`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | string | yes | High-level description of what the plugin does. |
| `targetPages` | string[] | yes | Human-readable description of pages this plugin covers. |
| `authFlow` | string | no | Description of expected authentication flow (e.g., "Google SSO"). |
| `actions` | ActionSummary[] | yes | Summary of all available actions. |

### ActionSummary

Lightweight action description for `browser_plugin_info` responses (no `execute` function).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Action name. |
| `description` | string | yes | What the action does. |
| `params` | ParamDescriptor[] | yes | Parameters the action accepts. |

### Plugin Registry

File: `plugins.json` at MCPBrowser package root.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | string[] | yes | Array of plugin folder names to load at startup. |

### Detection Result (internal)

Returned by the centralized `detectPlugins(url, html)` function.

| Field | Type | Description |
|-------|------|-------------|
| `pluginName` | string | Name of the matching plugin |
| `confidence` | number | Match confidence (0-1) |
| `nextSteps` | string[] | Plugin-specific recommendations for the agent |

## Relationships

```
Plugin Registry (plugins.json)
  └── lists enabled plugin names
        └── each maps to plugins/<name>/
              └── Plugin Instance (loaded at startup)
                    ├── manifest (validated)
                    ├── matchesPage() → MatchResult
                    ├── getActions() → ActionDescriptor[]
                    │     └── each has execute({ page, params }) → MCPResponse
                    └── getInfo() → PluginInfo
                          └── actions[] → ActionSummary[]
```

## State Transitions

### Plugin Lifecycle

```
[Not Installed] → (create folder + add to registry) → [Registered]
[Registered] → (server startup, manifest valid, interface compatible) → [Loaded]
[Registered] → (manifest invalid or interface incompatible) → [Skipped] (warning logged)
[Loaded] → (matchesPage returns true for current URL/DOM) → [Active for page]
[Active for page] → (agent calls browser_plugin_action) → [Executing action]
[Executing action] → (action completes) → [Active for page]
```

### Detection Flow

```
Page content extracted → detectPlugins(url, html) called
  → For each loaded plugin:
      URL patterns checked first (fast)
      → If URL match: confidence 1.0, plugin matched
      → If no URL match but domPatterns defined:
          DOM patterns checked (slower)
          → If DOM match: confidence based on pattern
  → Return array of DetectionResults sorted by confidence desc
  → Convert to nextSteps strings and append to response
```
