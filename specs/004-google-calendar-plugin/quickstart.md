# Quickstart: Google Calendar Plugin (`gcal`)

**Feature**: 004-google-calendar-plugin  
**Date**: 2026-04-06

## Prerequisites

1. MCPBrowser is running and connected to an MCP client (e.g., VS Code Copilot, Claude Desktop)
2. User is signed into Google Calendar in their browser (Chrome, Edge, or Brave)
3. Google Calendar keyboard shortcuts are enabled: Calendar Settings → Keyboard shortcuts → Enable keyboard shortcuts
4. The `gcal` plugin is registered in `MCPBrowser/src/plugins.json`

## Setup

Navigate to Google Calendar:
```
browser_fetch_webpage({ url: "https://calendar.google.com" })
```

The MCP response will include nextSteps indicating the `gcal` plugin is available:
```
"nextSteps": ["Google Calendar plugin detected. Use browser_plugin_info({ plugin: 'gcal' }) to see available actions."]
```

## Common Workflows

### 1. List Today's Events

```
browser_plugin_action({ plugin: "gcal", action: "list_events" })
```

Returns up to 25 events from the currently-displayed view.

### 2. Check a Specific Date

```
browser_plugin_action({ plugin: "gcal", action: "list_events", params: { date: "2026-04-10", view: "day" } })
```

### 3. Read Event Details

```
browser_plugin_action({ plugin: "gcal", action: "read_event", params: { index: 0 } })
```

Opens the first event and returns full details: title, time, location, description, attendees, conferencing link.

### 4. Create an Event

```
browser_plugin_action({
  plugin: "gcal",
  action: "create_event",
  params: {
    title: "Team Standup",
    date: "2026-04-07",
    startTime: "09:00",
    endTime: "09:30",
    location: "Room 3B",
    attendees: ["alice@example.com"],
    save: true
  }
})
```

Note: `save` defaults to `false` — the form is populated but not submitted until `save: true` is explicitly set.

### 5. Search for Events

```
browser_plugin_action({ plugin: "gcal", action: "search_events", params: { query: "standup" } })
```

### 6. Check Availability

```
browser_plugin_action({
  plugin: "gcal",
  action: "check_availability",
  params: { date: "2026-04-07", startTime: "14:00", endTime: "15:00" }
})
```

Returns `"free"` or `"busy"` with conflicting events listed.

### 7. RSVP to an Invitation

```
browser_plugin_action({ plugin: "gcal", action: "rsvp_event", params: { index: 2, response: "accept" } })
```

### 8. Edit an Event

```
browser_plugin_action({
  plugin: "gcal",
  action: "edit_event",
  params: { index: 0, startTime: "15:00", endTime: "16:00", save: true }
})
```

### 9. Delete an Event

```
browser_plugin_action({ plugin: "gcal", action: "delete_event", params: { index: 0 } })
```

## Error Recovery

| Error | Recovery |
|-------|----------|
| "Google Calendar is not the active page" | `browser_fetch_webpage({ url: "https://calendar.google.com" })` |
| "Keyboard shortcuts are not enabled" | Enable in Calendar Settings → Keyboard shortcuts → Enable keyboard shortcuts |
| "Event index N is out of range" | `browser_plugin_action({ plugin: "gcal", action: "list_events" })` to refresh |
| "Page is still loading" | Wait a moment, then retry the action |

## Action Chaining

Common multi-step workflows the AI agent can follow:

1. **Email → Schedule**: Read email in Gmail → create_event with extracted meeting details
2. **Availability check → Create**: check_availability → if free, create_event
3. **Browse → Edit**: list_events → read_event → edit_event with changes
4. **Triage invitations**: list_events → read_event (for each invitation) → rsvp_event
