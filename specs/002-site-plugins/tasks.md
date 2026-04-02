# Tasks: Site-Specific Plugin Mechanism

**Input**: Design documents from `/specs/002-site-plugins/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are mandatory. Add explicit test tasks (unit, integration, tool-selection) for each user story. Implementation steps must run these tests; completion is defined only when they pass.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **MCPBrowser package**: `MCPBrowser/src/`, `MCPBrowser/tests/`, `MCPBrowser/plugins/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project scaffolding, registry file, and example plugin folder

- [x] T001 Create plugin registry file at MCPBrowser/plugins.json with `{ "enabled": [] }` (empty — no plugins enabled by default)
- [x] T002 [P] Create plugins directory at MCPBrowser/plugins/ (empty directory)
- [x] T003 [P] Create example plugin folder structure at MCPBrowser/plugins/_example/index.js implementing the full plugin interface contract with stub data (manifest, matchesPage, getActions, getInfo) per contracts/plugin_interface.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core plugin loader — registry reading, manifest validation, dynamic import, detection. MUST complete before any user story.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Plugin Loader (MANDATORY)

- [x] T004 [P] Write unit tests for registry reading in MCPBrowser/tests/core/plugin-loader.test.js: valid JSON parses correctly, empty enabled array returns no plugins, missing plugins.json returns no plugins (graceful), malformed JSON logs warning and returns no plugins
- [x] T005 [P] Write unit tests for manifest validation in MCPBrowser/tests/core/plugin-loader.test.js: valid manifest passes, missing required fields (name, version, description, interfaceVersion, urlPatterns) rejected with warning, wrong interfaceVersion rejected with warning, name mismatch with folder name rejected
- [x] T006 [P] Write unit tests for plugin loading in MCPBrowser/tests/core/plugin-loader.test.js: valid plugin loads successfully, invalid plugin skipped with warning log, missing index.js skipped with warning, plugin missing required exports (matchesPage, getActions, getInfo) skipped

### Implementation

- [x] T007 Create MCPBrowser/src/core/plugin-loader.js with: CURRENT_INTERFACE_VERSION constant (set to 1), readRegistry() function that reads and parses MCPBrowser/plugins.json, validateManifest(manifest, folderName) function that checks all required fields and interface version
- [x] T008 Add loadPlugins() function to MCPBrowser/src/core/plugin-loader.js: reads registry, iterates enabled list, dynamically imports each plugin via `await import()` with absolute file:// URL, validates manifest and exports, stores valid plugins in `loadedPlugins` Map, logs warnings for skipped plugins
- [x] T009 Add detectPlugins(url, html) function to MCPBrowser/src/core/plugin-loader.js: iterates all loaded plugins, calls each plugin's matchesPage(url, html), checks URL patterns first then DOM patterns, returns array of DetectionResult objects sorted by confidence descending, converts matches to nextSteps strings referencing plugin_info and plugin_action
- [x] T010 Add getLoadedPlugins() and getPlugin(name) accessor functions to MCPBrowser/src/core/plugin-loader.js for use by dispatch tools
- [x] T011 Run T004, T005, T006 tests and verify all pass — foundational phase complete only when green

**Checkpoint**: Plugin loader can read registry, validate manifests, load plugins, and detect matches. All foundational tests pass.

---

## Phase 3: User Story 3 - Plugin Registry and Zero-Change Extensibility (Priority: P1) 🎯 MVP

**Goal**: Prove that a plugin can be loaded from disk via the registry with zero core code changes — the extensibility architecture works.

**Independent Test**: Add _example plugin to enabled list, restart, verify it loads.

### Tests for User Story 3 (MANDATORY)

- [x] T012 [P] [US3] Write integration test in MCPBrowser/tests/core/plugin-loader.test.js: load _example plugin from disk via loadPlugins(), verify it appears in getLoadedPlugins() map, verify its manifest fields are correct, verify getActions() returns non-empty array
- [x] T013 [P] [US3] Write integration test in MCPBrowser/tests/core/plugin-loader.test.js: with empty plugins.json enabled list, verify loadPlugins() returns zero plugins and no errors thrown (backward compatibility SC-005)

### Implementation for User Story 3

- [x] T014 [US3] Integrate plugin loader into MCPBrowser/src/mcp-browser.js: import loadPlugins from core/plugin-loader.js, call await loadPlugins() in main() before server.connect(), log count of loaded plugins
- [x] T015 [US3] Run T012, T013 tests and verify all pass; verify existing tests still pass via `node MCPBrowser/tests/run-all.js`

**Checkpoint**: Plugin registry works end-to-end. _example plugin loads from disk. Existing tests unaffected.

---

## Phase 4: User Story 2 - Plugin Dispatch Tools (Priority: P1)

**Goal**: Implement plugin_action and plugin_info MCP tools so the agent can query and execute plugin actions.

**Independent Test**: Call plugin_info to list plugins, get action catalog. Call plugin_action to execute a stub action.

### Tests for User Story 2 (MANDATORY)

- [x] T016 [P] [US2] Write unit tests for plugin_info in MCPBrowser/tests/actions/plugin-info.test.js: no plugin param returns list of all loaded plugins with name/description/actionCount, valid plugin param returns full action catalog with params and site context, valid plugin + action param returns single action details, unknown plugin returns ErrorResponse listing available plugins, response includes nextSteps guiding to plugin_action
- [x] T017 [P] [US2] Write unit tests for plugin_action in MCPBrowser/tests/actions/plugin-action.test.js: valid plugin + action dispatches to execute function and returns result, unknown plugin returns ErrorResponse listing available plugins, unknown action returns ErrorResponse listing valid actions for that plugin, response conforms to MCPResponse hierarchy (has toMcpFormat)

### Implementation for User Story 2

- [x] T018 [US2] Create MCPBrowser/src/actions/plugin-info.js: define PLUGIN_INFO_TOOL constant per contracts/plugin_info_tool.md, implement pluginInfo({ plugin, action }) function with three modes (list all / plugin detail / action detail), create PluginInfoResponse and PluginListResponse classes extending MCPResponse, return ErrorResponse for unknown plugin/action
- [x] T019 [US2] Create MCPBrowser/src/actions/plugin-action.js: define PLUGIN_ACTION_TOOL constant per contracts/plugin_action_tool.md, implement pluginAction({ plugin, action, params }) function that looks up plugin in loadedPlugins map, finds action by name, gets browser page via getValidatedPage, calls action.execute({ page, params }), wraps result, create PluginActionSuccessResponse class extending MCPResponse, return ErrorResponse for unknown plugin/action/wrong page/execution failure
- [x] T020 [US2] Register dispatch tools in MCPBrowser/src/mcp-browser.js: import PLUGIN_ACTION_TOOL, PLUGIN_INFO_TOOL, pluginAction, pluginInfo, add tools to tools array, add cases to CallToolRequestSchema switch statement
- [x] T021 [US2] Run T016, T017 tests and verify all pass; verify existing tests still pass via `node MCPBrowser/tests/run-all.js`

**Checkpoint**: Agent can call plugin_info and plugin_action. Dispatch routing works. Error cases handled.

---

## Phase 5: User Story 1 - Plugin Detection on Page Fetch (Priority: P1)

**Goal**: After fetching a page, automatically detect matching plugins and augment nextSteps with plugin recommendations.

**Independent Test**: Fetch a URL matching _example plugin, verify nextSteps contains plugin recommendation.

### Tests for User Story 1 (MANDATORY)

- [x] T022 [P] [US1] Write unit tests for detectPlugins in MCPBrowser/tests/core/plugin-loader.test.js: URL matching returns correct plugin with confidence 1.0, DOM pattern matching returns plugin when URL doesn't match, no match returns empty array, multiple plugins loaded but only one matches — returns only that one, multiple plugins match same page — returns all sorted by confidence
- [x] T023 [P] [US1] Write unit tests for nextSteps augmentation in MCPBrowser/tests/actions/plugin-action.test.js (or a new integration test file): verify detectPlugins output converts to nextSteps strings containing plugin name and reference to plugin_info/plugin_action

### Implementation for User Story 1

- [x] T024 [US1] Add detection hook to MCPBrowser/src/actions/fetch-page.js: import detectPlugins from core/plugin-loader.js, after extractAndProcessHtml call detectPlugins(page.url(), processedHtml), append plugin nextSteps to the standard nextSteps array before returning FetchPageSuccessResponse
- [x] T025 [US1] Run T022, T023 tests and verify all pass; verify existing tests still pass via `node MCPBrowser/tests/run-all.js`

**Checkpoint**: Page fetch now detects plugins and recommends them in nextSteps. Agent sees plugin availability immediately.

---

## Phase 6: User Story 4 - Plugin Recommendation in All Tool Responses (Priority: P2)

**Goal**: Extend detection hooks to get_current_html, click_element, and execute_javascript so plugin recommendations appear consistently.

**Independent Test**: Call get_current_html on a page matching _example plugin, verify nextSteps includes plugin recommendation.

### Tests for User Story 4 (MANDATORY)

- [x] T026 [P] [US4] Write unit test verifying detection hook integration exists in get_current_html, click_element, execute_javascript — each action's success response includes plugin recommendations when a matching plugin is loaded

### Implementation for User Story 4

- [x] T027 [P] [US4] Add detection hook to MCPBrowser/src/actions/get-current-html.js: import detectPlugins, call after HTML extraction, append plugin nextSteps to response
- [x] T028 [P] [US4] Add detection hook to MCPBrowser/src/actions/click-element.js: import detectPlugins, call after HTML extraction (when returnHtml is true), append plugin nextSteps to response
- [x] T029 [P] [US4] Add detection hook to MCPBrowser/src/actions/execute-javascript.js: import detectPlugins, call after execution when page URL is available, append plugin nextSteps to response
- [x] T030 [US4] Run T026 tests and verify all pass; verify existing tests still pass via `node MCPBrowser/tests/run-all.js`

**Checkpoint**: Plugin recommendations appear in all page-content-returning tools consistently.

---

## Phase 7: User Story 5 - Plugin Access to Browser Context (Priority: P2)

**Goal**: Ensure plugin actions receive the correct browser page object and handle wrong-page errors properly.

**Independent Test**: Call plugin_action for _example plugin while on correct and incorrect pages — verify page object received and error handling works.

### Tests for User Story 5 (MANDATORY)

- [x] T031 [P] [US5] Write unit test in MCPBrowser/tests/actions/plugin-action.test.js: plugin action's execute function receives a page object (mock), verify page.evaluate can be called, verify wrong-page detection returns ErrorResponse with navigation guidance per clarification Q4

### Implementation for User Story 5

- [x] T032 [US5] Enhance plugin_action dispatch in MCPBrowser/src/actions/plugin-action.js: before calling action.execute, check if current page URL matches any of the plugin's manifest.urlPatterns, if not return ErrorResponse with "Plugin 'X' requires Y but current page is Z. Use fetch_webpage to navigate first.", pass page object to execute({ page, params })
- [x] T033 [US5] Run T031 tests and verify all pass; verify existing tests still pass via `node MCPBrowser/tests/run-all.js`

**Checkpoint**: Plugin actions receive correct page context. Wrong-page errors are clear and actionable.

---

## Phase 8: User Story 6 - Plugin High-Level Site Context (Priority: P3)

**Goal**: plugin_info returns high-level site context (auth flow, target pages) alongside action catalog, without exposing internal details.

**Independent Test**: Call plugin_info for _example plugin, verify response includes targetPages and authFlow but no CSS selectors or JS code.

### Tests for User Story 6 (MANDATORY)

- [x] T034 [P] [US6] Write unit test in MCPBrowser/tests/actions/plugin-info.test.js: verify plugin_info response includes description, targetPages, authFlow fields from getInfo(), verify response does NOT contain any CSS selector patterns (no `.class` or `#id` strings) or JavaScript code, verify actions array in getInfo response has no execute functions

### Implementation for User Story 6

- [x] T035 [US6] Ensure _example plugin's getInfo() in MCPBrowser/plugins/_example/index.js returns meaningful targetPages, authFlow, and description fields per plugin interface contract
- [x] T036 [US6] Run T034 tests and verify all pass

**Checkpoint**: Agent can query high-level site context to plan workflows without implementation details leaking.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Tool-selection tests, existing test regression, final validation

- [x] T037 [P] Add tool-selection test entries to MCPBrowser/tests/tool-selection/tool-selection-tests.json: queries like "list Gmail emails" should recommend plugin_action, "what plugins are available" should recommend plugin_info
- [x] T038 [P] Add plugin-related exports to MCPBrowser/src/mcp-browser.js export block for testing: loadPlugins, getLoadedPlugins, detectPlugins, pluginAction, pluginInfo
- [x] T039 Run full existing test suite via `node MCPBrowser/tests/run-all.js` to verify SC-005 (backward compatibility, all existing tests pass unchanged)
- [x] T040 Run quickstart.md validation: follow the steps in specs/002-site-plugins/quickstart.md to create a test plugin, verify the documented workflow works end-to-end
- [x] T041 [P] Write unit test in MCPBrowser/tests/core/plugin-loader.test.js: verify loader rejects duplicate plugin names in enabled list with warning, verify loader rejects plugins whose getActions() returns duplicate action names within the same plugin (FR-014 namespace validation)
- [x] T042 [P] Write performance test in MCPBrowser/tests/core/plugin-loader.test.js: create 10 stub plugins in memory, run detectPlugins() in a loop, assert total detection time <100ms per SC-002

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US3 (Phase 3)**: Depends on Phase 2 — proves registry works (MVP gate)
- **US2 (Phase 4)**: Depends on Phase 3 — dispatch needs loaded plugins
- **US1 (Phase 5)**: Depends on Phase 2 — detection is independent of dispatch
- **US4 (Phase 6)**: Depends on Phase 5 — extends detection to more tools
- **US5 (Phase 7)**: Depends on Phase 4 — enhances dispatch with page validation
- **US6 (Phase 8)**: Depends on Phase 4 — enhances plugin_info output
- **Polish (Phase 9)**: Depends on all user stories complete

### User Story Dependencies

- **US3 (Registry)**: Foundational only — no story dependencies. **MVP gate.**
- **US2 (Dispatch)**: Depends on US3 (needs loaded plugins to dispatch to)
- **US1 (Detection)**: Foundational only — independent of dispatch tools
- **US4 (Recommendations in all tools)**: Depends on US1 (extends detection)
- **US5 (Browser context)**: Depends on US2 (enhances dispatch)
- **US6 (Site context)**: Depends on US2 (enhances plugin_info)

### Parallel Opportunities

Within each phase, tasks marked [P] can run in parallel:
- Phase 1: T002, T003 in parallel
- Phase 2: T004, T005, T006 test writing in parallel
- Phase 4: T016, T017 test writing in parallel
- Phase 5: T022, T023 test writing in parallel
- Phase 6: T027, T028, T029 detection hooks in parallel (different files)
- Phase 9: T037, T038, T041, T042 in parallel

Cross-phase parallelism:
- After Phase 2, US1 (Phase 5) and US3 (Phase 3) can start simultaneously
- After Phase 4, US5 (Phase 7) and US6 (Phase 8) can start simultaneously

---

## Implementation Strategy

- **MVP First**: Phase 1 → Phase 2 → Phase 3 (US3). At this point the plugin registry works and a plugin can be loaded. Stop and validate.
- **Incremental Delivery**: Add US2 (dispatch) → US1 (detection) → each adds independently testable capability. Run planned tests at each checkpoint.
- **Final Sweep**: US4/US5/US6 in any order → Polish → full regression.

---

## Summary

| Metric | Count |
|--------|-------|
| Total tasks | 42 |
| Phase 1 (Setup) | 3 |
| Phase 2 (Foundational) | 8 |
| Phase 3 (US3 - Registry) | 4 |
| Phase 4 (US2 - Dispatch) | 6 |
| Phase 5 (US1 - Detection) | 4 |
| Phase 6 (US4 - Recommendations) | 5 |
| Phase 7 (US5 - Browser Context) | 3 |
| Phase 8 (US6 - Site Context) | 3 |
| Phase 9 (Polish) | 6 |
| Parallel opportunities | 16 tasks marked [P] |
| MVP scope | T001–T015 (15 tasks) |
