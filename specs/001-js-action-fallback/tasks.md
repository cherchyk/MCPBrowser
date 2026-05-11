# Tasks: P0 JavaScript execution and click fallback

**Input**: Design documents from `/specs/001-js-action-fallback/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`
- [P]: Can run in parallel (different files, no dependencies)
- [Story]: User story label (US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Install workspace dependencies per root/package.json to ensure MCPBrowser tooling is available.
- [X] T002 [P] Smoke-run baseline MCPBrowser unit suite via MCPBrowser/tests/run-unit.js to confirm starting state.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T003 Define execution timeout and size-cap defaults shared by actions in MCPBrowser/src/core/page.js.
- [X] T004 Add JSON-safe serialization and truncation helper for action results in MCPBrowser/src/utils.js.
- [X] T005 Extend structured response helpers for execution/fallback metadata in MCPBrowser/src/core/responses.js.

**Checkpoint**: Foundation ready for user stories.

---

## Phase 3: User Story 1 – Run page-scoped JavaScript (Priority: P1) 🎯 MVP

**Goal**: Allow executing page-scoped JavaScript with timeout, size cap, URL-change detection, and structured result.
**Independent Test**: Run script on inbox page to return first 10 rows and open a row; verify JSON payload, metadata, timeout/cap handling.

### Tests for User Story 1 (write first)
- [X] T006 [P] [US1] Add success/DOM/metadata coverage for browser_execute_javascript in MCPBrowser/tests/actions/browser.execute-javascript.test.js.
- [X] T007 [P] [US1] Add timeout/error/truncation coverage for browser_execute_javascript in MCPBrowser/tests/actions/browser.execute-javascript.test.js.
- [X] T008 [P] [US1] Add tool-selection expectations for browser_execute_javascript outputs in MCPBrowser/tests/tool-selection/tool-selection-tests.json.

### Implementation for User Story 1
- [X] T009 [US1] Implement browser_execute_javascript action with timeout, serialization, truncation, and urlChanged detection in MCPBrowser/src/actions/execute-javascript.js.
- [X] T010 [US1] Register browser_execute_javascript command and response wiring (EULA gate, structured output) in MCPBrowser/src/mcp-browser.js using core helpers.
- [X] T017 [US1] Run planned browser_execute_javascript tests: node tests/actions/browser.execute-javascript.test.js and node tests/run-unit.js chrome; proceed only if green.

**Checkpoint**: User Story 1 independently testable.

---

## Phase 4: User Story 2 – Automatic JS fallback on click timeouts (Priority: P2)

**Goal**: When native click times out after finding an element, retry via JS click, surface fallbackUsed and attempt details.
**Independent Test**: Simulate timeout-prone click; confirm fallback used, response metadata present; dual failure reported.

### Tests for User Story 2 (write first)
- [X] T011 [P] [US2] Expand click-element coverage for native-timeout→JS-success and dual-failure cases in MCPBrowser/tests/actions/browser.click-element.test.js.
- [X] T012 [P] [US2] Update tool-selection expectations for fallbackUsed/nativeAttempt/fallbackAttempt metadata in MCPBrowser/tests/tool-selection/tool-selection-tests.json.

### Implementation for User Story 2
- [X] T013 [US2] Implement JS fallback path on native click timeout with logging and readiness waits in MCPBrowser/src/actions/click-element.js.
- [X] T014 [US2] Ensure click-element response includes fallbackUsed and attempt metadata via MCPBrowser/src/core/responses.js integration.
- [X] T018 [US2] Run planned click fallback tests: node tests/actions/browser.click-element.test.js chrome and node tests/run-unit.js chrome; proceed only if green.

**Checkpoint**: User Story 2 independently testable.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T015 [P] Update docs for new action/fallback in MCPBrowser/README.md and specs/001-js-action-fallback/quickstart.md.
- [X] T016 Run full MCPBrowser suite (tests/run-all.js) and tool-selection regression (tests/tool-selection/run-tool-selection-tests.js); completion requires green.

---

## Dependencies & Execution Order
- Setup → Foundational → US1 (P1) → US2 (P2) → Polish.
- US1 and US2 can run in parallel only after Foundational, but preserve story independence for testing.

## Parallel Opportunities
- Marked [P] tasks (e.g., test additions T006–T008, T011–T012) can proceed concurrently.
- Different user stories can be staffed in parallel after Foundational completion.

## Implementation Strategy
- MVP: Complete US1 fully (tests + implementation), validate independently.
- Incremental: Add US2 after US1; keep story-specific tests passing before moving to polish.
