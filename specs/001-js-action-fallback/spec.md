# Feature Specification: P0 JavaScript execution and click fallback

**Feature Branch**: `001-js-action-fallback`  
**Created**: 2026-03-03  
**Status**: Draft  
**Input**: User description: "Use #file:RecommendedImprovements.md to extract P0 user stories."

### User Story 1 - Run page-scoped JavaScript (Priority: P1)

An automation user executes a custom JavaScript snippet in the current page context to extract structured data or trigger UI actions (e.g., open an email row) in one step and receive the result without parsing full-page HTML.

**Why this priority**: Eliminates the biggest bottleneck observed in multi-step inbox tasks by reducing 10+ calls to 1–2 focused executions, unlocking reliable clicks and targeted data retrieval.

**Independent Test**: Execute a script on a live inbox page that returns the first 10 email senders/subjects and opens a specific row; verify the returned JSON, navigation signal, execution time, and size limits without using other tools.

**Acceptance Scenarios**:

1. **Given** a loaded page with visible list items, **When** the user runs an `browser_execute_javascript` script that maps the first 10 rows to sender and subject, **Then** the response returns a structured array capped to size limits within the default timeout.
2. **Given** a loaded page where native clicks often time out, **When** the script calls `element.click()` on a targeted row, **Then** the target opens and the response indicates whether the page URL changed or remained stable.

---

### User Story 2 - Automatic JS fallback on click timeouts (Priority: P2)

When a user requests a click on a found element and the native click attempt times out, the system automatically retries with a JavaScript-based click and reports that fallback path before completing the action.

**Why this priority**: Resolves the most common failure mode on complex SPAs (e.g., Gmail rows with `jsaction` handlers) without extra user effort, improving click reliability.

**Independent Test**: Simulate a click request on an element known to time out; confirm the fallback executes, logs its use, and the page reaches the expected post-click state without requiring a second user command.

**Acceptance Scenarios**:

1. **Given** an element is located but a native click exceeds the allowed wait, **When** the action retries via JavaScript, **Then** the fallback click executes and the response flags that the fallback path was used.
2. **Given** both native and JS clicks fail, **When** the action completes, **Then** the response reports both attempts and their errors so the user can choose another strategy.

---

### Edge Cases

- Script runs longer than the timeout: execution stops at the limit and returns a timeout error without hanging the session.
- Script returns data larger than the cap: response is truncated with a clear truncation indicator.
- Script triggers navigation or modal: response notes URL change or modal dismissal so subsequent steps can adapt.
- Element becomes stale between native click and fallback: response records both attempts and which one failed.

### Assumptions

- Users have accepted the EULA and granted an authenticated browser session with the target page already loaded.
- Callers supply well-formed scripts and selectors that align with the current page structure; action does not validate business logic beyond execution safety limits.
- Standard readiness/wait logic (e.g., page load or network idle) is available for post-click validation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an `browser_execute_javascript` action that runs a user-supplied script in the active page context and returns the last expression result in a serialized form.
- **FR-002**: The action MUST enforce an execution timeout (default 30s, max 60s) and return a structured timeout error instead of hanging.
- **FR-003**: The action MUST cap the serialized response to a maximum size (e.g., 100KB) and indicate when truncation occurs.
- **FR-004**: The action MUST report execution metadata including elapsed time, detected URL change, and result type to guide follow-up steps.
- **FR-005**: The action MUST return structured error details (message and stack trace where available) when the script throws.
- **FR-006**: When `browser_click_element` locates a target but the native click exceeds its allowed wait, the system MUST automatically retry with a JavaScript-based click on the same handle before failing the action.
- **FR-007**: The click action MUST flag when the JS fallback path was used and still perform the normal readiness/wait logic after the fallback click.
- **FR-008**: If both native and fallback clicks fail, the system MUST return a consolidated failure response that lists both attempts and their errors.

### Key Entities *(include if feature involves data)*

- **Action Request**: Captures the target tab/url, script content, timeout, and desired return handling for a single execution.
- **Action Response**: Contains the serialized result, metadata (duration, truncation flag, URL change flag), and structured errors when applicable.
- **Click Attempt**: Tracks the native click outcome, fallback click outcome, and whether post-click readiness checks ran.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Targeted inbox-style extraction succeeds in 95% of acceptance runs using ≤2 tool calls, with each `browser_execute_javascript` response completing in under 5 seconds.
- **SC-002**: For elements that previously timed out, the automatic JS fallback yields a successful click outcome in at least 90% of measured scenarios during acceptance testing.
- **SC-003**: No JS execution run exceeds the configured timeout or returns more than the capped payload size; 100% of over-limit cases report clear timeout or truncation status.
- **SC-004**: 100% of failure responses from JS execution or fallback clicks include actionable error details and flags so users can decide the next step without re-running the same command blindly.
