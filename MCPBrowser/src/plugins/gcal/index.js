/**
 * Google Calendar plugin — Site-specific automation for Google Calendar (calendar.google.com).
 * Implements the MCPBrowser plugin interface (interfaceVersion 1).
 *
 * Uses a tiered interaction strategy (FR-011):
 *   T1: URL path navigation for views/dates
 *   T2: Keyboard shortcuts for actions (create, delete, view switches)
 *   T3: ARIA / data attributes for data extraction and form filling
 *   T4: CSS class selectors (last resort, centralized in selectors.js)
 */

import { listEvents } from './actions/list-events.js';
import { readEvent } from './actions/read-event.js';
import { createEvent } from './actions/create-event.js';
import { searchEvents } from './actions/search-events.js';
import { editEvent } from './actions/edit-event.js';
import { rsvpEvent } from './actions/rsvp-event.js';
import { deleteEvent } from './actions/delete-event.js';
import { checkAvailability } from './actions/check-availability.js';

export const manifest = {
  name: "gcal",
  version: "1.0.0",
  description: "Google Calendar plugin for MCPBrowser — event management, scheduling, and availability with hybrid UI resilience (URL navigation, keyboard shortcuts, ARIA selectors, CSS fallback)",
  interfaceVersion: 1,
  urlPatterns: ["calendar.google.com"],
  domPatterns: ["div[role=\"main\"]", "[data-eventchip]"]
};

export function matchesPage(url, html) {
  try {
    if (url && url.includes('calendar.google.com')) {
      return { matched: true, confidence: 1.0 };
    }
    if (html && (html.includes('data-eventchip') || html.includes('data-datekey'))) {
      return { matched: true, confidence: 0.8 };
    }
    return { matched: false };
  } catch {
    return { matched: false };
  }
}

export function getActions() {
  return [
    {
      name: "list_events",
      description: "List visible events from the current Google Calendar view",
      params: [
        { name: "date", type: "string", description: "ISO date to navigate to (e.g., '2026-04-10'). If omitted, uses current view.", required: false },
        { name: "view", type: "string", description: "Calendar view: day, week, month, schedule. If omitted, uses current view.", required: false },
        { name: "limit", type: "number", description: "Maximum number of events to return (default: 25)", required: false, default: 25 }
      ],
      execute: listEvents
    },
    {
      name: "read_event",
      description: "Open an event and read its full details (attendees, description, conferencing link)",
      params: [
        { name: "index", type: "number", description: "0-based position in current event list", required: false },
        { name: "id", type: "string", description: "Google Calendar event ID", required: false }
      ],
      execute: readEvent
    },
    {
      name: "create_event",
      description: "Create a new calendar event with title, time, location, description, and attendees",
      params: [
        { name: "title", type: "string", description: "Event title", required: true },
        { name: "date", type: "string", description: "Event date (ISO format, e.g., '2026-04-07'). Default: today", required: false },
        { name: "startTime", type: "string", description: "Start time in HH:MM format. Ignored if allDay:true", required: false },
        { name: "endTime", type: "string", description: "End time in HH:MM format. Ignored if allDay:true", required: false },
        { name: "allDay", type: "boolean", description: "Create an all-day event", required: false, default: false },
        { name: "location", type: "string", description: "Event location", required: false },
        { name: "description", type: "string", description: "Event description/notes", required: false },
        { name: "attendees", type: "array", description: "Array of attendee email addresses", required: false },
        { name: "save", type: "boolean", description: "If true, save the event. Default: false (leave for review)", required: false, default: false }
      ],
      execute: createEvent
    },
    {
      name: "search_events",
      description: "Search Google Calendar for events matching a keyword query",
      params: [
        { name: "query", type: "string", description: "Search keywords", required: true },
        { name: "limit", type: "number", description: "Maximum results to return (default: 25)", required: false, default: 25 }
      ],
      execute: searchEvents
    },
    {
      name: "edit_event",
      description: "Modify an existing event's fields (time, title, location, description, attendees)",
      params: [
        { name: "index", type: "number", description: "0-based position in current event list", required: false },
        { name: "id", type: "string", description: "Google Calendar event ID", required: false },
        { name: "title", type: "string", description: "New title", required: false },
        { name: "date", type: "string", description: "New date (ISO format)", required: false },
        { name: "startTime", type: "string", description: "New start time (HH:MM)", required: false },
        { name: "endTime", type: "string", description: "New end time (HH:MM)", required: false },
        { name: "location", type: "string", description: "New location", required: false },
        { name: "description", type: "string", description: "New description", required: false },
        { name: "attendees", type: "array", description: "New attendee list (replaces existing)", required: false },
        { name: "allDay", type: "boolean", description: "Toggle all-day", required: false },
        { name: "save", type: "boolean", description: "If true, save changes. Default: false", required: false, default: false }
      ],
      execute: editEvent
    },
    {
      name: "rsvp_event",
      description: "Respond to a calendar invitation (accept, decline, or tentative)",
      params: [
        { name: "index", type: "number", description: "0-based position in current event list", required: false },
        { name: "id", type: "string", description: "Google Calendar event ID", required: false },
        { name: "response", type: "string", description: "RSVP response: accept, decline, or tentative", required: true }
      ],
      execute: rsvpEvent
    },
    {
      name: "delete_event",
      description: "Remove an event from Google Calendar",
      params: [
        { name: "index", type: "number", description: "0-based position in current event list", required: false },
        { name: "id", type: "string", description: "Google Calendar event ID", required: false }
      ],
      execute: deleteEvent
    },
    {
      name: "check_availability",
      description: "Check whether a time slot is free or busy on the calendar",
      params: [
        { name: "date", type: "string", description: "ISO date to check (required)", required: true },
        { name: "startTime", type: "string", description: "Window start time in HH:MM format (required)", required: true },
        { name: "endTime", type: "string", description: "Window end time in HH:MM format (required)", required: true }
      ],
      execute: checkAvailability
    }
  ];
}

export function getInfo() {
  return {
    description: "Google Calendar event management with hybrid UI resilience — list, read, create, search, edit, RSVP, delete events and check availability using URL navigation (T1), keyboard shortcuts (T2), ARIA selectors (T3), and CSS fallback (T4).",
    targetPages: ["Google Calendar (calendar.google.com)"],
    authFlow: "User must be signed into Google Calendar in the browser before using plugin actions. Keyboard shortcuts must be enabled in Calendar Settings.",
    actions: getActions().map(({ name, description, params }) => ({ name, description, params }))
  };
}
