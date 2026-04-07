# Research: Google Calendar Plugin

**Feature**: 004-google-calendar-plugin  
**Date**: 2026-04-06  
**Purpose**: Resolve all technical unknowns from the plan's Technical Context before design begins.

## 1. Google Calendar URL Path Scheme (Tier 1)

**Decision**: Use Google Calendar's URL path scheme for all navigation.

**Rationale**: Google Calendar uses a well-documented URL path scheme under `calendar.google.com/calendar/u/N/r/...` that is stable across updates. Unlike Gmail's hash-based scheme (`#inbox`), Calendar uses path-based routing (`/r/day`, `/r/week`).

**URL Patterns Verified**:

| Path | View/Action |
|------|-------------|
| `/r` or `/r/month` | Month view (default landing) |
| `/r/week` | Week view |
| `/r/day` | Day view |
| `/r/customday` | Custom multi-day view |
| `/r/agenda` or `/r/list` | Schedule/list view |
| `/r/day/2026/4/6` | Day view for specific date |
| `/r/week/2026/4/6` | Week view containing specific date |
| `/r/month/2026/4` | Month view for specific month |
| `/r/search` | Search results view |
| `/r/eventedit` | New event form |
| `/r/eventedit/<eventId>` | Edit existing event form |

**Account index**: Path always includes `/u/N/` where N is 0, 1, 2... for the active Google account. Must be extracted from current URL and preserved.

**Alternatives considered**: 
- Keyboard shortcuts for navigation (e.g., `t` for today) — rejected as primary method because they can't target specific dates. Used as supplement.
- Clicking sidebar links — rejected as fragile (CSS selectors change).

## 2. Google Calendar Keyboard Shortcuts (Tier 2)

**Decision**: Use keyboard shortcuts for actions consistent with Gmail plugin approach.

**Rationale**: Google Calendar's keyboard shortcuts are publicly documented by Google, stable across updates, and require no CSS selector dependencies. They must be enabled in settings.

**Verified Shortcuts**:

| Shortcut | Action | Notes |
|----------|--------|-------|
| `c` | Create new event | Opens quick-add or full event form |
| `/` | Focus search | Activates search input |
| `t` | Go to today | Navigates to current date |
| `1` or `d` | Day view | Switches to day view |
| `2` or `w` | Week view | Switches to week view |
| `3` or `m` | Month view | Switches to month view |
| `4` or `x` | Custom view | Switches to custom multi-day view |
| `5` or `a` | Schedule/agenda view | Switches to schedule view |
| `j` or `n` | Next period | Forward by day/week/month |
| `k` or `p` | Previous period | Back by day/week/month |
| `Delete` or `Backspace` | Delete event | When event is focused/selected |
| `e` | Event details | Opens event detail popup |
| `z` | Undo | Undoes last action |
| `Escape` | Close dialog | Dismisses popup/dialog |
| `?` | Show shortcuts help | Opens keyboard shortcuts overlay |

**Keyboard shortcut detection**: Same pattern as Gmail — send `?` to trigger the shortcuts help dialog, detect if it appears. If shortcuts are disabled, no dialog appears.

**Alternatives considered**:
- Clicking toolbar buttons — rejected as CSS class dependent.
- Using Calendar API — rejected per spec (stays within browser automation model).

## 3. Google Calendar DOM Structure (Tier 3 & 4)

**Decision**: Use ARIA roles and data attributes as primary extraction method, CSS selectors as last resort.

**Rationale**: Google Calendar is built with Closure Compiler (same as Gmail), meaning CSS class names are obfuscated and can change. However, Google maintains ARIA accessibility attributes and data attributes that are more stable.

### Tier 3 — Stable Identifiers

| Identifier | Purpose | Used By |
|------------|---------|---------|
| `[data-eventid]` | Event ID on event chips | list_events, read_event, edit_event, delete_event |
| `[data-datekey]` | Date key on day columns | list_events (date context) |
| `[data-eventchip]` | Event chip container | list_events (event discovery) |
| `[role="main"]` | Main calendar content area | All actions (content boundary) |
| `[role="dialog"]` | Modal dialogs (event detail, edit form) | read_event, create_event, edit_event |
| `[role="listbox"]` | Dropdown lists (time picker, attendee suggestions) | create_event, edit_event |
| `[role="grid"]` | Calendar grid (month view) | list_events (month view) |
| `[role="gridcell"]` | Individual day cells | list_events (day targeting) |
| `[aria-label]` on event chips | Event title and time as accessible label | list_events (primary extraction) |
| `input[aria-label]` | Form fields (title, location, etc.) | create_event, edit_event |
| `[contenteditable]` | Description field in event form | create_event, edit_event |
| `[data-guest-email]` | Attendee email in event detail | read_event |

### Tier 4 — CSS Selectors (Centralized in selectors.js)

These are the last-resort selectors for elements without ARIA/data attributes. They will be documented with a version date tag and must be updated when Google deploys breaking changes.

| Constant Name | Selector | Purpose |
|---------------|----------|---------|
| `EVENT_CHIP` | TBD during implementation | Event chip in calendar view |
| `EVENT_TITLE_IN_CHIP` | TBD | Title text within event chip |
| `EVENT_TIME_IN_CHIP` | TBD | Time text within event chip |
| `EVENT_LOCATION_IN_DETAIL` | TBD | Location in event detail popup |
| `EVENT_DESCRIPTION_IN_DETAIL` | TBD | Description in event detail popup |
| `ATTENDEE_ROW` | TBD | Individual attendee row in detail |
| `ATTENDEE_RSVP_STATUS` | TBD | RSVP status indicator |
| `RSVP_YES_BUTTON` | TBD | "Yes" RSVP button |
| `RSVP_NO_BUTTON` | TBD | "No" RSVP button |
| `RSVP_MAYBE_BUTTON` | TBD | "Maybe" RSVP button |
| `CALENDAR_COLOR_DOT` | TBD | Calendar color indicator on event |
| `SAVE_BUTTON` | TBD | Save/submit button in event form |

**Note**: Exact CSS selectors will be captured during implementation by inspecting live Google Calendar DOM. The `TBD` markers are implementation-time concerns, not spec clarifications — the architecture and fallback strategy are fully defined.

**Alternatives considered**:
- Google Calendar API (REST) — rejected per spec assumption: plugin stays within browser automation model.
- Screenshot + OCR for data extraction — rejected as too slow and unreliable for structured data.

## 4. Gmail Plugin Reusable Patterns

**Decision**: Mirror Gmail plugin architecture exactly, with Calendar-specific adaptations.

**Rationale**: The Gmail plugin's scaffold has been proven and tested. Reusing the same patterns ensures consistency, reduces onboarding friction, and allows future extraction of shared Google plugin utilities.

### Direct Reuse (architecture patterns)

| Pattern | Gmail Implementation | Calendar Adaptation |
|---------|---------------------|---------------------|
| Entry point | `index.js` with 4 exports | Identical — same manifest shape, matchesPage, getActions, getInfo |
| Selectors module | `selectors.js` with UPPER_SNAKE_CASE exports | Identical — version-tagged, grouped by UI section |
| Helpers module | `helpers.js` with stateless utilities | Same structure, Calendar-specific functions |
| Action files | `actions/<action-name>.js` single export | Identical — same `{ page, params }` signature |
| Response class | `GmailActionResponse extends MCPResponse` | `GCalActionResponse extends MCPResponse` |
| Test structure | `tests/plugins/gmail/*.test.js` | `tests/plugins/gcal/*.test.js` — same 1:1 mapping |

### Calendar-Specific Helpers (new in helpers.js)

| Function | Purpose | Gmail Equivalent |
|----------|---------|------------------|
| `getAccountIndex(url)` | Extract `/u/N/` from URL | Identical to Gmail's — could be a shared utility in future |
| `calendarNavigate(page, path)` | T1 URL path navigation | Analogous to `gmailNavigate(page, hash)` but uses paths |
| `detectView(page)` | Determine current view from URL + DOM | Analogous to Gmail's `detectView` but with Calendar view enum |
| `checkKeyboardShortcuts(page)` | Verify shortcuts enabled via `?` | Identical pattern to Gmail's |
| `checkPrecondition(page, req)` | Validate state before actions | Same pattern, Calendar-specific requirements |
| `waitForCalendar(page, selector, timeout?)` | Wait for dynamic content | Analogous to `waitForGmail` |
| `extractVisibleEvents(page, limit?)` | Extract event data from current view | Analogous to `extractEmailRows` but for Calendar events |
| `selectEvent(page, {index?, id?})` | Click/focus an event by index or ID | Analogous to `selectEmailRow` |
| `VIEW` enum | `DAY`, `WEEK`, `MONTH`, `SCHEDULE`, `EVENT_DETAIL`, `EVENT_FORM`, `SEARCH_RESULTS`, `LOADING`, `NOT_CALENDAR`, `NOT_READY` | Extended from Gmail's 7 values |
| `GCalActionResponse` | Response class with data spreading | Mirrors `GmailActionResponse` |

### Potential Future Shared Module

`getAccountIndex(url)` is identical between Gmail and Calendar (both extract `/u/N/` from a Google URL). Per FR-025 (no cross-plugin coupling in v1), this function is duplicated in each plugin's helpers.js. A future refactoring could extract it into a shared `plugins/_google-shared/` module.

## 5. View Detection Strategy

**Decision**: URL path as primary signal, DOM inspection as fallback.

**Rationale**: Google Calendar encodes the current view in the URL path (`/r/day`, `/r/week`, `/r/month`, `/r/agenda`). This is more reliable than DOM inspection because it doesn't depend on CSS classes.

**Detection Flow**:
1. Parse URL path after `/r/` → if matches known view pattern, return view enum
2. Check for `/r/eventedit` → EVENT_FORM view
3. Check for `/r/search` → SEARCH_RESULTS view
4. Check if `role="dialog"` exists → EVENT_DETAIL popup
5. Check if URL contains `calendar.google.com` → NOT_READY (URL matches but view unclear)
6. Default → NOT_CALENDAR

**Alternatives considered**:
- DOM-only detection using ARIA landmarks — rejected as primary because URL is more direct and doesn't require page evaluation.
- Session state tracking — rejected per FR-017 (stateless between calls).

## 6. Event Form Interaction Strategy

**Decision**: Keyboard shortcut (`c`) to open form, ARIA/input attributes for field filling, CSS selectors for save button only.

**Rationale**: The event creation/edit form uses standard HTML input elements with `aria-label` attributes for the title and location fields, and `contenteditable` for the description. These are more stable than CSS class selectors for Closure Compiler-generated code.

**Form Field Mapping**:

| Field | Interaction Method | Tier |
|-------|-------------------|------|
| Open form | `c` keyboard shortcut | T2 |
| Title | `input[aria-label]` matching title/event name | T3 |
| Date | Date input via aria-label or data attributes | T3 |
| Start time | Time picker dropdown via aria-label | T3 |
| End time | Time picker dropdown via aria-label | T3 |
| Location | `input[aria-label]` matching location | T3 |
| Description | `[contenteditable]` in form dialog | T3 |
| Attendees | Input field for guest emails | T3 |
| All-day toggle | Checkbox/toggle via aria-label | T3 |
| Save button | CSS selector (no stable ARIA identifier found) | T4 |
| Send invitations dialog | Dialog buttons via role="dialog" | T3 |

**Alternatives considered**:
- Tab-key navigation through form fields — too fragile, field order can change.
- Direct `page.evaluate()` to set input values — works but skips Calendar's onChange handlers; prefer user-like interaction via click+type.

## 7. Recurring Event Handling (v1 Scope)

**Decision**: Single-occurrence operations only. When Google Calendar shows the "Edit recurring event" dialog (This event / This and following events / All events), always select "This event."

**Rationale**: Per spec assumptions, recurring event series editing is out of scope for v1. The plugin must handle the dialog that Google Calendar automatically presents when editing or deleting a recurring event, but always selects the single-occurrence option.

**Implementation**: Detect `role="dialog"` with recurring-event content, click the "This event" option, then proceed with the action.

**Alternatives considered**:
- Ignoring the dialog — rejected because it would block the action flow.
- Supporting all three options — deferred to v2 per spec.

## 8. Plugin Registration

**Decision**: Add `"gcal"` to `MCPBrowser/src/plugins.json` `enabled` array.

**Rationale**: The plugin loader reads `plugins.json` to determine which plugins to load. Adding `"gcal"` makes the plugin discoverable.

**Alternatives considered**:
- Auto-discovery by scanning the plugins directory — not supported by current plugin loader; it requires explicit registration.
