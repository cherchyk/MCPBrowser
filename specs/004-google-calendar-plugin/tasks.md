# Tasks: Google Calendar Plugin

**Input**: Design documents from `/specs/004-google-calendar-plugin/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are mandatory. Add explicit test tasks (unit, integration, tool-selection) for each user story. Implementation steps must run these tests; completion is defined only when they pass.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Source**: `MCPBrowser/src/plugins/gcal/`
- **Actions**: `MCPBrowser/src/plugins/gcal/actions/`
- **Tests**: `MCPBrowser/tests/plugins/gcal/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the plugin directory scaffold, entry point, shared modules, and register the plugin.

- [X] T001 Create plugin directory structure: `MCPBrowser/src/plugins/gcal/`, `MCPBrowser/src/plugins/gcal/actions/`, `MCPBrowser/tests/plugins/gcal/`
- [X] T002 Create selectors module with versioned Tier 4 CSS selectors in `MCPBrowser/src/plugins/gcal/selectors.js` — include `EVENT_CHIP`, `EVENT_TITLE_IN_CHIP`, `EVENT_TIME_IN_CHIP`, `EVENT_LOCATION_IN_DETAIL`, `EVENT_DESCRIPTION_IN_DETAIL`, `ATTENDEE_ROW`, `ATTENDEE_RSVP_STATUS`, `RSVP_YES_BUTTON`, `RSVP_NO_BUTTON`, `RSVP_MAYBE_BUTTON`, `CALENDAR_COLOR_DOT`, `SAVE_BUTTON` constants with `@version` date tag per FR-021 and research.md §3
- [X] T003 Create helpers module in `MCPBrowser/src/plugins/gcal/helpers.js` — export `DEFAULT_TIMEOUT` (10000), `VIEW` enum (DAY, WEEK, MONTH, SCHEDULE, CUSTOM, EVENT_DETAIL, EVENT_FORM, SEARCH_RESULTS, LOADING, NOT_CALENDAR, NOT_READY), `getAccountIndex(url)`, `calendarNavigate(page, path)`, `detectView(page)`, `checkKeyboardShortcuts(page)`, `checkPrecondition(page, requirement)`, `waitForCalendar(page, selector, timeout?)`, `extractVisibleEvents(page, limit?)`, `selectEvent(page, {index?, id?})`, and `GCalActionResponse extends MCPResponse` per research.md §4
- [X] T004 Create plugin entry point in `MCPBrowser/src/plugins/gcal/index.js` — export `manifest` (name: `gcal`, version: `1.0.0`, interfaceVersion: 1, urlPatterns: [`calendar.google.com`]), `matchesPage(url, html)`, `getActions()`, `getInfo()` per FR-001, FR-002 and contracts/plugin-actions.md discovery section
- [X] T005 Register plugin by adding `"gcal"` to the `enabled` array in `MCPBrowser/src/plugins.json` per research.md §8

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tests for shared modules that MUST pass before any user story implementation begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Create unit tests for selectors module in `MCPBrowser/tests/plugins/gcal/gcal-selectors.test.js` — verify all exports are non-empty strings, no duplicate values, version tag present
- [X] T007 [P] Create unit tests for helpers module in `MCPBrowser/tests/plugins/gcal/gcal-helpers.test.js` — test `getAccountIndex` extracts `/u/N/`, `calendarNavigate` builds correct URLs preserving account index, `detectView` returns correct enum for each URL pattern, `checkKeyboardShortcuts` detection via `?` shortcut, `checkPrecondition` gating for `on_calendar`/`event_visible`/`list_view` requirements, `waitForCalendar` timeout behavior, `GCalActionResponse` extends MCPResponse correctly
- [X] T008 [P] Create unit tests for plugin entry point in `MCPBrowser/tests/plugins/gcal/gcal-plugin.test.js` — verify manifest fields (name=`gcal`, interfaceVersion=1, urlPatterns), `matchesPage` detects `calendar.google.com` (confidence 1.0) and rejects non-calendar URLs, `getActions()` returns 8 actions with unique names each having `name`/`description`/`params`/`execute`, `getInfo()` strips `execute` from actions
- [X] T009 Run foundational tests: `node --test MCPBrowser/tests/plugins/gcal/gcal-selectors.test.js MCPBrowser/tests/plugins/gcal/gcal-helpers.test.js MCPBrowser/tests/plugins/gcal/gcal-plugin.test.js` — all must pass before proceeding

**Checkpoint**: Foundation ready — shared modules tested, plugin registered, user story implementation can begin.

---

## Phase 3: User Story 1 — List Events for a Date or Range (Priority: P1) 🎯 MVP

**Goal**: AI agent can list calendar events from any view, navigate to specific dates, and receive structured EventSummary data.

**Independent Test**: Navigate to `calendar.google.com`, invoke `browser_plugin_action({ plugin: "gcal", action: "list_events" })`, verify structured event data returned.

### Tests for User Story 1 (MANDATORY)

- [X] T010 [P] [US1] Create unit tests for list_events in `MCPBrowser/tests/plugins/gcal/list-events.test.js` — test default 25 limit, custom limit param, date navigation via URL path, view switch (day/week/month/schedule), not-on-calendar ErrorResponse with nextSteps, empty results with informational message, event extraction returning EventSummary fields (title, startDate, startTime, endDate, endTime, allDay, location, calendarName, eventId, index)

### Implementation for User Story 1

- [X] T011 [US1] Implement `listEvents` action in `MCPBrowser/src/plugins/gcal/actions/list-events.js` — param validation (date, view, limit), precondition check (on_calendar), keyboard shortcut check, T1 URL navigation for date/view params via `calendarNavigate`, T3+T4 event extraction via `extractVisibleEvents`, return `GCalActionResponse` with events array, view, dateRange, total, and nextSteps per contracts/plugin-actions.md
- [X] T012 [US1] Wire `list_events` action into `getActions()` in `MCPBrowser/src/plugins/gcal/index.js` with ActionDescriptor (name, description, params with defaults, execute reference)
- [X] T013 [US1] Run US1 tests: `node --test MCPBrowser/tests/plugins/gcal/list-events.test.js` — story complete only if all pass

**Checkpoint**: User Story 1 fully functional — agent can list events from any calendar view.

---

## Phase 4: User Story 2 — Read Event Details (Priority: P1)

**Goal**: AI agent can open any event and get full EventDetail including attendees, description, conferencing links.

**Independent Test**: After listing events, invoke `read_event` with `{ index: 0 }` and verify full details returned.

### Tests for User Story 2 (MANDATORY)

- [X] T014 [P] [US2] Create unit tests for read_event in `MCPBrowser/tests/plugins/gcal/read-event.test.js` — test by index, by id, all-day event (allDay=true, null times), out-of-range index ErrorResponse, conferencing link extraction (Google Meet, Zoom), attendees with RSVP statuses, recurrence summary extraction, close existing popup before opening new one (FR-023)

### Implementation for User Story 2

- [X] T015 [US2] Implement `readEvent` action in `MCPBrowser/src/plugins/gcal/actions/read-event.js` — param validation (index or id required), precondition check (on_calendar), close existing event detail popup if open (FR-023), `selectEvent` to click target event, wait for detail popup via `waitForCalendar`, T3 extraction of EventDetail fields (title, dates, location, description, organizer, attendees with RSVP, recurrence, conferencingLink, conferencingType, calendarName, allDay), return `GCalActionResponse` per contracts
- [X] T016 [US2] Wire `read_event` action into `getActions()` in `MCPBrowser/src/plugins/gcal/index.js`
- [X] T017 [US2] Run US2 tests: `node --test MCPBrowser/tests/plugins/gcal/read-event.test.js` — story complete only if all pass

**Checkpoint**: User Stories 1+2 functional — agent can list and read events (complete read path).

---

## Phase 5: User Story 3 — Create a New Event (Priority: P1)

**Goal**: AI agent can create calendar events with title, time, location, description, attendees, and all-day support.

**Independent Test**: Invoke `create_event` with title+time params and verify form populated correctly.

### Tests for User Story 3 (MANDATORY)

- [X] T018 [P] [US3] Create unit tests for create_event in `MCPBrowser/tests/plugins/gcal/create-event.test.js` — test title+time basic creation, all fields including location/description/attendees with save:true, allDay flag ignores time fields (FR-020), missing title ErrorResponse, save:false default (FR-015), keyboard shortcuts disabled ErrorResponse, close existing event form before opening new one (FR-023)

### Implementation for User Story 3

- [X] T019 [US3] Implement `createEvent` action in `MCPBrowser/src/plugins/gcal/actions/create-event.js` — param validation (title required), precondition check (on_calendar), keyboard shortcut check, close existing form/dialog if open (FR-023), T2 keyboard `c` to open form, wait for event form, T3 fill title (`input[aria-label]`), date, startTime/endTime (time picker), location, description (`contenteditable`), attendees (guest email input), allDay toggle (FR-020), conditional save via T4 `SAVE_BUTTON` if save:true, return `GCalActionResponse` per contracts
- [X] T020 [US3] Wire `create_event` action into `getActions()` in `MCPBrowser/src/plugins/gcal/index.js`
- [X] T021 [US3] Run US3 tests: `node --test MCPBrowser/tests/plugins/gcal/create-event.test.js` — story complete only if all pass

**Checkpoint**: User Stories 1+2+3 functional — complete P1 MVP (list, read, create).

---

## Phase 6: User Story 4 — Search Events (Priority: P2)

**Goal**: AI agent can search for events by keyword and receive structured results.

**Independent Test**: Invoke `search_events` with `{ query: "standup" }` and verify matching events returned.

### Tests for User Story 4 (MANDATORY)

- [X] T022 [P] [US4] Create unit tests for search_events in `MCPBrowser/tests/plugins/gcal/search-events.test.js` — test query with results, no results (empty array + message), limit parameter, missing query ErrorResponse

### Implementation for User Story 4

- [X] T023 [US4] Implement `searchEvents` action in `MCPBrowser/src/plugins/gcal/actions/search-events.js` — param validation (query required), precondition check (on_calendar), T2 keyboard `/` to focus search, type query, wait for search results via `waitForCalendar`, T3+T4 extraction of EventSummary array via `extractVisibleEvents` with limit, return `GCalActionResponse` with events, query, total per contracts
- [X] T024 [US4] Wire `search_events` action into `getActions()` in `MCPBrowser/src/plugins/gcal/index.js`
- [X] T025 [US4] Run US4 tests: `node --test MCPBrowser/tests/plugins/gcal/search-events.test.js` — story complete only if all pass

**Checkpoint**: User Story 4 functional — agent can search events.

---

## Phase 7: User Story 5 — Edit an Existing Event (Priority: P2)

**Goal**: AI agent can modify event fields (time, title, location, description, attendees) and optionally save.

**Independent Test**: After listing events, invoke `edit_event` with updated fields and verify changes applied.

### Tests for User Story 5 (MANDATORY)

- [X] T026 [P] [US5] Create unit tests for edit_event in `MCPBrowser/tests/plugins/gcal/edit-event.test.js` — test update time fields, update title with save:true, no event identifier ErrorResponse, no-events-visible ErrorResponse, recurring event single-occurrence edit with recurringNote, save:false default, allDay toggle (FR-020)

### Implementation for User Story 5

- [X] T027 [US5] Implement `editEvent` action in `MCPBrowser/src/plugins/gcal/actions/edit-event.js` — param validation (index or id required), precondition check (on_calendar), `selectEvent` to open target, detect recurring event dialog → select "This event" (research.md §7), open edit form, T3 update specified fields only (title, date, startTime, endTime, location, description, attendees, allDay), conditional save via `SAVE_BUTTON` if save:true, return `GCalActionResponse` with status, fieldsUpdated, saved, recurringNote per contracts
- [X] T028 [US5] Wire `edit_event` action into `getActions()` in `MCPBrowser/src/plugins/gcal/index.js`
- [X] T029 [US5] Run US5 tests: `node --test MCPBrowser/tests/plugins/gcal/edit-event.test.js` — story complete only if all pass

**Checkpoint**: User Story 5 functional — agent can edit events.

---

## Phase 8: User Story 6 — RSVP to an Event Invitation (Priority: P2)

**Goal**: AI agent can accept, decline, or tentatively accept calendar invitations.

**Independent Test**: After reading an invitation event, invoke `rsvp_event` with `{ response: "accept" }` and verify RSVP submitted.

### Tests for User Story 6 (MANDATORY)

- [X] T030 [P] [US6] Create unit tests for rsvp_event in `MCPBrowser/tests/plugins/gcal/rsvp-event.test.js` — test accept, decline, tentative responses, invalid response value ErrorResponse, user-is-organizer ErrorResponse, no event identifier ErrorResponse

### Implementation for User Story 6

- [X] T031 [US6] Implement `rsvpEvent` action in `MCPBrowser/src/plugins/gcal/actions/rsvp-event.js` — param validation (index or id required, response must be accept/decline/tentative), precondition check (on_calendar), `selectEvent` to open target event detail, detect if user is organizer vs. invitee → ErrorResponse if organizer, click T4 `RSVP_YES_BUTTON`/`RSVP_NO_BUTTON`/`RSVP_MAYBE_BUTTON` based on response, return `GCalActionResponse` with status, response, eventTitle per contracts
- [X] T032 [US6] Wire `rsvp_event` action into `getActions()` in `MCPBrowser/src/plugins/gcal/index.js`
- [X] T033 [US6] Run US6 tests: `node --test MCPBrowser/tests/plugins/gcal/rsvp-event.test.js` — story complete only if all pass

**Checkpoint**: User Stories 4+5+6 functional — complete P2 (search, edit, RSVP).

---

## Phase 9: User Story 7 — Delete an Event (Priority: P3)

**Goal**: AI agent can remove events from the calendar with confirmation.

**Independent Test**: After listing events, invoke `delete_event` with `{ index: 0 }` and verify event removed.

### Tests for User Story 7 (MANDATORY)

- [X] T034 [P] [US7] Create unit tests for delete_event in `MCPBrowser/tests/plugins/gcal/delete-event.test.js` — test delete by index, delete by id, recurring event single-occurrence deletion with recurringNote, out-of-range index ErrorResponse, confirmation dialog handling

### Implementation for User Story 7

- [X] T035 [US7] Implement `deleteEvent` action in `MCPBrowser/src/plugins/gcal/actions/delete-event.js` — param validation (index or id required), precondition check (on_calendar), `selectEvent` to open target event, detect recurring event dialog → select "This event" (research.md §7), T2 keyboard `Delete`/`Backspace` with precondition check (FR-022), confirm deletion dialog, return `GCalActionResponse` with status, eventTitle, recurringNote per contracts
- [X] T036 [US7] Wire `delete_event` action into `getActions()` in `MCPBrowser/src/plugins/gcal/index.js`
- [X] T037 [US7] Run US7 tests: `node --test MCPBrowser/tests/plugins/gcal/delete-event.test.js` — story complete only if all pass

**Checkpoint**: User Story 7 functional — agent can delete events.

---

## Phase 10: User Story 8 — Check Availability (Priority: P3)

**Goal**: AI agent can check free/busy status for any time window and get conflicting events.

**Independent Test**: Invoke `check_availability` with date+time params and verify free/busy response.

### Tests for User Story 8 (MANDATORY)

- [X] T038 [P] [US8] Create unit tests for check_availability in `MCPBrowser/tests/plugins/gcal/check-availability.test.js` — test free slot (no conflicts), busy slot with conflicting EventSummary array, wide range with alternating free/busy AvailabilitySlots, missing required params ErrorResponse, startTime >= endTime ErrorResponse, all-day event treated as conflict

### Implementation for User Story 8

- [X] T039 [US8] Implement `checkAvailability` action in `MCPBrowser/src/plugins/gcal/actions/check-availability.js` — param validation (date, startTime, endTime all required, startTime < endTime), precondition check (on_calendar), T1 navigate to target date via `calendarNavigate` in day view, extract events via `extractVisibleEvents`, compute AvailabilitySlot array by comparing event times against requested window, return `GCalActionResponse` with date, startTime, endTime, status (free/busy), slots array per contracts
- [X] T040 [US8] Wire `check_availability` action into `getActions()` in `MCPBrowser/src/plugins/gcal/index.js`
- [X] T041 [US8] Run US8 tests: `node --test MCPBrowser/tests/plugins/gcal/check-availability.test.js` — story complete only if all pass

**Checkpoint**: All 8 user stories functional and independently tested.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Integration validation, documentation, and cross-story quality.

- [X] T042 [P] Run full test suite: `node --test MCPBrowser/tests/plugins/gcal/` — all 13 test files must pass
- [X] T043 [P] Validate quickstart.md workflows end-to-end against implemented actions — verify all 9 examples from `specs/004-google-calendar-plugin/quickstart.md` produce expected response shapes
- [X] T044 [P] Verify plugin detection: navigate to `calendar.google.com` via `browser_fetch_webpage` → confirm `nextSteps` includes gcal plugin detection → `browser_plugin_info({ plugin: "gcal" })` returns all 8 actions with correct params
- [X] T045 [P] Verify tier compliance: audit all action files to confirm ≥70% of interactions use T1/T2 methods per SC-007 — document tier usage per action in code review
- [X] T046 Review selectors.js version tag is current date, all CSS selectors have comments noting absence of ARIA alternative
- [X] T047 [P] Create integration tests in `MCPBrowser/tests/plugins/gcal/gcal-integration.test.js` — test 4 chained workflows per plan Test Plan: (1) list_events → read_event with returned index, (2) list_events → edit_event with save:true, (3) search_events → read_event on result, (4) create_event with save:true → list_events to confirm event appears
- [X] T048 Run integration tests: `node --test MCPBrowser/tests/plugins/gcal/gcal-integration.test.js` — all 4 scenarios must pass
- [X] T049 [P] Create tool-selection tests in `MCPBrowser/tests/plugins/gcal/gcal-tool-selection.test.js` — test 3 scenarios per plan Test Plan: (1) "What meetings do I have today?" → browser_fetch_webpage → browser_plugin_info → browser_plugin_action(gcal, list_events), (2) "Schedule a 1:1 with Alice at 2pm" → browser_plugin_action(gcal, create_event), (3) "Am I free at 3pm tomorrow?" → browser_plugin_action(gcal, check_availability)
- [X] T050 Run tool-selection tests: `node --test MCPBrowser/tests/plugins/gcal/gcal-tool-selection.test.js` — all 3 scenarios must pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup (Phase 1) — BLOCKS all user stories
- **User Stories (Phases 3–10)**: All depend on Foundational (Phase 2) completion
  - P1 stories (Phases 3–5) should be done first: US1 → US2 → US3 (sequential, each builds on prior)
  - P2 stories (Phases 6–8) can proceed after P1 complete; US4, US5, US6 can run in parallel
  - P3 stories (Phases 9–10) can proceed after P1 complete; US7 and US8 can run in parallel
- **Polish (Phase 11)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (list_events)**: Foundation only — no story dependencies. MVP entry point.
- **US2 (read_event)**: Foundation only — independent of US1 at code level but flows naturally after it
- **US3 (create_event)**: Foundation only — independent, uses keyboard `c` + form filling
- **US4 (search_events)**: Foundation only — independent, reuses `extractVisibleEvents` from helpers
- **US5 (edit_event)**: Foundation only — reuses `selectEvent` from helpers
- **US6 (rsvp_event)**: Foundation only — reuses `selectEvent` from helpers
- **US7 (delete_event)**: Foundation only — reuses `selectEvent` from helpers
- **US8 (check_availability)**: Foundation only — reuses `extractVisibleEvents` and `calendarNavigate`

### Within Each User Story

1. Tests MUST be written first (T0xx test task)
2. Implementation (T0xx impl task) — action file + wire into index.js
3. Run planned tests — story complete only when tests pass

### Parallel Opportunities

**Phase 1**: T002, T003, T004 can run in parallel (different files)
**Phase 2**: T006, T007, T008 can run in parallel (different test files)
**Phases 3–5 (P1)**: Test tasks T010, T014, T018 can be written in parallel
**Phases 6–8 (P2)**: All three phases can run in parallel after P1 complete
**Phases 9–10 (P3)**: Both can run in parallel after P1 complete
**Phase 11**: T042, T043, T044, T045, T046 can run in parallel

---

## Implementation Strategy

- **MVP First**: Complete Phase 1 → Phase 2 → Phase 3 (US1: list_events). This alone delivers a working plugin that can list calendar events.
- **P1 Complete**: Add Phase 4 (US2: read_event) + Phase 5 (US3: create_event) for the full core read+write path.
- **Incremental Delivery**: Each story adds its tests first → implements → runs tests → proceeds only on green.
- **Parallel Team Strategy**: After Phase 2 (Foundational), assign P2 stories (US4, US5, US6) to parallel workers. Each delivers tests + passing runs independently.

---

## Notes

- Total tasks: **50**
- Tasks per user story: US1=4, US2=4, US3=4, US4=4, US5=4, US6=4, US7=4, US8=4 (32 story tasks + 9 setup/foundational + 9 polish)
- Test files: 11 unit + 1 integration + 1 tool-selection = **13 test files**
- Plugin name: `gcal` (manifest and all `browser_plugin_action`/`browser_plugin_info` calls)
- All action files follow Gmail plugin pattern: `async function({ page, params })` → `GCalActionResponse` | `ErrorResponse`
- CSS selectors are TBD placeholders in selectors.js — actual values captured during implementation by inspecting live Google Calendar DOM
