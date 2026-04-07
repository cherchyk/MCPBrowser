/**
 * selectors.js — Tier 4 CSS class selectors for the Google Calendar plugin.
 *
 * TIER 4 ONLY — These are Closure Compiler-generated class names that may
 * change when Google deploys Calendar updates. All other interaction tiers
 * (T1: URL path navigation, T2: keyboard shortcuts, T3: ARIA / data attributes)
 * are defined inline in helpers.js since they use stable identifiers.
 *
 * Per FR-021: All CSS class selectors are centralized here so a Calendar UI
 * update can be resolved by updating values in ONE place.
 *
 * Per SC-008: No action file should import CSS class names directly.
 * All CSS access goes through this module.
 *
 * Tier coverage (SC-007): ~75% of interactions use T1/T2 (URL + keyboard).
 * These T4 selectors cover only data extraction from event chips and detail
 * popups where no ARIA/data-attribute alternative exists.
 *
 * @version 2026-04-06 — Initial capture against Google Calendar web UI
 */

// CALENDAR VIEW — Event chips (used by extractVisibleEvents)
// No ARIA alternative: event chip container uses generated classes
export const EVENT_CHIP = '[data-eventchip]';
// No ARIA alternative: title text within chip is plain span
export const EVENT_TITLE_IN_CHIP = 'span';
// No ARIA alternative: time text within chip lacks data attributes
export const EVENT_TIME_IN_CHIP = 'span';

// EVENT DETAIL POPUP — Fields in the detail popup (used by read_event)
// No ARIA alternative: location line lacks role/data attributes
export const EVENT_LOCATION_IN_DETAIL = '[data-location]';
// No ARIA alternative: description area uses contenteditable without data-attr
export const EVENT_DESCRIPTION_IN_DETAIL = '[data-description]';

// ATTENDEES — Within event detail popup (used by read_event, rsvp_event)
// No ARIA alternative: attendee rows lack role="listitem"
export const ATTENDEE_ROW = '[data-guest-email]';
// No ARIA alternative: RSVP icons use generated classes
export const ATTENDEE_RSVP_STATUS = '[data-rsvp]';

// RSVP BUTTONS — Within event detail popup (used by rsvp_event)
// No ARIA alternative: RSVP buttons lack unique aria-label
export const RSVP_YES_BUTTON = '[data-response="1"]';
export const RSVP_NO_BUTTON = '[data-response="2"]';
export const RSVP_MAYBE_BUTTON = '[data-response="3"]';

// CALENDAR INDICATOR — Color dot on event chips
// No ARIA alternative: color indicator is CSS-only
export const CALENDAR_COLOR_DOT = '[data-calendar-color]';

// FORM CONTROLS — Event creation/edit form (used by create_event, edit_event)
// No ARIA alternative: save button lacks unique accessible name
export const SAVE_BUTTON = '[data-savebtn]';
