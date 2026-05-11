# Feature Specification: Google Calendar Plugin

**Feature Branch**: `004-google-calendar-plugin`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "Google Calendar plugin for MCPBrowser — a site plugin that enables AI agents to interact with Google Calendar through the browser, supporting actions like listing events, creating events, reading event details, editing events, deleting events, searching events, RSVPing to invitations, and checking availability. Uses the tiered interaction strategy (URL path navigation, keyboard shortcuts, ARIA/data attributes, CSS selectors) consistent with the Gmail plugin pattern. Shares Google auth flow and account-index URL patterns with Gmail."

## Clarifications

### Session 2026-04-06

- Q: What should the default limit be when `list_events` is called without a `limit` parameter? → A: 25 events — matches the Gmail plugin's `list_emails` default of 25; large enough for a full week of meetings, small enough to keep AI context windows manageable.
- Q: What is the canonical plugin name used in the manifest and all `browser_plugin_action`/`browser_plugin_info` calls? → A: `gcal` — short, unambiguous, and consistent with the abbreviated naming convention.
- Q: What happens when the calendar view changes between `list_events` and a subsequent index-targeted action (e.g., `edit_event`)? → A: Re-detect from current DOM — if the view or visible events have changed since the last `list_events` call, index-targeted actions must re-scan visible events and return an error if the target index is out of range, suggesting the agent call `list_events` again. Same stateless pattern as the Gmail plugin.
- Q: When `list_events` is called with no `view` or `date` parameter, should the plugin use the currently-displayed view or switch to a specific default? → A: Use the currently-displayed view — respect whatever view the user is already looking at (day, week, month, schedule) and extract events from it without forcing a view switch.
- Q: Should the plugin declare explicit cross-plugin interaction patterns with the Gmail plugin (e.g., "schedule a meeting from this email")? → A: No cross-plugin coupling in v1 — plugins are independent; the AI agent orchestrates multi-plugin workflows. The architecture does not preclude future cross-plugin helpers.

## Assumptions

- The plugin system from feature 002-site-plugins is implemented and available (plugin loader, registry, detection, `browser_plugin_action`/`browser_plugin_info` dispatch tools).
- The user is already authenticated into a Google account in the browser session managed by MCPBrowser before invoking plugin actions. The plugin does not handle Google account login.
- Google Calendar is accessed via the standard web interface at `calendar.google.com` (not embedded calendar widgets or third-party clients).
- The plugin targets the default Google Calendar layout (day, week, month, schedule views). Custom or workspace-specific layouts are out of scope for v1.
- Google Calendar keyboard shortcuts are expected to be enabled in the user's Calendar settings (Settings → Keyboard shortcuts → Enable keyboard shortcuts). The plugin will verify this and provide remediation guidance if disabled.
- Google Calendar's URL path scheme (`/r/day/2026/4/6`, `/r/week`, `/r/month`, `/r/search`) and keyboard shortcuts are considered stable public interfaces that change far less frequently than internal CSS class names.
- The plugin operates on whichever Google account is currently active. Multi-account switching is out of scope for v1.
- Recurring events are displayed and read as individual occurrences. Editing or deleting recurring event series ("this and following events" or "all events") is out of scope for v1 — only single-occurrence edits are supported.
- All-day events and timed events are both in scope. Multi-day events spanning more than one day are read-only (listing and reading) in v1.
- The plugin shares the same Google ecosystem URL patterns as the Gmail plugin, including the `/u/N/` account-index scheme which MUST be preserved during navigation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List Events for a Date or Range (Priority: P1)

An AI agent navigates to Google Calendar and asks the plugin to list events for today, a specific date, or a date range. The plugin navigates to the appropriate calendar view and extracts a structured list of events including title, time, location, and calendar name. The agent receives this data ready for summarization, scheduling decisions, or further action.

**Why this priority**: Listing events is the foundational read operation. Every calendar workflow — checking availability, scheduling, rescheduling — starts with knowing what events already exist. This validates that the plugin's detection, navigation, and extraction work end-to-end.

**Independent Test**: Navigate MCPBrowser to `calendar.google.com`, invoke `browser_plugin_action({ plugin: "gcal", action: "list_events" })`, and verify structured event data is returned with title, date/time, location, and calendar name for each visible event.

**Acceptance Scenarios**:

1. **Given** the browser is on Google Calendar showing today's schedule, **When** the agent calls `list_events` with no parameters, **Then** the plugin returns up to 25 events (default limit) visible in the current view with title, start time, end time, location (if set), calendar name, and all-day flag for each.
2. **Given** the browser is on Google Calendar, **When** the agent calls `list_events` with `{ date: "2026-04-10" }`, **Then** the plugin navigates to April 10, 2026 and returns events for that day.
3. **Given** the browser is on Google Calendar, **When** the agent calls `list_events` with `{ view: "week" }`, **Then** the plugin switches to week view and returns all events for the current week.
4. **Given** the browser is on a page that is not Google Calendar, **When** the agent calls `list_events`, **Then** the plugin returns an error stating Google Calendar must be the active page and suggests `browser_fetch_webpage` to navigate there first.
5. **Given** the agent calls `list_events` for a day with no events, **Then** an empty list is returned with a message confirming the date and that no events are scheduled.

---

### User Story 2 - Read Event Details (Priority: P1)

The agent selects an event from the list (or specifies one by index) and asks the plugin to open and read its full details. The plugin clicks into the event and extracts the complete event information: title, full date/time, location, description, attendees with RSVP statuses, organizer, calendar, recurrence info, and video conferencing link if present.

**Why this priority**: Reading full event details is the core value proposition — the agent cannot summarize meetings, prepare agendas, or understand scheduling conflicts without seeing complete event data. Combined with list_events, this completes the essential read path.

**Independent Test**: After listing events, invoke `browser_plugin_action({ plugin: "gcal", action: "read_event", params: { index: 0 } })` and verify the full event details are returned.

**Acceptance Scenarios**:

1. **Given** a day or week view is displayed with events listed, **When** the agent calls `read_event` with `{ index: 0 }`, **Then** the plugin opens the first event's detail popup/page and returns: title, start/end date+time, location, description, organizer, attendees with RSVP status, calendar name, recurrence summary, and video conferencing link (if present).
2. **Given** the agent opens an all-day event, **When** `read_event` is called, **Then** the response shows start and end dates without specific times and the all-day flag is set.
3. **Given** the agent calls `read_event` with an index that exceeds the visible event count, **Then** an error is returned indicating the index is out of range and suggesting `list_events` to see available events.
4. **Given** the event has a Google Meet or Zoom link, **When** `read_event` is called, **Then** the conferencing link is included in the response.

---

### User Story 3 - Create a New Event (Priority: P1)

The agent asks the plugin to create a new calendar event. The plugin opens the event creation form, fills in the title, date/time, location, description, and attendees, and optionally saves it.

**Why this priority**: Creating events is the primary write operation and the highest-value action for an AI scheduling assistant. Agents need to create events from natural-language instructions, email content, or conversational context. This is P1 because calendar creation is a core differentiator for an AI agent.

**Independent Test**: Invoke `browser_plugin_action({ plugin: "gcal", action: "create_event", params: { title: "Team Standup", date: "2026-04-07", startTime: "09:00", endTime: "09:30" } })` and verify the event creation form is populated with the correct fields.

**Acceptance Scenarios**:

1. **Given** the browser is on Google Calendar, **When** the agent calls `create_event` with `{ title: "Team Standup", date: "2026-04-07", startTime: "09:00", endTime: "09:30" }`, **Then** the plugin opens the event creation form and fills in the title, date, start time, and end time.
2. **Given** the agent calls `create_event` with all fields including `{ title: "Offsite", date: "2026-04-15", startTime: "10:00", endTime: "16:00", location: "Building 5", description: "Quarterly planning", attendees: ["alice@example.com", "bob@example.com"], save: true }`, **Then** the plugin fills all fields, adds attendees, and saves the event.
3. **Given** the agent calls `create_event` without the `save` flag (or `save: false`), **Then** the event form is populated but not saved, allowing the user to review before saving.
4. **Given** the agent calls `create_event` without a title, **Then** an error is returned indicating that a title is required.
5. **Given** the agent calls `create_event` with `{ title: "Day Off", date: "2026-04-20", allDay: true }`, **Then** the plugin creates an all-day event without setting specific start/end times.

---

### User Story 4 - Search Events (Priority: P2)

The agent asks the plugin to search Google Calendar for events matching a query. The plugin uses Calendar's search functionality and returns matching events as a structured list.

**Why this priority**: Search enables agents to find specific meetings ("when is my next dentist appointment?", "find all 1:1s with Alice") without scanning through dates manually. It's P2 because list_events with specific dates covers many use cases, but search is essential for keyword-based lookups.

**Independent Test**: Invoke `browser_plugin_action({ plugin: "gcal", action: "search_events", params: { query: "standup" } })` and verify matching events are returned in the same structured format as `list_events`.

**Acceptance Scenarios**:

1. **Given** the browser is on Google Calendar, **When** the agent calls `search_events` with `{ query: "standup" }`, **Then** the plugin opens the search view, enters the query, waits for results, and returns matching events with title, date/time, and location.
2. **Given** a search query returns no results, **When** the agent calls `search_events`, **Then** the plugin returns an empty list with a message indicating no events matched the query.
3. **Given** a search query matches many results, **When** the agent calls `search_events` with `{ limit: 5 }`, **Then** at most 5 results are returned.

---

### User Story 5 - Edit an Existing Event (Priority: P2)

The agent asks the plugin to modify an existing event — change its time, title, location, description, or attendees. The plugin opens the event's edit form, updates the specified fields, and optionally saves.

**Why this priority**: Rescheduling and updating events is a common AI-assistant workflow ("move my 2pm to 3pm", "add Alice to the meeting"). It's P2 because creating and reading events must work first.

**Independent Test**: After reading an event, invoke `browser_plugin_action({ plugin: "gcal", action: "edit_event", params: { index: 0, startTime: "15:00", endTime: "16:00", save: true } })` and verify the event's time is updated.

**Acceptance Scenarios**:

1. **Given** the agent has listed events and an event exists at index 0, **When** `edit_event` is called with `{ index: 0, startTime: "15:00", endTime: "16:00" }`, **Then** the plugin opens the event's edit form, updates the start and end time, and leaves it for user review.
2. **Given** the agent calls `edit_event` with `{ index: 0, title: "Updated Standup", save: true }`, **Then** the plugin updates the title and saves the event.
3. **Given** no event view is currently displayed, **When** `edit_event` is called without first listing events, **Then** an error is returned suggesting `list_events` first.
4. **Given** the agent calls `edit_event` on a recurring event, **Then** the plugin edits only the single occurrence (not the series) and informs the agent that series editing is not supported in v1.

---

### User Story 6 - RSVP to an Event Invitation (Priority: P2)

The agent asks the plugin to respond to a calendar invitation — accept, decline, or tentatively accept. The plugin opens the event's detail view and submits the RSVP response.

**Why this priority**: RSVP is a key scheduling workflow for AI agents managing a user's calendar ("accept the meeting with Alice", "decline the Friday social"). It's P2 because it requires the read path (list + read) to identify the event first.

**Independent Test**: After reading an event with an invitation, invoke `browser_plugin_action({ plugin: "gcal", action: "rsvp_event", params: { index: 0, response: "accept" } })` and verify the RSVP status is updated.

**Acceptance Scenarios**:

1. **Given** an event exists that the user was invited to, **When** the agent calls `rsvp_event` with `{ index: 0, response: "accept" }`, **Then** the plugin opens the event and clicks the "Yes" RSVP button.
2. **Given** the agent calls `rsvp_event` with `{ index: 1, response: "decline" }`, **Then** the plugin opens the event and clicks the "No" RSVP button.
3. **Given** the agent calls `rsvp_event` with `{ index: 2, response: "tentative" }`, **Then** the plugin opens the event and clicks the "Maybe" RSVP button.
4. **Given** the event is one the user created (not an invitation), **When** `rsvp_event` is called, **Then** an error is returned indicating RSVP is only available for events the user was invited to.

---

### User Story 7 - Delete an Event (Priority: P3)

The agent asks the plugin to delete a calendar event. The plugin opens the event and removes it from the calendar.

**Why this priority**: Deleting events is a lower-frequency action compared to creating, reading, and editing. It completes the CRUD lifecycle but is not commonly the primary AI agent task.

**Independent Test**: After listing events, invoke `browser_plugin_action({ plugin: "gcal", action: "delete_event", params: { index: 0 } })` and verify the event is removed.

**Acceptance Scenarios**:

1. **Given** events are listed and an event exists at index 0, **When** the agent calls `delete_event` with `{ index: 0 }`, **Then** the plugin opens the event, clicks delete, confirms the deletion, and the event no longer appears in the calendar.
2. **Given** the agent calls `delete_event` on a recurring event, **Then** only the single occurrence is deleted and the agent is informed that deleting the entire series is not supported in v1.
3. **Given** the agent calls `delete_event` with an out-of-range index, **Then** an error is returned indicating the index is invalid.

---

### User Story 8 - Check Availability (Priority: P3)

The agent asks the plugin to check whether a time slot is free or busy on the user's calendar. The plugin navigates to the requested date and determines if any events overlap the given time window.

**Why this priority**: Availability checking is a convenience built on top of `list_events` — the agent could manually list events and check for overlaps, but a dedicated action simplifies multi-step scheduling workflows. It's P3 because it can be composed from P1 actions.

**Independent Test**: Invoke `browser_plugin_action({ plugin: "gcal", action: "check_availability", params: { date: "2026-04-07", startTime: "14:00", endTime: "15:00" } })` and verify a free/busy response is returned.

**Acceptance Scenarios**:

1. **Given** the agent calls `check_availability` with `{ date: "2026-04-07", startTime: "14:00", endTime: "15:00" }` and no events overlap, **Then** the response indicates the time slot is free.
2. **Given** the same call is made but a meeting exists from 14:00–14:30, **Then** the response indicates the time slot is busy and includes the conflicting event(s) with title and time.
3. **Given** the agent calls `check_availability` with `{ date: "2026-04-07", startTime: "09:00", endTime: "17:00" }`, **Then** the response lists all busy slots and free windows within the range.

---

### Edge Cases

- What happens when Google Calendar's UI hasn't fully loaded (spinners, skeleton screens)? The plugin must wait for content to be ready before extracting data, with a 10-second timeout and a clear error if the page doesn't stabilize.
- What happens when Google Calendar shows a CAPTCHA, security prompt, or account verification interstitial? The plugin should detect these states and return an error asking the user to resolve the prompt manually in the browser.
- What happens when the Calendar UI language is not English? The plugin should rely on structural selectors (ARIA roles, data attributes, DOM structure) rather than visible text labels to be language-agnostic where possible.
- What happens when Google Calendar rolls out a UI update that changes CSS class names? Because the plugin primarily uses URL navigation, keyboard shortcuts, and ARIA/structural selectors, most actions are unaffected. For Tier 4 CSS selectors, the plugin should fail gracefully with descriptive errors identifying which selector failed.
- What happens when the event creation form is already open and `create_event` is called? The plugin should detect an existing form dialog and either reuse it or close it before opening a new one, warning the user if unsaved content would be lost.
- What happens when the user's time zone in Google Calendar differs from the agent's expectations? The plugin should extract and report times as displayed in Google Calendar's UI (the user's configured time zone) and not attempt time zone conversion.
- What happens when events from multiple calendars (personal, work, shared) are visible? The plugin should extract and return the calendar name for each event, allowing the agent to filter or distinguish between calendars.
- What happens when the agent requests a date range that spans across months/years? The plugin should navigate correctly using the URL path scheme regardless of date boundaries.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST implement the standard MCPBrowser plugin interface (manifest, `matchesPage`, `getActions`, `getInfo`) as defined by feature 002-site-plugins. The manifest `name` MUST be `gcal`.
- **FR-002**: The plugin MUST detect Google Calendar pages by matching against `calendar.google.com` in the URL and verifying Calendar-specific DOM markers for confidence scoring.
- **FR-003**: The plugin MUST provide a `list_events` action that extracts visible events from the current calendar view and returns structured data: event title, start date/time, end date/time, location, calendar name, all-day flag, and event ID (if extractable from the DOM). The default limit MUST be 25 events when no `limit` parameter is provided. When called with no `view` or `date` parameter, the plugin MUST use the currently-displayed calendar view without forcing a view switch.
- **FR-004**: The plugin MUST provide a `read_event` action that opens an event by index and extracts full details: title, start/end date+time, location, description, organizer, attendees with RSVP statuses, calendar name, recurrence summary, video conferencing link, and all-day flag.
- **FR-005**: The plugin MUST provide a `create_event` action that opens the event creation form and fills in title, date, start time, end time, location (optional), description (optional), and attendees (optional), with an option to save immediately or leave for user review. All-day events MUST be supported via an `allDay` parameter.
- **FR-006**: The plugin MUST provide a `search_events` action that uses Google Calendar's search functionality to find events matching a keyword query and returns results in the same structured format as `list_events`.
- **FR-007**: The plugin MUST provide an `edit_event` action that opens an existing event's edit form, updates specified fields (title, date/time, location, description, attendees), and optionally saves. For recurring events, only the single occurrence MUST be edited — series editing is out of scope for v1.
- **FR-008**: The plugin MUST provide a `delete_event` action that removes a single event from the calendar with confirmation. For recurring events, only the single occurrence MUST be deleted.
- **FR-009**: The plugin MUST provide an `rsvp_event` action that responds to calendar invitations with accept, decline, or tentative. The action MUST detect whether the user was invited (vs. being the organizer) and return an error if RSVP is not applicable.
- **FR-010**: The plugin MUST provide a `check_availability` action that determines whether a specified time window on a given date is free or busy by examining visible events on the calendar, returning conflicting events when the slot is busy and free windows when checking a range.
- **FR-011**: All actions MUST follow a tiered interaction strategy consistent with the Gmail plugin, preferring the most stable interface available for each operation:
  - **Tier 1 — URL path scheme**: For navigation to views and dates (`/r/day/2026/4/6`, `/r/week/2026/4/6`, `/r/month/2026/4`, `/r/customday`, `/r/search`). Most stable; part of Google Calendar's public URL contract.
  - **Tier 2 — Keyboard shortcuts**: For actions (create event: `c`, search: `/`, navigate forward: `j` or `n`, navigate backward: `k` or `p`, day view: `1`/`d`, week view: `2`/`w`, month view: `3`/`m`, today: `t`, delete: `Delete`/`Backspace`, undo: `z`). Stable; publicly documented by Google.
  - **Tier 3 — ARIA roles, `data-*` attributes, `name` attributes, and semantic HTML**: For data extraction and form filling (`role="main"`, `role="dialog"`, `role="listbox"`, `data-eventid`, `data-datekey`, `aria-label` on event chips, `contenteditable` fields, `input` fields in event form). Moderately stable; tied to accessibility standards.
  - **Tier 4 — CSS class selectors**: Only as a last resort for DOM elements that lack ARIA roles or data attributes. These selectors MUST be centralized in a single versioned selectors module.
- **FR-012**: All actions MUST wait for Google Calendar's dynamic content to load before extracting data, with a maximum timeout of 10 seconds. If content does not stabilize within the timeout, the action MUST return a clear error indicating the page did not finish loading.
- **FR-013**: All actions MUST return structured responses using the MCPBrowser response format with contextual `nextSteps` guiding the agent to logical follow-up actions.
- **FR-014**: The plugin MUST return clear, actionable error messages when Google Calendar is not the active page, when an expected element is not found, or when a prerequisite action hasn't been performed.
- **FR-015**: The `create_event` and `edit_event` actions MUST NOT save changes by default — saving requires an explicit `save: true` parameter to prevent accidental calendar modifications by the AI agent.
- **FR-016**: All actions that reference a specific event MUST accept either a Calendar event ID (if previously returned by `list_events` or `search_events`) or a 0-based positional index as a fallback. When event IDs are extractable from the DOM, `list_events` and `search_events` MUST include them in the response.
- **FR-017**: The plugin MUST be stateless between action calls — each action MUST detect the current Calendar view (day, week, month, schedule, event detail, event form, search results) by inspecting the DOM and URL at invocation time, not by relying on internal state from previous calls.
- **FR-018**: The plugin MUST detect whether Google Calendar keyboard shortcuts are enabled before relying on them. If shortcuts are disabled, the plugin MUST return an actionable error message explaining how to enable them (Calendar Settings → Keyboard shortcuts → Enable keyboard shortcuts).
- **FR-019**: All URL-based navigation MUST preserve the current account index (`/u/N/`) extracted from the active page URL — the account index MUST NOT be hardcoded.
- **FR-020**: The `create_event` and `edit_event` actions MUST handle both timed events and all-day events. When `allDay: true` is set, time fields MUST be ignored and the all-day toggle MUST be activated in the event form.
- **FR-021**: All CSS class selectors (Tier 4) MUST be centralized in a single selectors module, versioned and documented, so that a Calendar UI update can be resolved by updating selector values in one place without modifying action logic.
- **FR-022**: Before sending any keyboard shortcut (Tier 2), the plugin MUST verify the required precondition via DOM or URL inspection (e.g., an event must be selected before pressing `Delete`). If the precondition is not met, the plugin MUST fail immediately with an actionable error message.
- **FR-023**: When the event detail popup or edit form is already open and a new action targets a different event, the plugin MUST close the existing popup/form before proceeding.
- **FR-024**: All index-targeted actions (`read_event`, `edit_event`, `delete_event`, `rsvp_event`) MUST re-scan visible events from the current DOM at invocation time. If the calendar view or visible events have changed since the last `list_events` call, the action MUST return an error indicating the index may be stale and suggest calling `list_events` again to refresh.
- **FR-025**: The plugin MUST NOT declare or implement any cross-plugin dependencies with the Gmail plugin or other plugins. Multi-plugin workflows (e.g., scheduling a meeting from an email) are orchestrated by the AI agent, not by plugin-to-plugin coupling.

### Key Entities

- **Event Summary**: A lightweight representation of an event in a calendar view — title, start date/time, end date/time, location, calendar name, all-day flag, event ID. Used by `list_events`, `search_events`, and `check_availability`.
- **Event Detail**: A full event representation — contains all summary fields plus description, organizer, attendees with RSVP statuses, recurrence summary, video conferencing link, and creation/modification timestamps. Used by `read_event`.
- **Attendee**: A participant in a calendar event — email address, display name (if available), RSVP status (accepted, declined, tentative, needs-action), and organizer flag.
- **Availability Slot**: A representation of a time window's status — start time, end time, status (free/busy), and conflicting events (if busy). Used by `check_availability`.
- **Calendar**: A named calendar the event belongs to — name and color. Events from multiple visible calendars are all returned by `list_events`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An AI agent can list and read calendar events in under 5 seconds per action on a standard connection, enabling real-time conversational scheduling workflows.
- **SC-002**: The plugin correctly extracts event data (title, time, location, attendees) from at least 95% of standard Google Calendar events without data loss.
- **SC-003**: An AI agent can create a new event through a single `create_event` action call with all fields correctly populated and the event appearing on the calendar after save.
- **SC-004**: All plugin actions provide contextual next-step guidance, enabling an AI agent to chain actions (list → read → edit, or check_availability → create) without requiring external documentation.
- **SC-005**: When Google Calendar is not loaded or a prerequisite is missing, 100% of error responses include a specific remediation step the agent can follow to recover.
- **SC-006**: The plugin operates correctly regardless of Google Calendar's display language setting, relying on structural selectors rather than visible text.
- **SC-007**: At least 70% of plugin interactions (navigation + actions) use Tier 1 (URL) or Tier 2 (keyboard) methods that do not depend on CSS class selectors, minimizing breakage risk from UI updates.
- **SC-008**: When a Google Calendar UI update breaks CSS selectors, the fix requires changes only to the centralized selectors module — no action logic files need modification.
