# Data Model: Google Calendar Plugin

**Feature**: 004-google-calendar-plugin  
**Date**: 2026-04-06  
**Source**: [spec.md](spec.md) Key Entities section

## Entities

### EventSummary

A lightweight representation of an event extracted from a calendar view (day, week, month, search results).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | yes | Event title/name |
| `startDate` | string (ISO date) | yes | Start date (`"2026-04-07"`) |
| `startTime` | string (HH:MM) or null | conditional | Start time in Calendar's display time zone. Null for all-day events. |
| `endDate` | string (ISO date) | yes | End date |
| `endTime` | string (HH:MM) or null | conditional | End time. Null for all-day events. |
| `allDay` | boolean | yes | Whether event spans entire day(s) |
| `location` | string or null | no | Event location (empty/null if not set) |
| `calendarName` | string | yes | Name of the calendar the event belongs to |
| `calendarColor` | string or null | no | Calendar color indicator (hex or name if extractable) |
| `eventId` | string or null | no | Google Calendar internal event ID (extracted from `data-eventid` when available) |
| `index` | number | yes | 0-based positional index in the current view |

**Used by**: `list_events`, `search_events`, `check_availability`

**Notes**:
- Times are reported as displayed in Google Calendar UI (user's configured time zone). No time zone conversion is attempted.
- `eventId` may be null if the DOM does not expose `data-eventid` for a particular event. In that case, `index` is the only reference mechanism.
- `index` is ephemeral — valid only for the current view state. If the view changes, indices become stale (FR-024).

---

### EventDetail

A full event representation with all metadata, returned when an event is opened.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| *All EventSummary fields* | — | — | Inherited from EventSummary |
| `description` | string or null | no | Event description/notes (HTML preserved if present) |
| `organizer` | string or null | no | Organizer's display name or email |
| `attendees` | Attendee[] | no | Array of attendees (empty array if no attendees) |
| `recurrence` | string or null | no | Human-readable recurrence summary (e.g., "Every Monday") or null for non-recurring |
| `conferencingLink` | string or null | no | Google Meet, Zoom, or other video conferencing URL |
| `conferencingType` | string or null | no | Type identifier (e.g., "Google Meet", "Zoom") |

**Used by**: `read_event`

**Notes**:
- Description is extracted from `contenteditable` or detail popup. If HTML formatting is present, it is preserved (consistent with Gmail's HTML body preservation).
- `recurrence` is a display-only summary. The plugin does not parse recurrence rules (RRULE).

---

### Attendee

A participant in a calendar event.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | yes | Attendee's email address |
| `displayName` | string or null | no | Attendee's display name (null if only email visible) |
| `rsvpStatus` | enum | yes | One of: `"accepted"`, `"declined"`, `"tentative"`, `"needs-action"` |
| `isOrganizer` | boolean | yes | Whether this attendee is the event organizer |

**Used by**: `EventDetail.attendees`

**Notes**:
- `rsvpStatus` is extracted from the event detail popup. If the status indicator is ambiguous due to CSS-only styling, falls back to `"needs-action"`.
- The `isOrganizer` flag is derived from the "Organizer" label in the attendee list or matching the organizer field.

---

### AvailabilitySlot

A representation of a time window's status for the `check_availability` action.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `startTime` | string (HH:MM) | yes | Slot start time |
| `endTime` | string (HH:MM) | yes | Slot end time |
| `status` | enum | yes | `"free"` or `"busy"` |
| `conflicts` | EventSummary[] | conditional | Array of conflicting events. Present only when `status` is `"busy"`. |

**Used by**: `check_availability` response

**Notes**:
- When `check_availability` is called with a narrow window, a single AvailabilitySlot is returned.
- When called with a wide range (e.g., 09:00–17:00), the response contains multiple slots alternating between free and busy windows.
- All-day events are treated as conflicts for any time slot within that day.

---

### CalendarView (enum)

Internal view state detected by `detectView()` in helpers.js.

| Value | URL Pattern | Description |
|-------|-------------|-------------|
| `DAY` | `/r/day` | Day view showing one day |
| `WEEK` | `/r/week` | Week view showing 7 days |
| `MONTH` | `/r/month` | Month view grid |
| `SCHEDULE` | `/r/agenda` or `/r/list` | Schedule/agenda list view |
| `CUSTOM` | `/r/customday` | Custom multi-day view |
| `EVENT_DETAIL` | — (dialog open) | Event detail popup is open |
| `EVENT_FORM` | `/r/eventedit` | Event creation/edit form |
| `SEARCH_RESULTS` | `/r/search` | Search results displayed |
| `LOADING` | `calendar.google.com` | Page is loading (spinners visible) |
| `NOT_CALENDAR` | other | URL is not Google Calendar |
| `NOT_READY` | `calendar.google.com` | Calendar URL but content not stabilized |

**Used by**: `helpers.detectView()`, all action precondition checks

---

## Relationships

```text
EventDetail ──extends──▸ EventSummary
EventDetail ──has many──▸ Attendee
AvailabilitySlot ──has many──▸ EventSummary (conflicts)
```

## Validation Rules

| Entity | Rule | Source |
|--------|------|--------|
| EventSummary | `title` must be non-empty | FR-003 |
| EventSummary | `startDate` must be valid ISO date | FR-003 |
| EventSummary | `allDay=true` implies `startTime` and `endTime` are null | FR-020 |
| EventSummary | `index` is 0-based within current view | FR-016, FR-024 |
| Attendee | `email` must be non-empty | FR-004 |
| Attendee | `rsvpStatus` must be one of the four enum values | FR-009 |
| AvailabilitySlot | `startTime` < `endTime` | FR-010 |
| AvailabilitySlot | `conflicts` is non-empty iff `status` is `"busy"` | FR-010 |
| create_event params | `title` is required | FR-005 |
| create_event params | `save` defaults to `false` | FR-015 |
| rsvp_event params | `response` must be one of: `"accept"`, `"decline"`, `"tentative"` | FR-009 |

## State Transitions

The plugin itself is stateless (FR-017). State transitions describe Google Calendar's view transitions triggered by plugin actions:

```text
[Any Calendar View]
  ├── list_events(date) ──▸ [DAY/WEEK/MONTH] (navigates if date provided)
  ├── list_events() ──▸ [unchanged] (stays on current view)
  ├── read_event(index) ──▸ [EVENT_DETAIL] (popup opens)
  ├── create_event() ──▸ [EVENT_FORM] (form opens)
  ├── search_events(query) ──▸ [SEARCH_RESULTS]
  ├── edit_event(index) ──▸ [EVENT_FORM] (form opens for existing event)
  ├── delete_event(index) ──▸ [previous view] (event removed, dialog closes)
  ├── rsvp_event(index) ──▸ [EVENT_DETAIL] → [previous view] (RSVP submitted)
  └── check_availability() ──▸ [DAY] (navigates to target date)
```
