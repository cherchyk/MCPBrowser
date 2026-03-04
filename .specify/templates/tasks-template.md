---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Tests are mandatory. Add explicit test tasks (unit, integration, tool-selection) for each user story. Implementation steps must run these tests; completion is defined only when they pass.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!-- 
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.
  
  The /speckit.tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/
  
  Tasks MUST be organized by user story so each story can be:
  - Implemented independently
  - Tested independently
  - Delivered as an MVP increment
  
  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Setup database schema and migrations framework
- [ ] T005 [P] Implement authentication/authorization framework
- [ ] T006 [P] Setup API routing and middleware structure
- [ ] T007 Create base models/entities that all stories depend on
- [ ] T008 Configure error handling and logging infrastructure
- [ ] T009 Setup environment configuration management

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 1 (MANDATORY)

> **Write these tests FIRST and ensure they fail before implementation.**

- [ ] T010 [P] [US1] Unit/integration/tool-selection test(s) for [user journey] in tests/[path].

### Implementation for User Story 1

- [ ] T012 [US1] Implement [endpoint/feature] in src/[location]/[file].
- [ ] T013 [US1] Add logging/validation and structured responses per contracts.
- [ ] T014 [US1] Run US1 planned tests (T010) and capture results; story is complete only if they pass.

**Checkpoint**: User Story 1 should be fully functional and independently testable.

---

## Phase 4: User Story 2 - [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 2 (MANDATORY)

- [ ] T018 [P] [US2] Unit/integration/tool-selection test(s) for [user journey] in tests/[path].

### Implementation for User Story 2

- [ ] T020 [US2] Implement [endpoint/feature] in src/[location]/[file].
- [ ] T021 [US2] Add logging/validation and structured responses per contracts.
- [ ] T022 [US2] Run US2 planned tests (T018) and capture results; story is complete only if they pass.

**Checkpoint**: User Stories 1 and 2 are independently functional and tested.

---

## Phase 5: User Story 3 - [Title] (Priority: P3)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

### Tests for User Story 3 (MANDATORY)

- [ ] T024 [P] [US3] Unit/integration/tool-selection test(s) for [user journey] in tests/[path].

### Implementation for User Story 3

- [ ] T026 [US3] Implement [endpoint/feature] in src/[location]/[file].
- [ ] T027 [US3] Add logging/validation and structured responses per contracts.
- [ ] T028 [US3] Run US3 planned tests (T024) and capture results; story is complete only if they pass.

**Checkpoint**: All targeted user stories are functional and tested independently.

---

[Add more user story phases as needed, following the same pattern]

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories
- [ ] TXXX [P] Additional unit/integration/tool-selection tests in tests/
- [ ] TXXX Security hardening
- [ ] TXXX Run quickstart.md validation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests MUST be written and fail before implementation
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete only when planned tests pass

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Implementation Strategy

- MVP First: finish P1 (tests written first, then implementation, then run planned tests). Stop if tests fail.
- Incremental Delivery: add each story with its tests → run planned tests → proceed only on green.
- Parallel Team Strategy: divide user stories after Foundational; each owner must deliver tests + passing runs.

---

## Notes

- [P] tasks = different files, no dependencies
- Each user story must have dedicated test tasks and a "run planned tests" implementation step
- Verify tests fail before implementing; consider contract fixtures for determinism
- Commit after each task or logical group; stop at checkpoints to validate stories independently
- Avoid vague tasks, same-file conflicts, cross-story dependencies that break independence
