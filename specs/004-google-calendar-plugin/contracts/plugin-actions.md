# Plugin Action Contracts: Google Calendar (`gcal`)

**Feature**: 004-google-calendar-plugin  
**Date**: 2026-04-06  
**Interface Version**: 1

This document defines the contracts for the `gcal` plugin's 8 actions as dispatched through `plugin_action` and `plugin_info`.

---

## Plugin Discovery

### `plugin_info({ plugin: "gcal" })`

**Response**:
```json
{
  "description": "Google Calendar plugin — interact with Google Calendar for scheduling, event management, and availability checking.",
  "targetPages": ["Google Calendar (calendar.google.com)"],
  "authFlow": "User must be signed into Google Calendar in the browser. Keyboard shortcuts must be enabled in Calendar Settings.",
  "actions": [
    { "name": "list_events", "description": "...", "params": [...] },
    { "name": "read_event", "description": "...", "params": [...] },
    { "name": "create_event", "description": "...", "params": [...] },
    { "name": "search_events", "description": "...", "params": [...] },
    { "name": "edit_event", "description": "...", "params": [...] },
    { "name": "rsvp_event", "description": "...", "params": [...] },
    { "name": "delete_event", "description": "...", "params": [...] },
    { "name": "check_availability", "description": "...", "params": [...] }
  ]
}
```

---

## Action Contracts

### `list_events`

List events visible in the current calendar view.

**Params**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `date` | string | no | — | ISO date to navigate to (e.g., `"2026-04-10"`). If omitted, uses current view. |
| `view` | string | no | — | Calendar view: `"day"`, `"week"`, `"month"`, `"schedule"`. If omitted, uses current view. |
| `limit` | number | no | 25 | Maximum number of events to return. |

**Success Response** (`GCalActionResponse`):

```json
{
  "events": [EventSummary, ...],
  "view": "week",
  "dateRange": { "start": "2026-04-06", "end": "2026-04-12" },
  "total": 12,
  "nextSteps": [
    "Use read_event with { index: N } to see full details of a specific event",
    "Use create_event to schedule a new event",
    "Use search_events with { query: \"...\" } to find specific events"
  ]
}
```

**Error Cases**:
- Not on Google Calendar → `ErrorResponse("Google Calendar is not the active page. Use fetch_webpage to navigate to calendar.google.com first.", [...])`
- Page not loaded → `ErrorResponse("Google Calendar is still loading. Wait a moment and try again.", [...])`

---

### `read_event`

Open an event and extract full details.

**Params**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `index` | number | conditional | — | 0-based positional index of the event in current view. |
| `id` | string | conditional | — | Google Calendar event ID (from previous `list_events`). |

One of `index` or `id` is required. `id` takes precedence when both provided.

**Success Response**:

```json
{
  "event": EventDetail,
  "nextSteps": [
    "Use edit_event to modify this event",
    "Use rsvp_event with { response: \"accept\" } to respond to this invitation",
    "Use delete_event to remove this event",
    "Use list_events to return to the calendar view"
  ]
}
```

**Error Cases**:
- Index out of range → `ErrorResponse("Event index 5 is out of range. The current view has 3 events (indices 0-2). Use list_events to refresh.", [...])`
- No events visible → `ErrorResponse("No events visible in the current view. Use list_events to navigate to a date with events.", [...])`

---

### `create_event`

Open the event creation form and fill in fields.

**Params**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `title` | string | **yes** | — | Event title. |
| `date` | string | no | today | ISO date (e.g., `"2026-04-07"`). |
| `startTime` | string | no | — | Start time in HH:MM format. Ignored if `allDay: true`. |
| `endTime` | string | no | — | End time in HH:MM format. Ignored if `allDay: true`. |
| `allDay` | boolean | no | false | Create an all-day event. |
| `location` | string | no | — | Event location. |
| `description` | string | no | — | Event description/notes. |
| `attendees` | string[] | no | — | Array of attendee email addresses. |
| `save` | boolean | no | **false** | Whether to save the event. Default `false` to prevent accidental modifications. |

**Success Response**:

```json
{
  "status": "created",
  "title": "Team Standup",
  "date": "2026-04-07",
  "startTime": "09:00",
  "endTime": "09:30",
  "saved": false,
  "nextSteps": [
    "Review the event in the browser and save manually",
    "Use list_events to verify the event appears on the calendar"
  ]
}
```

With `save: true`:
```json
{
  "status": "saved",
  "title": "Team Standup",
  "saved": true,
  "nextSteps": [
    "Use list_events to see the event on the calendar",
    "Use read_event to view full details"
  ]
}
```

**Error Cases**:
- Missing title → `ErrorResponse("Title is required for create_event. Example: { title: \"Meeting\", date: \"2026-04-07\", startTime: \"14:00\", endTime: \"15:00\" }", [...])`
- Keyboard shortcuts disabled → `ErrorResponse("Google Calendar keyboard shortcuts are not enabled. Go to Calendar Settings → Keyboard shortcuts → Enable keyboard shortcuts.", [...])`

---

### `search_events`

Search for events matching a keyword query.

**Params**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `query` | string | **yes** | — | Search keywords. |
| `limit` | number | no | 25 | Maximum results to return. |

**Success Response**:

```json
{
  "events": [EventSummary, ...],
  "query": "standup",
  "total": 8,
  "nextSteps": [
    "Use read_event with { index: N } to see full details",
    "Use list_events to return to the calendar view"
  ]
}
```

**Error Cases**:
- Missing query → `ErrorResponse("Query is required for search_events. Example: { query: \"standup\" }", [...])`
- No results → Success response with empty `events` array and message "No events matching 'standup' were found."

---

### `edit_event`

Modify an existing event's fields.

**Params**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `index` | number | conditional | — | 0-based positional index. |
| `id` | string | conditional | — | Event ID. |
| `title` | string | no | — | New title. |
| `date` | string | no | — | New date (`"2026-04-08"`). |
| `startTime` | string | no | — | New start time. |
| `endTime` | string | no | — | New end time. |
| `location` | string | no | — | New location. |
| `description` | string | no | — | New description. |
| `attendees` | string[] | no | — | New attendee list (replaces existing). |
| `allDay` | boolean | no | — | Toggle all-day. |
| `save` | boolean | no | **false** | Whether to save changes. |

One of `index` or `id` is required to identify the event.

**Success Response**:

```json
{
  "status": "edited",
  "fieldsUpdated": ["startTime", "endTime"],
  "saved": true,
  "nextSteps": [
    "Use read_event to verify the changes",
    "Use list_events to see the updated calendar"
  ]
}
```

**Error Cases**:
- No event identifier → `ErrorResponse("Either 'index' or 'id' is required. Use list_events first to see available events.", [...])`
- Recurring event → Success with note: `"recurringNote": "Only this single occurrence was edited. Series editing is not supported in v1."`

---

### `rsvp_event`

Respond to a calendar invitation.

**Params**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `index` | number | conditional | — | 0-based positional index. |
| `id` | string | conditional | — | Event ID. |
| `response` | string | **yes** | — | One of: `"accept"`, `"decline"`, `"tentative"`. |

**Success Response**:

```json
{
  "status": "rsvp_submitted",
  "response": "accept",
  "eventTitle": "Weekly Sync",
  "nextSteps": [
    "Use list_events to return to the calendar view",
    "Use read_event to see updated RSVP status"
  ]
}
```

**Error Cases**:
- Invalid response value → `ErrorResponse("Response must be one of: accept, decline, tentative. Got: 'yes'", [...])`
- User is organizer → `ErrorResponse("RSVP is only available for events you were invited to. You are the organizer of this event.", [...])`

---

### `delete_event`

Remove an event from the calendar.

**Params**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `index` | number | conditional | — | 0-based positional index. |
| `id` | string | conditional | — | Event ID. |

**Success Response**:

```json
{
  "status": "deleted",
  "eventTitle": "Cancelled Meeting",
  "nextSteps": [
    "Use list_events to see the updated calendar",
    "Use create_event to schedule a replacement event"
  ]
}
```

**Error Cases**:
- Recurring event → Success with note: `"recurringNote": "Only this single occurrence was deleted. Series deletion is not supported in v1."`

---

### `check_availability`

Determine whether a time window is free or busy.

**Params**:

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `date` | string | **yes** | — | ISO date to check. |
| `startTime` | string | **yes** | — | Window start (HH:MM). |
| `endTime` | string | **yes** | — | Window end (HH:MM). |

**Success Response** (free):

```json
{
  "date": "2026-04-07",
  "startTime": "14:00",
  "endTime": "15:00",
  "status": "free",
  "slots": [
    { "startTime": "14:00", "endTime": "15:00", "status": "free", "conflicts": [] }
  ],
  "nextSteps": [
    "Use create_event to schedule an event in this free slot",
    "Use list_events to see all events for this day"
  ]
}
```

**Success Response** (busy):

```json
{
  "date": "2026-04-07",
  "startTime": "14:00",
  "endTime": "15:00",
  "status": "busy",
  "slots": [
    { "startTime": "14:00", "endTime": "14:30", "status": "busy", "conflicts": [EventSummary] },
    { "startTime": "14:30", "endTime": "15:00", "status": "free", "conflicts": [] }
  ],
  "nextSteps": [
    "Use list_events with { date: \"2026-04-07\" } to see all events",
    "Use check_availability with a different time to find free slots"
  ]
}
```

**Error Cases**:
- Missing required params → `ErrorResponse("date, startTime, and endTime are all required for check_availability. Example: { date: \"2026-04-07\", startTime: \"14:00\", endTime: \"15:00\" }", [...])`
- startTime >= endTime → `ErrorResponse("startTime must be before endTime.", [...])`
