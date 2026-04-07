# Implementation Plan: Google Calendar Plugin

**Branch**: `004-google-calendar-plugin` | **Date**: 2026-04-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-google-calendar-plugin/spec.md`

## Summary

Build a Google Calendar site plugin (`gcal`) for MCPBrowser that enables AI agents to interact with Google Calendar through browser automation. The plugin provides 8 actions (list_events, read_event, create_event, search_events, edit_event, delete_event, rsvp_event, check_availability) using the same tiered interaction strategy as the Gmail plugin: URL path navigation (T1), keyboard shortcuts (T2), ARIA/data attributes (T3), and centralized CSS selectors as last resort (T4). The architecture mirrors the Gmail plugin's proven scaffold: `index.js` entry point, `helpers.js` for stateless utilities, `selectors.js` for centralized CSS selectors, and individual action files under `actions/`.

## Technical Context

**Language/Version**: JavaScript (ES Modules), Node.js 18+  
**Primary Dependencies**: MCPBrowser plugin system (002-site-plugins), Puppeteer (page object provided by plugin-action dispatcher), MCPBrowser core responses (`MCPResponse`, `ErrorResponse`)  
**Storage**: N/A — stateless plugin, no persistence  
**Testing**: Node.js built-in test runner (`node --test`), matching project's existing test patterns  
**Target Platform**: MCPBrowser MCP server running on user's machine (Windows/macOS/Linux)  
**Project Type**: Plugin module within MCPBrowser npm package  
**Performance Goals**: Each action completes in under 5 seconds (SC-001), extraction accuracy ≥95% (SC-002)  
**Constraints**: 10-second timeout for dynamic content wait (FR-012), stateless between calls (FR-017), no cross-plugin coupling (FR-025)  
**Scale/Scope**: Single browser context, single Google account, 8 actions, ~15 source files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Phase 0

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. User-Safe Browser Mediation** | ✅ PASS | Write actions (create, edit, delete) default to `save: false` (FR-015). No credential capture. Uses existing user session. Plugin does not navigate away from Google Calendar domain. |
| **II. Deterministic MCP Tool Contracts** | ✅ PASS | All 8 actions have documented params, return shapes (FR-003–FR-010), and structured responses (FR-013). Plugin dispatches through existing `plugin_action`/`plugin_info` tools — no new MCP tool registration needed. |
| **III. Test-First Coverage** | ✅ PASS | Test plan enumerated below. 1:1 action-to-test mapping + module tests for index, helpers, selectors — 11 unit test files + integration and tool-selection tests. |
| **IV. Observability & Diagnostics** | ✅ PASS | Structured error messages with tier identification (FR-014, FR-021). View detection logged via MCPBrowser logger. Timeout errors include diagnostic context (FR-012). |
| **V. Intent-Explicit Documentation** | ✅ PASS | Each action file documents tier usage in JSDoc header. Selectors module includes version date tag. helpers.js exports are organized by tier with purpose comments. |
| **VI. Dual-Project Independence** | ✅ PASS | Plugin lives entirely within `MCPBrowser/src/plugins/gcal/`. Tests under `MCPBrowser/tests/plugins/gcal/`. No changes to VS Code extension project. |
| **Runtime Constraints & Security** | ✅ PASS | No secrets persisted. Uses Puppeteer page provided by dispatcher. DOM-only data extraction. No native modules. |
| **Development Workflow & Review Gates** | ✅ PASS | Tasks grouped by user story for independent delivery. Test execution required for completion. Version files unchanged (no breaking contract changes). |

### Complexity — no violations detected. No justification table needed.

### Post-Phase 1 Re-Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **I. User-Safe Browser Mediation** | ✅ PASS | Contracts confirm `save: false` default on create_event and edit_event. delete_event requires confirmation. No credential handling. |
| **II. Deterministic MCP Tool Contracts** | ✅ PASS | All 8 action contracts fully defined in `contracts/plugin-actions.md` with params, success shapes, error cases, and nextSteps. |
| **III. Test-First Coverage** | ✅ PASS | Test plan has 11 unit test files + 4 integration scenarios + 3 tool-selection tests. 1:1 action-to-test mapping. |
| **IV. Observability & Diagnostics** | ✅ PASS | Error responses include tier identification. View detection uses URL primary signal (logged). Timeout errors include target context. |
| **V. Intent-Explicit Documentation** | ✅ PASS | data-model.md documents all entities with field-level descriptions. quickstart.md provides usage examples. research.md documents all decisions with rationale. |
| **VI. Dual-Project Independence** | ✅ PASS | All source under `MCPBrowser/src/plugins/gcal/`, all tests under `MCPBrowser/tests/plugins/gcal/`. No VS Code extension impact. |

## Project Structure

### Documentation (this feature)

```text
specs/004-google-calendar-plugin/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── plugin-actions.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
MCPBrowser/src/plugins/gcal/
├── index.js             # Manifest, matchesPage, getActions, getInfo
├── selectors.js         # Centralized Tier 4 CSS selectors (versioned)
├── helpers.js           # Shared utilities: navigation, view detection, keyboard check, preconditions
└── actions/
    ├── list-events.js       # P1 — list events from current view
    ├── read-event.js        # P1 — open event and extract full details
    ├── create-event.js      # P1 — open event form and fill fields
    ├── search-events.js     # P2 — keyword search via Calendar search
    ├── edit-event.js        # P2 — modify existing event fields
    ├── rsvp-event.js        # P2 — accept/decline/tentative invitation
    ├── delete-event.js      # P3 — remove event from calendar
    └── check-availability.js # P3 — determine free/busy for time window

MCPBrowser/tests/plugins/gcal/
├── gcal-plugin.test.js      # index.js: manifest, matchesPage, getActions, getInfo
├── gcal-helpers.test.js     # helpers.js functions
├── gcal-selectors.test.js   # selectors.js constants
├── list-events.test.js
├── read-event.test.js
├── create-event.test.js
├── search-events.test.js
├── edit-event.test.js
├── rsvp-event.test.js
├── delete-event.test.js
└── check-availability.test.js
```

**Structure Decision**: Follows the Gmail plugin's proven pattern exactly — `plugins/<name>/` directory with `index.js`, `selectors.js`, `helpers.js`, and `actions/*.js`. Test files mirror source 1:1 under `tests/plugins/gcal/`.

## Test Plan & Execution

List the unit, integration, and tool-selection tests to add. Implementation steps MUST run these planned tests; completion is defined only when they pass.

### Unit Tests (per action)

| Test File | Action | Key Scenarios |
|-----------|--------|---------------|
| `gcal-plugin.test.js` | index.js | Manifest fields valid, matchesPage detects calendar.google.com, action array complete, getInfo strips execute |
| `gcal-helpers.test.js` | helpers.js | getAccountIndex extracts /u/N/, calendarNavigate builds correct URLs, detectView returns correct enum values, checkKeyboardShortcuts detection, checkPrecondition gating |
| `gcal-selectors.test.js` | selectors.js | All exports are non-empty strings, no duplicates, version tag present |
| `list-events.test.js` | list_events | Default 25 limit, custom limit, date navigation, view switch, not-on-calendar error, empty results |
| `read-event.test.js` | read_event | By index, all-day event, out-of-range error, conferencing link extraction, attendees with RSVP |
| `create-event.test.js` | create_event | Title+time, all fields+save, allDay flag, missing title error, save:false default |
| `search-events.test.js` | search_events | Query with results, no results, limit parameter |
| `edit-event.test.js` | edit_event | Update time, update title+save, no-events error, recurring single-occurrence |
| `rsvp-event.test.js` | rsvp_event | Accept, decline, tentative, not-invited error |
| `delete-event.test.js` | delete_event | Delete by index, recurring single-occurrence, out-of-range error |
| `check-availability.test.js` | check_availability | Free slot, busy slot with conflicts, range with free windows |

### Integration Tests

| Scenario | Tests Chained Actions |
|----------|----------------------|
| List → Read workflow | `list_events` then `read_event` with returned index |
| List → Edit → Save workflow | `list_events` then `edit_event` with `save: true` |
| Search → Read workflow | `search_events` then `read_event` on result |
| Create → Verify workflow | `create_event` with `save: true` then `list_events` to confirm |

### Tool-Selection Tests

| Scenario | Expected Tool Chain |
|----------|-------------------|
| "What meetings do I have today?" | `fetch_webpage` → `plugin_info` → `plugin_action(gcal, list_events)` |
| "Schedule a 1:1 with Alice at 2pm" | `plugin_action(gcal, create_event, {title, date, startTime, endTime, attendees})` |
| "Am I free at 3pm tomorrow?" | `plugin_action(gcal, check_availability, {date, startTime, endTime})` |