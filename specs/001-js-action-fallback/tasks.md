# Tasks: P0 JavaScript execution and click fallback

**Input**: Design documents from `/specs/001-js-action-fallback/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

## Format: `[ID] [P?] [Story] Description`
- [P]: Can run in parallel (different files, no dependencies)
- [Story]: User story label (US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 Install workspace dependencies per root/package.json to ensure MCPBrowser tooling is available.
- [ ] T002 [P] Smoke-run baseline MCPBrowser unit suite via MCPBrowser/tests/run-unit.js to confirm starting state.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 Define execution timeout and size-cap defaults shared by actions in MCPBrowser/src/core/page.js.
- [ ] T004 Add JSON-safe serialization and truncation helper for action results in MCPBrowser/src/utils.js.
- [ ] T005 Extend structured response helpers for execution/fallback metadata in MCPBrowser/src/core/responses.js.

**Checkpoint**: Foundation ready for user stories.

---

## Phase 3: User Story 1 – Run page-scoped JavaScript (Priority: P1) 🎯 MVP

**Goal**: Allow executing page-scoped JavaScript with timeout, size cap, URL-change detection, and structured result.
**Independent Test**: Run script on inbox page to return first 10 rows and open a row; verify JSON payload, metadata, timeout/cap handling.

### Tests for User Story 1 (write first)
- [ ] T006 [P] [US1] Add success/DOM/metadata coverage for execute_javascript in MCPBrowser/tests/actions/browser.execute-javascript.test.js.
- [ ] T007 [P] [US1] Add timeout/error/truncation coverage for execute_javascript in MCPBrowser/tests/actions/browser.execute-javascript.test.js.
- [ ] T008 [P] [US1] Add tool-selection expectations for execute_javascript outputs in MCPBrowser/tests/tool-selection/tool-selection-tests.json.

### Implementation for User Story 1
- [ ] T009 [US1] Implement execute_javascript action with timeout, serialization, truncation, and urlChanged detection in MCPBrowser/src/actions/execute-javascript.js.
- [ ] T010 [US1] Register execute_javascript command and response wiring (EULA gate, structured output) in MCPBrowser/src/mcp-browser.js using core helpers.

**Checkpoint**: User Story 1 independently testable.

---

## Phase 4: User Story 2 – Automatic JS fallback on click timeouts (Priority: P2)

**Goal**: When native click times out after finding an element, retry via JS click, surface fallbackUsed and attempt details.
**Independent Test**: Simulate timeout-prone click; confirm fallback used, response metadata present; dual failure reported.

### Tests for User Story 2 (write first)
- [ ] T011 [P] [US2] Expand click-element coverage for native-timeout→JS-success and dual-failure cases in MCPBrowser/tests/actions/browser.click-element.test.js.
- [ ] T012 [P] [US2] Update tool-selection expectations for fallbackUsed/nativeAttempt/fallbackAttempt metadata in MCPBrowser/tests/tool-selection/tool-selection-tests.json.

### Implementation for User Story 2
- [ ] T013 [US2] Implement JS fallback path on native click timeout with logging and readiness waits in MCPBrowser/src/actions/click-element.js.
- [ ] T014 [US2] Ensure click-element response includes fallbackUsed and attempt metadata via MCPBrowser/src/core/responses.js integration.

**Checkpoint**: User Story 2 independently testable.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T015 [P] Update docs for new action/fallback in MCPBrowser/README.md and specs/001-js-action-fallback/quickstart.md.
- [ ] T016 Run full MCPBrowser suite (tests/run-all.js and tests/tool-selection/run-tool-selection-tests.js) to verify coverage.

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
