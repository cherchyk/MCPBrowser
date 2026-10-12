import { archiveEmailAction } from './archive-email.js';
import { composeEmailAction } from './compose-email.js';
import { deleteEmailAction } from './delete-email.js';
import { forwardEmailAction } from './forward-email.js';
import { labelEmailAction } from './label-email.js';
import { listEmailsAction } from './list-emails.js';
import { markReadAction } from './mark-read.js';
import { markUnreadAction } from './mark-unread.js';
import { readEmailAction } from './read-email.js';
import { replyEmailAction } from './reply-email.js';
import { searchEmailsAction } from './search-emails.js';

export const ACTIONS = [
  listEmailsAction,
  readEmailAction,
  searchEmailsAction,
  composeEmailAction,
  replyEmailAction,
  forwardEmailAction,
  archiveEmailAction,
  deleteEmailAction,
  labelEmailAction,
  markReadAction,
  markUnreadAction,
];
