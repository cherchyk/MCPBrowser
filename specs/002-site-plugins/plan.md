# Implementation Plan: Site-Specific Plugin Mechanism

**Branch**: `002-site-plugins` | **Date**: 2026-04-02 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-site-plugins/spec.md`

## Summary

Add a plugin mechanism to MCPBrowser that enables site-specific automation for UI-heavy websites (Gmail, Outlook, PowerBI, AWS, Azure). Plugins conform to a standard interface, are loaded from a dedicated registry file at startup, and expose their actions through two universal dispatch tools (`browser_plugin_action` and `browser_plugin_info`) rather than individual MCP tool registrations. Detection runs against loaded plugins after page fetches, augmenting `nextSteps` with plugin recommendations.

## Technical Context

**Language/Version**: JavaScript (ES Modules), Node.js 18+
**Primary Dependencies**: `@modelcontextprotocol/sdk` ^1.25.1, `puppeteer-core` ^23.4.1
**Storage**: File-based plugin registry (`plugins.json`), plugin folders on disk
**Testing**: Custom test runner (`node tests/run-all.js`), assert-based unit tests, tool-selection tests
**Target Platform**: Cross-platform (Windows, macOS, Linux) MCP server over stdio
**Project Type**: MCP server (npm package)
**Performance Goals**: Plugin detection <100ms overhead with up to 10 plugins
**Constraints**: Zero breaking changes to existing tools; constant MCP tool count regardless of plugin count
**Scale/Scope**: Initial: plugin framework + 0 concrete plugins (framework-only). Future: 50+ plugins

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. User-Safe Browser Mediation | PASS | Plugins reuse existing browser sessions via page object; no new credential handling. Plugin actions are explicit agent-initiated calls, not automatic. |
| II. Deterministic MCP Tool Contracts | PASS | Two new tools (`browser_plugin_action`, `browser_plugin_info`) with stable input/output schemas. Plugin interface version in manifest enables contract evolution. |
| III. Test-First Coverage | PASS | Test plan below enumerates unit tests for loader, detection, dispatch, and response integration. Tests run before implementation is considered complete. |
| IV. Observability & Diagnostics | PASS | Plugin loader logs warnings for skip/failure. Dispatch tools log plugin name + action for traceability. Uses existing logger infrastructure. |
| V. Intent-Explicit Documentation | PASS | Each new file declares purpose. Plugin interface documented in contracts/. quickstart.md provides developer guide. |
| VI. Dual-Project Independence | PASS | Changes are entirely within MCPBrowser package. VSCodeExtension is not touched. Test suites remain isolated. |

**Pre-Phase 0 Gate**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-site-plugins/
├── plan.md              # This file
├── research.md          # Phase 0: Technical decisions
├── data-model.md        # Phase 1: Entity definitions
├── quickstart.md        # Phase 1: Plugin developer guide
├── contracts/           # Phase 1: Interface contracts
│   ├── plugin_interface.md
│   ├── browser_plugin_action_tool.md
│   └── browser_plugin_info_tool.md
└── tasks.md             # Phase 2 output (NOT created by plan)
```

### Source Code (MCPBrowser package)

```text
MCPBrowser/
├── plugins.json                    # Plugin registry (enabled plugins list)
├── src/
│   ├── mcp-browser.js              # MODIFIED: integrate plugin loader + dispatch tools
│   ├── actions/
│   │   ├── plugin-action.js        # NEW: browser_plugin_action dispatch tool
│   │   ├── plugin-info.js          # NEW: browser_plugin_info tool
│   │   ├── fetch-page.js           # MODIFIED: add detection hook after HTML extraction
│   │   ├── get-current-html.js     # MODIFIED: add detection hook
│   │   ├── click-element.js        # MODIFIED: add detection hook
│   │   └── execute-javascript.js   # MODIFIED: add detection hook
│   └── core/
│       └── plugin-loader.js        # NEW: registry reader, manifest validator, plugin loader
├── plugins/                        # Plugin folders (empty initially)
│   └── _example/                   # NEW: example/stub plugin for testing & documentation
│       └── index.js                # Exports manifest, matchesPage, getActions, getInfo
└── tests/
    ├── core/
    │   └── plugin-loader.test.js   # NEW: loader, validation, registry tests
    └── actions/
        ├── plugin-action.test.js   # NEW: dispatch routing, error handling tests
        └── plugin-info.test.js     # NEW: action catalog, site context tests
```

**Structure Decision**: Extends existing MCPBrowser single-project layout. Plugin infrastructure goes in `src/core/plugin-loader.js` (core module) and `src/actions/plugin-action.js` + `plugin-info.js` (action modules following existing pattern). Plugins themselves live in `plugins/` sibling to `src/`. Registry file `plugins.json` at MCPBrowser package root.

## Complexity Tracking

No constitution violations. Table not needed.

## Test Plan & Execution

### Unit Tests

| Test File | What It Tests | Mapped FRs |
|-----------|---------------|------------|
| `tests/core/plugin-loader.test.js` | Registry reading (valid JSON, empty, missing file) | FR-002, FR-008 |
| | Manifest validation (required fields, interface version check) | FR-009, FR-010 |
| | Plugin loading via dynamic import (valid plugin, invalid plugin skip) | FR-001, FR-002a |
| | Detection function invocation (URL match, DOM match, no match) | FR-003, FR-011 |
| | Detection runs across all loaded plugins, returns matches | FR-004 |
| `tests/actions/plugin-action.test.js` | Dispatch to valid plugin + action | FR-005a |
| | Error for unknown plugin name (lists available plugins) | FR-005a |
| | Error for unknown action name (lists valid actions) | FR-005a |
| | Error when browser on wrong page | Clarification Q4 |
| | Response conforms to MCPResponse hierarchy | FR-007 |
| `tests/actions/plugin-info.test.js` | Returns full action catalog for plugin | FR-005b |
| | Returns single action details when action param provided | FR-005b |
| | Returns high-level site context (no selectors/JS exposed) | FR-005b |
| | Error for unknown plugin name | FR-005b |

### Integration Tests

| Test | What It Tests | Mapped SCs |
|------|---------------|------------|
| `tests/core/plugin-loader.test.js` (integration section) | Load example plugin from disk, verify tools registered | SC-001 |
| | Verify existing tests still pass with zero plugins | SC-005 |
| `tests/actions/plugin-action.test.js` (integration section) | End-to-end dispatch through example plugin | SC-007 |

### Tool-Selection Tests

| Test | What It Tests |
|------|---------------|
| Add entries to `tests/tool-selection/tool-selection-tests.json` | Agent selects `browser_plugin_action` / `browser_plugin_info` for plugin-related queries |

### Existing Test Regression

All existing tests in `tests/` must continue to pass unchanged (SC-005). Run `node tests/run-all.js` as final gate.