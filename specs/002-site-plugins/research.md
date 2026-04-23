# Research: Site-Specific Plugin Mechanism

**Feature**: 002-site-plugins | **Date**: 2026-04-02

## R1: Plugin Interface Pattern (ES Module Contract)

**Decision**: Each plugin exports a plain object from `index.js` conforming to a defined shape. No class hierarchy required — duck typing via manifest + exported functions.

**Rationale**: MCPBrowser's existing actions use plain exported functions and objects (e.g., `FETCH_WEBPAGE_TOOL` + `fetchPage`). A plugin following the same pattern is idiomatic and requires no new abstractions. The plugin loader validates the shape at load time via manifest fields + function type checks.

**Required exports from `plugins/<name>/index.js`**:
- `manifest` — object: `{ name, version, description, interfaceVersion, urlPatterns, domPatterns? }`
- `matchesPage(url, html)` — function: returns `{ matched: boolean, confidence?: number }`
- `getActions()` — function: returns array of action descriptors `[{ name, description, params, execute }]`
- `getInfo()` — function: returns `{ description, targetPages, authFlow?, topActions[] }`

**Alternatives considered**:
- Class-based (e.g., `extends BasePlugin`): Rejected — adds inheritance overhead; MCPBrowser has no class hierarchies for tools currently.
- JSON-only manifest with separate named exports: Rejected — harder to validate the shape; single default export is cleaner.

## R2: Dynamic Plugin Loading in Node.js ESM

**Decision**: Use `await import()` (dynamic import) to load plugin entry points at server startup.

**Rationale**: MCPBrowser uses ES modules (`"type": "module"` in package.json). Dynamic `import()` is the standard way to load modules at runtime in ESM. It returns a module namespace object, from which we read `manifest`, `matchesPage`, `getActions`, and `getInfo`.

**Key considerations**:
- Path must be an absolute `file://` URL or absolute path for `import()` in Node.js
- Error handling: wrap in try/catch per plugin; failed imports log warning and skip
- No `require()` available (ESM-only project)
- Tested in Node 18+ — fully supported

**Alternatives considered**:
- `require()` via `createRequire`: Rejected — the project is ESM-only; mixing module systems adds complexity.
- `vm.Module` sandboxing: Rejected — plugin authors are trusted (per spec assumptions); sandboxing adds complexity without benefit.

## R3: Plugin Registry File Format

**Decision**: `plugins.json` at MCPBrowser package root, containing a JSON array of plugin names.

**Format**:
```json
{
  "enabled": ["gmail", "outlook"]
}
```

**Rationale**: JSON is simple, widely understood, and doesn't require code execution. The `enabled` array maps directly to folder names under `plugins/`. A dedicated file (not `server.json`) per clarification Q2.

**Alternatives considered**:
- `plugin-registry.js` (JS module): Rejected — introduces code execution for config; JSON is sufficient for a name list.
- YAML: Rejected — would require a new dependency; JSON is built-in to Node.js.
- Auto-discovery (scan `plugins/` folder): Rejected per clarification Q2 — performance concern with many folders; explicit list preferred.

## R4: NextSteps Augmentation Strategy

**Decision**: Create a shared `detectPlugins(url, html)` function in `plugin-loader.js` that returns plugin recommendations. Each action file calls this function after generating its response and appends plugin-specific nextSteps.

**Rationale**: The detection logic must be centralized (one function, all loaded plugins checked) but invoked from each action that returns page content. This keeps detection DRY while letting each action control when and how it augments nextSteps.

**Integration points** (files that return page content and need detection):
- `fetch-page.js` — after `extractAndProcessHtml`, before returning `FetchPageSuccessResponse`
- `get-current-html.js` — after HTML extraction
- `click-element.js` — after HTML extraction (when `returnHtml: true`)
- `execute-javascript.js` — after execution result

**Implementation pattern**:
```javascript
// In each action file, after HTML extraction:
import { detectPlugins } from '../core/plugin-loader.js';

const pluginHints = detectPlugins(currentUrl, processedHtml);
const allNextSteps = [...standardNextSteps, ...pluginHints];
return new FetchPageSuccessResponse(currentUrl, processedHtml, allNextSteps);
```

**Alternatives considered**:
- Response middleware/decorator: Rejected — MCPBrowser has no middleware pattern; would add architectural overhead for 4 call sites.
- Override `toMcpFormat()` in base class: Rejected — would affect all responses including non-page responses; too broad.

## R5: Plugin Action Dispatch Design

**Decision**: `browser_plugin_action` receives `{ plugin, action, params }`, looks up the loaded plugin by name, finds the action in its action list, provides the browser page object, and calls the action's `execute` function.

**Key design**:
1. Loaded plugins stored in a `Map<string, PluginInstance>` in `plugin-loader.js`
2. `browser_plugin_action` imports the map, validates plugin + action names
3. Gets active page for the plugin's domain via existing `getOrCreatePage` / `getValidatedPage`
4. Calls `action.execute({ page, params })` — the page object is the browser context
5. Action returns an MCPResponse subclass or the dispatch wraps raw results

**Error cases**:
- Unknown plugin → ErrorResponse listing available plugins
- Unknown action → ErrorResponse listing valid actions for that plugin
- Wrong page context → ErrorResponse with navigation guidance (per clarification Q4)
- Action execution failure → ErrorResponse with details + fallback suggestion

**Alternatives considered**:
- Plugin manages its own page: Rejected — per spec FR-006, plugins use MCPBrowser's existing browser management.
- Generic function call by string: Rejected — explicit action lookup is safer and enables validation.

## R6: Interface Versioning Strategy

**Decision**: Plugin manifest includes `interfaceVersion: 1` (integer). Loader checks `interfaceVersion === CURRENT_INTERFACE_VERSION` at load time.

**Rationale**: Simple integer comparison. When the interface evolves (new required export, changed function signature), bump `CURRENT_INTERFACE_VERSION` in `plugin-loader.js`. Plugins with old version are skipped with a clear warning log.

**Future path**: If backward-compatible additions are needed, could switch to semver range checking. But for initial implementation, strict integer match is sufficient.

**Alternatives considered**:
- Semver: Rejected for now — over-engineered for an internal interface with 0 third-party plugins initially.
- No versioning: Rejected per clarification Q5 — prevents cryptic runtime errors.
