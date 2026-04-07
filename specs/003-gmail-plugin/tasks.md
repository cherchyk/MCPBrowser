# Tasks: Gmail Plugin (Hybrid UI Resilience)

**Input**: Design documents from `/specs/003-gmail-plugin/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are mandatory. Add explicit test tasks (unit, integration, tool-selection) for each user story. Implementation steps must run these tests; completion is defined only when they pass.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Plugin source**: `MCPBrowser/src/plugins/gmail/`
- **Plugin tests**: `MCPBrowser/tests/plugins/gmail/`
- **Core imports**: `MCPBrowser/src/core/` (responses.js, logger.js, browser.js)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project structure, directories, and plugin registration

- [X] T001 Create directory structure: `MCPBrowser/src/plugins/gmail/actions/` and `MCPBrowser/tests/plugins/gmail/`
- [X] T002 Enable the gmail plugin in `MCPBrowser/src/plugins.json` by adding `"gmail"` to the `enabled` array
- [X] T003 [P] Create `MCPBrowser/src/plugins/gmail/selectors.js` with Tier 4 CSS selectors ONLY — centralized, versioned, with tier documentation comments per FR-023 and research R4. Include: email row (`tr.zA`), unread (`.zE`), subject (`span.bog`), snippet (`span.y2`), date cell (`td.xW span`), message container (`div.adn`), message body (`div.a3s.aiL`), message date (`span.g3`), thread subject (`h2.hP`), attachment area (`div.aQH`), attachment name (`span.aV3`), attachment size (`span.SaH2Ve`), label picker items (`div.J-N-Jz`). NO action buttons, NO toolbar buttons, NO compose trigger — those are handled by Tier 1/2
- [X] T004 [P] Create `MCPBrowser/src/plugins/gmail/helpers.js` with tiered utility functions: `getAccountIndex(url)` extracts `/u/N/` from URL (R7/FR-020); `gmailNavigate(page, hash)` constructs full URL with account index and navigates (T1 per FR-020); `detectView(page)` parses URL hash as primary signal, falls back to `div[role="dialog"]` for compose overlay (FR-024/R6), and detects CAPTCHA/security interstitial states (e.g., "Confirm it's you" prompts) returning a `not_ready` view with actionable error per spec edge case; `waitForGmail(page, selector, timeout)` with 10s default, timeout errors include selector name and tier level (FR-012/Constitution IV); `checkKeyboardShortcuts(page)` sends `?` key and detects help dialog, returns error with enablement instructions if disabled (FR-019/R5); `checkPrecondition(page, requirement)` validates state (thread_open, row_selected, on_gmail) via URL/DOM before shortcuts (FR-025/R2); `selectEmailRow(page, {index, id})` locates row via `[data-legacy-message-id]` (T3) or positional index (T4), clicks `div[role="checkbox"]` (T3) for hybrid DOM+keyboard targeting (FR-016); `extractEmailRows(page, limit)` extracts EmailSummary[] via T3 `span[email]` + T4 selectors from selectors.js; `GmailActionResponse` class extending MCPResponse with structured data, summary, and nextSteps
- [X] T005 Create `MCPBrowser/src/plugins/gmail/index.js` with plugin entry point: manifest (name: "gmail", version: "1.0.0", urlPatterns: ["mail.google.com"], interfaceVersion: 1, domPatterns), `matchesPage(url, html)` per FR-001/FR-002, `getActions()` returning all 11 action descriptors wired to action modules, `getInfo()` returning plugin context per contracts. Import all action modules from `actions/` directory
- [X] T006 Create unit test `MCPBrowser/tests/plugins/gmail/gmail-plugin.test.js` testing: manifest fields valid, matchesPage returns matched:true for Gmail URLs and matched:false for non-Gmail, getActions returns 11 actions each with name/description/params/execute, getInfo has no execute functions (serialization safety)

**Checkpoint**: Plugin structure exists, loads via plugin system, detected on Gmail pages. Run T006 test.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Unit tests for helpers and selectors that MUST pass before any action implementation begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T007 Create unit test `MCPBrowser/tests/plugins/gmail/gmail-helpers.test.js` testing: `getAccountIndex()` extraction for `/u/0/`, `/u/1/`, `/u/2/` and missing-index fallback to '0'; `gmailNavigate()` URL construction preserving account index for all folder hashes (#inbox, #sent, #drafts, #trash, #spam, #label/Name, #search/query); `detectView()` URL hash parsing for all view states (email_list for #inbox/#sent/#drafts, thread for #inbox/ABC123, search_results for #search/query, compose overlay via div[role="dialog"], loading, not_gmail); `checkPrecondition()` validation logic for thread_open (URL hash contains thread ID), row_selected, on_gmail; `selectEmailRow()` by ID via `[data-legacy-message-id]` and by positional index
- [X] T008 [P] Create unit test `MCPBrowser/tests/plugins/gmail/gmail-selectors.test.js` testing: all Tier 4 selectors exported as named string constants, no undefined/null values, no action logic in selectors module, tier version comment present
- [X] T009 Run foundational tests (T007, T008) — helpers and selectors modules must pass before user stories begin

**Checkpoint**: Foundation ready — all helper utilities and selectors validated. User story implementation can now begin.

---

## Phase 3: User Story 1 — List Emails in a Folder (Priority: P1) 🎯 MVP

**Goal**: Navigate to a Gmail folder via URL hash (T1) and extract structured email list data using T3+T4 selectors.

**Independent Test**: Call `plugin_action({ plugin: "gmail", action: "list_emails" })` on Gmail and verify structured EmailSummary[] returned.

### Tests for US1 (MANDATORY)

- [X] T010 [P] [US1] Create unit test `MCPBrowser/tests/plugins/gmail/list-emails.test.js` testing: URL hash navigation to `#inbox`, `#sent`, `#drafts`, `#trash`, `#spam`, `#label/LabelName` with account index preserved (FR-020); email row extraction from fixture HTML matching data-model EmailSummary fields (index, id, sender, senderEmail, subject, snippet, date, isUnread); limit parameter respected; error when not on Gmail page with fetch_webpage guidance; nextSteps match contracts/gmail_actions.md

### Implementation for US1

- [X] T011 [US1] Implement `MCPBrowser/src/plugins/gmail/actions/list-emails.js` — detect view via `detectView()`, if folder param provided navigate via `gmailNavigate(page, '#' + folder)` for standard folders or `gmailNavigate(page, '#label/' + folder)` for labels (T1/FR-020), `waitForGmail()` for email rows (FR-012), extract rows via `extractEmailRows()` (T3+T4), return GmailActionResponse with `{ emails: EmailSummary[], folder, totalVisible }` and nextSteps per contracts
- [X] T012 [US1] Run US1 planned test (T010) and verify pass — story is complete only if test passes

**Checkpoint**: `list_emails` functional — can list inbox, sent, drafts, labels via URL hash navigation.

---

## Phase 4: User Story 2 — Read a Specific Email (Priority: P1)

**Goal**: Open an email by index or ID and extract full thread data (messages, recipients, attachments) using T1 navigation + T3+T4 extraction.

**Independent Test**: After listing emails, call `read_email({ index: 0 })` and verify EmailThread with messages returned.

### Tests for US2 (MANDATORY)

- [X] T013 [P] [US2] Create unit test `MCPBrowser/tests/plugins/gmail/read-email.test.js` testing: ID-based navigation via URL hash `#inbox/<id>` (T1); index-based targeting via `selectEmailRow()` + keyboard `o` (T2); thread data extraction from fixture HTML: subject from `h2` in `div[role="main"]` (T3 + T4 `.hP`), messages from T4 `div.adn` in chronological order, sender/senderEmail from `span[email]` (T3), recipients, date from T4 `span.g3`, HTML body from T4 `div.a3s.aiL`, attachment metadata from T4; index out-of-range error with list_emails suggestion; not-in-list-view error; nextSteps per contracts

### Implementation for US2

- [X] T014 [US2] Implement `MCPBrowser/src/plugins/gmail/actions/read-email.js` — if ID provided, navigate via `gmailNavigate(page, '#inbox/' + id)` (T1); if index, locate row via `selectEmailRow()` then keyboard `o` or Enter (T2), `checkKeyboardShortcuts()` first (FR-019); `waitForGmail()` for thread content (FR-012); extract thread: subject from `h2` within `div[role="main"]` (T3 refined by T4 `.hP`), iterate `div.adn` message containers (T4), extract sender from `span[email]` (T3), date from `span.g3` (T4), body innerHTML from `div.a3s.aiL` (T4), attachments from `div.aQH` (T4); return GmailActionResponse with EmailThread per data-model
- [X] T015 [US2] Run US2 planned test (T013) and verify pass

**Checkpoint**: `read_email` functional — can open email by index or ID, extract full thread.

---

## Phase 5: User Story 3 — Search Emails (Priority: P1)

**Goal**: Search Gmail via URL hash `#search/<query>` (T1) and extract results using same extraction as list_emails.

**Independent Test**: Call `search_emails({ query: "from:someone@example.com" })` and verify EmailSummary[] returned.

### Tests for US3 (MANDATORY)

- [X] T016 [P] [US3] Create unit test `MCPBrowser/tests/plugins/gmail/search-emails.test.js` testing: URL hash construction with encoded query `#search/from:boss@company.com` (T1); account index `/u/N/` preserved from current URL (FR-020); result extraction identical to list_emails EmailSummary format; empty results handling (empty array + no-match message); limit parameter; empty query validation error; nextSteps per contracts

### Implementation for US3

- [X] T017 [US3] Implement `MCPBrowser/src/plugins/gmail/actions/search-emails.js` — validate query not empty, encode query for URL hash, navigate via `gmailNavigate(page, '#search/' + encodedQuery)` (T1 per FR-005/FR-020), `waitForGmail()` for result rows or no-results indicator, extract rows via `extractEmailRows()` (same T3+T4 as list_emails), handle no-results case (empty array + message), return GmailActionResponse with `{ emails, query, resultCount }` and nextSteps
- [X] T018 [US3] Run US3 planned test (T016) and verify pass

**Checkpoint**: P1 complete — all read-path actions (list, read, search) functional with T1 URL navigation and T3+T4 extraction. MVP deliverable.

---

## Phase 6: User Story 4 — Compose a New Email (Priority: P2)

**Goal**: Trigger compose via keyboard `c` (T2), fill fields via T3 name attributes, optionally send via `Ctrl+Enter` (T2).

**Independent Test**: Call `compose_email({ to: "test@example.com", subject: "Hello", body: "Test" })` and verify compose window populated.

### Tests for US4 (MANDATORY)

- [X] T019 [P] [US4] Create unit test `MCPBrowser/tests/plugins/gmail/compose-email.test.js` testing: `checkKeyboardShortcuts()` called before `c` (FR-019); precondition check (on Gmail); keyboard `c` triggers compose (T2); compose dialog detected via `div[role="dialog"]` (T3); form fill via `textarea[name="to"]`, `input[name="subjectbox"]`, `div[aria-label="Message Body"]` (all T3); CC expansion and fill via `textarea[name="cc"]` (T3); send:false leaves draft (FR-015); send:true sends via `Ctrl+Enter` (T2); empty-to validation error; existing compose window detection and close; nextSteps for draft vs sent states

### Implementation for US4

- [X] T020 [US4] Implement `MCPBrowser/src/plugins/gmail/actions/compose-email.js` — validate `to` not empty, `checkKeyboardShortcuts(page)` (FR-019), detect and close existing compose dialog (`div[role="dialog"]` T3), press `c` keyboard (T2), wait for compose dialog (`div[role="dialog"]` T3), fill To via `textarea[name="to"]` (T3) + Tab to confirm recipient chip, fill CC if provided (expand CC link then `textarea[name="cc"]` T3), fill Subject via `input[name="subjectbox"]` (T3), fill Body via `div[aria-label="Message Body"]` (T3) using innerHTML or page.type(), if send:true press `Ctrl+Enter` (T2) else leave as draft, return GmailActionResponse with `{ status: "sent"|"draft", to, subject }`
- [X] T021 [US4] Run US4 planned test (T019) and verify pass

**Checkpoint**: `compose_email` functional — compose via keyboard, fill via name attrs, send via shortcut.

---

## Phase 7: User Story 5 — Reply to an Email (Priority: P2)

**Goal**: Reply/reply-all to open thread via keyboard `r`/`a` (T2), fill body via T3, optionally send via `Ctrl+Enter`.

**Independent Test**: With thread open, call `reply_email({ body: "Thanks." })` and verify reply draft created.

### Tests for US5 (MANDATORY)

- [X] T022 [P] [US5] Create unit test `MCPBrowser/tests/plugins/gmail/reply-email.test.js` testing: `checkPrecondition(page, 'thread_open')` via URL hash containing thread ID (FR-025); `checkKeyboardShortcuts()` (FR-019); keyboard `r` for reply, `a` for reply-all (T2); body fill via `div[aria-label="Message Body"]` (T3); send:false leaves draft; send:true via `Ctrl+Enter` (T2); error when no thread open with read_email suggestion; nextSteps per contracts

### Implementation for US5

- [X] T023 [US5] Implement `MCPBrowser/src/plugins/gmail/actions/reply-email.js` — `checkKeyboardShortcuts(page)` (FR-019), `checkPrecondition(page, 'thread_open')` verifies URL hash contains thread ID (FR-025), press `r` or `a` based on `replyAll` param (T2), wait for reply editor by detecting `div[aria-label="Message Body"]` within compose area (T3), fill body, if send:true press `Ctrl+Enter` (T2), return GmailActionResponse with `{ status, replyAll }`
- [X] T024 [US5] Run US5 planned test (T022) and verify pass

**Checkpoint**: P2 complete — compose and reply functional. Agent can read, search, compose, and reply.

---

## Phase 8: User Story 6 — Forward, Archive, Delete, Label (Priority: P3)

**Goal**: Organizational actions using hybrid DOM+keyboard targeting (T3 row select + T2 shortcut).

**Independent Test**: Call `archive_email({ index: 0 })` from inbox list and verify email archived.

### Tests for US6 (MANDATORY)

- [X] T025 [P] [US6] Create unit test `MCPBrowser/tests/plugins/gmail/forward-email.test.js` testing: `checkPrecondition(page, 'thread_open')` via URL hash (FR-025); `checkKeyboardShortcuts()` (FR-019); keyboard `f` (T2); To fill via `textarea[name="to"]` (T3); body prepend via `div[aria-label="Message Body"]` (T3); send:true/false; error when no thread open; nextSteps
- [X] T026 [P] [US6] Create unit test `MCPBrowser/tests/plugins/gmail/archive-email.test.js` testing: hybrid DOM+keyboard — `selectEmailRow()` clicks checkbox (`div[role="checkbox"]` T3) then keyboard `e` (T2); thread-view direct `e` without row selection; `checkPrecondition()` errors (no selection, not Gmail); index and ID targeting via FR-016; nextSteps
- [X] T027 [P] [US6] Create unit test `MCPBrowser/tests/plugins/gmail/delete-email.test.js` testing: same hybrid pattern as archive but keyboard `#` (Shift+3, T2); thread-view and list-view modes; precondition errors
- [X] T028 [P] [US6] Create unit test `MCPBrowser/tests/plugins/gmail/label-email.test.js` testing: hybrid select + keyboard `l` (T2) opens label picker; label item selection from T4 picker (`div.J-N-Jz`); label-not-found error listing available labels; index and ID targeting; nextSteps

### Implementation for US6

- [X] T029 [US6] Implement `MCPBrowser/src/plugins/gmail/actions/forward-email.js` — `checkKeyboardShortcuts()`, `checkPrecondition(page, 'thread_open')` (FR-025), press `f` (T2), wait for forward compose (`div[role="dialog"]` T3), fill To via `textarea[name="to"]` (T3) + Tab, fill body if provided via `div[aria-label="Message Body"]` (T3), if send:true `Ctrl+Enter` (T2), return GmailActionResponse
- [X] T030 [US6] Implement `MCPBrowser/src/plugins/gmail/actions/archive-email.js` — detect view via `detectView()`: if thread view, `checkPrecondition(page, 'thread_open')` then press `e` (T2); if list view, `selectEmailRow(page, {index, id})` clicks checkbox (T3/FR-016) then press `e` (T2); wait for row removal or view change; return GmailActionResponse with `{ archived: true }`
- [X] T031 [P] [US6] Implement `MCPBrowser/src/plugins/gmail/actions/delete-email.js` — same pattern as archive but press `#` (T2) instead of `e`; return GmailActionResponse with `{ deleted: true }`
- [X] T032 [US6] Implement `MCPBrowser/src/plugins/gmail/actions/label-email.js` — detect view, `selectEmailRow()` if list view or use current thread, `checkKeyboardShortcuts()`, press `l` (T2) to open label picker, wait for picker overlay, find label item matching `label` param in T4 `div.J-N-Jz` elements, click it; if not found return error listing visible labels; return GmailActionResponse with `{ labeled: true, label }`
- [X] T033 [US6] Run US6 planned tests (T025, T026, T027, T028) and verify all pass

**Checkpoint**: Forward, archive, delete, label all functional with hybrid DOM+keyboard approach.

---

## Phase 9: User Story 7 — Mark Email as Read/Unread (Priority: P3)

**Goal**: Toggle read/unread status via hybrid DOM+keyboard (T3 row select + T2 `Shift+i`/`Shift+u`).

**Independent Test**: Call `mark_read({ index: 0 })` on an unread email and verify status change.

### Tests for US7 (MANDATORY)

- [X] T034 [P] [US7] Create unit test `MCPBrowser/tests/plugins/gmail/mark-readunread.test.js` testing: hybrid DOM+keyboard — `selectEmailRow()` clicks checkbox (T3) then `Shift+i` for mark_read / `Shift+u` for mark_unread (T2); `checkKeyboardShortcuts()` (FR-019); precondition: must be in list view; index and ID targeting; nextSteps per contracts

### Implementation for US7

- [X] T035 [US7] Implement `MCPBrowser/src/plugins/gmail/actions/mark-read.js` — `checkKeyboardShortcuts()`, detect list view via `detectView()`, `selectEmailRow(page, {index, id})` clicks checkbox (T3), press `Shift+i` (T2), return GmailActionResponse with `{ markedRead: true }`
- [X] T036 [P] [US7] Implement `MCPBrowser/src/plugins/gmail/actions/mark-unread.js` — same as mark-read but press `Shift+u` (T2), return GmailActionResponse with `{ markedUnread: true }`
- [X] T037 [US7] Run US7 planned test (T034) and verify pass

**Checkpoint**: All 11 actions implemented and tested. Full P1+P2+P3 feature complete.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Validation, documentation, and cleanup across all stories

- [X] T038 [P] Verify all 11 actions wired in `getActions()` and `getInfo()` returns complete catalog in `MCPBrowser/src/plugins/gmail/index.js` — action names, descriptions, params must match contracts/gmail_actions.md
- [X] T039 [P] Run full plugin test suite: `node MCPBrowser/tests/plugins/gmail/gmail-plugin.test.js; node MCPBrowser/tests/plugins/gmail/gmail-helpers.test.js; node MCPBrowser/tests/plugins/gmail/gmail-selectors.test.js` plus all action test files — all must pass
- [X] T040 Validate quickstart.md scenario: enable plugin, navigate to Gmail, list_emails → read_email → reply_email chain works end-to-end
- [X] T041 [P] Verify SC-007 tier coverage: confirm ≥70% of interactions use T1/T2 methods. Count: navigation (T1: 3 actions) + action triggers (T2: 10 actions) vs total interaction types. Document in selectors.js header comment
- [X] T042 [P] Verify SC-008: confirm no action file under `actions/` imports CSS class names directly — all CSS access goes through `selectors.js`. Run: `grep -r "\\." MCPBrowser/src/plugins/gmail/actions/ | grep -v "import.*selectors"` should find no class-name strings

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T003, T004 create modules tested by T007, T008) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — first MVP increment
- **US2 (Phase 4)**: Depends on Phase 2. Can run in parallel with US1 (different files)
- **US3 (Phase 5)**: Depends on Phase 2. Can run in parallel with US1/US2 (different file, reuses extractEmailRows)
- **US4 (Phase 6)**: Depends on Phase 2. Independent of US1–US3 (compose is standalone)
- **US5 (Phase 7)**: Depends on Phase 2. Logically follows US2 (reply requires thread open) but independently testable with mocks
- **US6 (Phase 8)**: Depends on Phase 2. archive/delete/label can parallel with others; forward logically follows US2
- **US7 (Phase 9)**: Depends on Phase 2. Independent of all other stories
- **Polish (Phase 10)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Independent — first story, no dependencies on others
- **US2 (P1)**: Independent — can start after Phase 2
- **US3 (P1)**: Independent — reuses `extractEmailRows()` helper from Phase 1
- **US4 (P2)**: Independent — compose is a standalone flow
- **US5 (P2)**: Independent — reply uses own keyboard shortcuts; mock thread state for tests
- **US6 (P3)**: Independent — forward/archive/delete/label are standalone
- **US7 (P3)**: Independent — mark read/unread are standalone

### Within Each User Story

- Tests MUST be written and fail before implementation
- Implementation uses helpers from Phase 1/2
- Story complete only when planned tests pass

### Parallel Opportunities

- **Phase 1**: T003 and T004 can run in parallel (different files)
- **Phase 2**: T007 and T008 can run in parallel (different test files)
- **After Phase 2**: All user stories (Phase 3–9) can start in parallel — they target different action files and test files
- **Within US6**: T025–T028 (tests) all parallel; T030 and T031 (archive/delete impl) parallel
- **Within US7**: T035 and T036 (mark-read/mark-unread impl) parallel
- **Phase 10**: T038, T039, T041, T042 can run in parallel

---

## Implementation Strategy

- **MVP First**: Finish P1 stories (US1 list + US2 read + US3 search) — tests written first, then implementation, then run tests. Stop if tests fail. This delivers the complete read path.
- **Incremental Delivery**: Add each P2/P3 story with tests → run → proceed only on green.
- **Tier Discipline**: Navigation always via URL hash (T1). Actions always via keyboard (T2). Data extraction prefers T3, falls back to T4. No direct CSS class usage in action files — always import from selectors.js.
- **Parallel Team Strategy**: After Phase 2, different stories can be assigned to different implementers. Each owner delivers tests + passing runs.

---

## Notes

- [P] tasks = different files, no dependencies
- Each user story has dedicated test tasks and a "run planned tests" step
- Verify tests fail before implementing; use fixture HTML for deterministic unit tests
- Commit after each task or logical group; stop at checkpoints to validate stories independently
- `selectors.js` contains ONLY Tier 4 CSS selectors — if you need a new CSS selector, add it there, never inline in action code
- `checkKeyboardShortcuts()` gate required on first keyboard shortcut use per action (FR-019)
- `checkPrecondition()` required before every keyboard shortcut (FR-025)
- All URL navigation must use `gmailNavigate()` which preserves account index `/u/N/` (FR-020)
- Keyboard shortcuts are language-independent; ARIA labels like `aria-label="Message Body"` may be English-dependent but are tied to accessibility standards (FR-022)
