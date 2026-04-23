/**
 * check-availability.js — Check whether a time slot is free or busy.
 *
 * Tier usage:
 *   T1: calendarNavigate + buildViewPath to navigate to day view for the date
 *   T3: extractVisibleEvents for event data extraction
 *   T4: EVENT_CHIP selector via waitForCalendar
 */

import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import {
  checkPrecondition,
  calendarNavigate,
  buildViewPath,
  waitForCalendar,
  extractVisibleEvents,
  GCalActionResponse
} from '../helpers.js';
import { EVENT_CHIP } from '../selectors.js';

/**
 * Parse HH:MM time string to total minutes since midnight.
 * @param {string} timeStr - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format minutes since midnight back to HH:MM.
 * @param {number} minutes
 * @returns {string}
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Check availability for a given date and time window.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} opts.params.date - ISO date to check (required)
 * @param {string} opts.params.startTime - Window start time in HH:MM (required)
 * @param {string} opts.params.endTime - Window end time in HH:MM (required)
 * @returns {Promise<GCalActionResponse|ErrorResponse>}
 */
export async function checkAvailability({ page, params }) {
  // Validate required params
  if (!params.date) {
    return new ErrorResponse(
      'The "date" parameter is required to check availability.',
      ['Provide a date: check_availability({ date: "2026-04-10", startTime: "09:00", endTime: "17:00" })']
    );
  }
  if (!params.startTime) {
    return new ErrorResponse(
      'The "startTime" parameter is required to check availability.',
      ['Provide a start time: check_availability({ date: "2026-04-10", startTime: "09:00", endTime: "17:00" })']
    );
  }
  if (!params.endTime) {
    return new ErrorResponse(
      'The "endTime" parameter is required to check availability.',
      ['Provide an end time: check_availability({ date: "2026-04-10", startTime: "09:00", endTime: "17:00" })']
    );
  }

  // Validate startTime < endTime
  const windowStart = timeToMinutes(params.startTime);
  const windowEnd = timeToMinutes(params.endTime);
  if (windowStart >= windowEnd) {
    return new ErrorResponse(
      `startTime (${params.startTime}) must be earlier than endTime (${params.endTime}).`,
      ['Ensure the start time is before the end time, e.g. startTime: "09:00", endTime: "17:00"']
    );
  }

  // Precondition: must be on Google Calendar
  const pre = await checkPrecondition(page, 'on_calendar');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use browser_fetch_webpage({ url: 'https://calendar.google.com' }) to open Google Calendar first."
    ]);
  }

  // T1: Navigate to the day view for the specified date
  const path = buildViewPath('day', params.date);
  await calendarNavigate(page, path);
  logger.debug(`checkAvailability: navigated to day view for ${params.date}`);

  // Wait for event chips (or empty day)
  let events = [];
  try {
    await waitForCalendar(page, EVENT_CHIP);
    events = await extractVisibleEvents(page, 100);
  } catch {
    // No events — the entire window is free
    logger.debug('checkAvailability: no events found, entire window is free');
  }

  // Filter events that overlap with the requested time window
  const busySlots = [];
  for (const event of events) {
    if (event.allDay) {
      // All-day events occupy the full day but don't block time slots
      continue;
    }

    // Parse event times (best-effort from extracted data)
    if (event.startTime && event.endTime) {
      const eventStart = timeToMinutes(event.startTime);
      const eventEnd = timeToMinutes(event.endTime);

      // Check overlap: event overlaps window if event starts before window ends
      // AND event ends after window starts
      if (eventStart < windowEnd && eventEnd > windowStart) {
        busySlots.push({
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime
        });
      }
    }
  }

  // Compute free slots within the window
  const freeSlots = [];
  // Sort busy slots by start time
  busySlots.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  let cursor = windowStart;
  for (const busy of busySlots) {
    const busyStart = timeToMinutes(busy.startTime);
    const busyEnd = timeToMinutes(busy.endTime);

    if (cursor < busyStart) {
      freeSlots.push({
        startTime: minutesToTime(cursor),
        endTime: minutesToTime(Math.min(busyStart, windowEnd)),
        durationMinutes: Math.min(busyStart, windowEnd) - cursor
      });
    }
    cursor = Math.max(cursor, busyEnd);
  }

  // Final free slot after all busy periods
  if (cursor < windowEnd) {
    freeSlots.push({
      startTime: minutesToTime(cursor),
      endTime: minutesToTime(windowEnd),
      durationMinutes: windowEnd - cursor
    });
  }

  const isFree = busySlots.length === 0;
  const summary = isFree
    ? `${params.date} from ${params.startTime} to ${params.endTime} is completely free.`
    : `${params.date} from ${params.startTime} to ${params.endTime} has ${busySlots.length} conflicting event(s) and ${freeSlots.length} free slot(s).`;

  return new GCalActionResponse(
    {
      date: params.date,
      windowStart: params.startTime,
      windowEnd: params.endTime,
      isFree,
      busySlots,
      freeSlots,
      conflictCount: busySlots.length
    },
    summary,
    isFree
      ? [`Use create_event({ date: "${params.date}", startTime: "${params.startTime}" }) to book this slot`]
      : [
          'Use create_event to book one of the free slots',
          'Use check_availability with a different time range to find open slots',
          'Use list_events to see all events on this date'
        ]
  );
}
