import { checkAvailabilityAction } from './check-availability.js';
import { createEventAction } from './create-event.js';
import { deleteEventAction } from './delete-event.js';
import { editEventAction } from './edit-event.js';
import { listEventsAction } from './list-events.js';
import { readEventAction } from './read-event.js';
import { rsvpEventAction } from './rsvp-event.js';
import { searchEventsAction } from './search-events.js';

export const ACTIONS = [
  listEventsAction,
  readEventAction,
  createEventAction,
  searchEventsAction,
  editEventAction,
  rsvpEventAction,
  deleteEventAction,
  checkAvailabilityAction,
];
