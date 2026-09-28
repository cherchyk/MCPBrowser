import { closeDocumentAction } from './close-document.js';
import { addCommentAction } from './add-comment.js';
import { listCommentsAction } from './list-comments.js';
import { resolveCommentAction } from './resolve-comment.js';
import { deleteRangeAction } from './delete-range.js';
import { findTextAction } from './find-text.js';
import { formatRangeAction } from './format-range.js';
import { getDocumentInfoPluginAction } from './get-document-info.js';
import { getOutlineAction } from './get-outline.js';
import { getStateAction } from './get-state.js';
import { getTextContextAction } from './get-text-context.js';
import { insertAtAction } from './insert-at.js';
import { insertDocumentHtmlAction } from './insert-document-html.js';
import { insertDocumentTextAction } from './insert-document-text.js';
import { addLinkAction } from './add-link.js';
import { removeLinkAction } from './remove-link.js';
import { updateLinkAction } from './update-link.js';
import { listLinksAction } from './list-links.js';
import { listTablesAction } from './list-tables.js';
import { openDocumentAction } from './open-document.js';
import { readDocumentAction } from './read-document.js';
import { readRangeAction } from './read-range.js';
import { readTableAction } from './read-table.js';
import { replaceDocumentHtmlAction } from './replace-document-html.js';
import { replaceDocumentTextAction } from './replace-document-text.js';
import { replaceRangeAction } from './replace-range.js';
import { replaceTextAction } from './replace-text.js';
import { updateTableCellAction } from './update-table-cell.js';
import { waitForSaveAction } from './wait-for-save.js';

export const ACTIONS = [
  openDocumentAction,
  readDocumentAction,
  replaceDocumentTextAction,
  replaceDocumentHtmlAction,
  insertDocumentTextAction,
  insertDocumentHtmlAction,
  findTextAction,
  getDocumentInfoPluginAction,
  getOutlineAction,
  readRangeAction,
  getTextContextAction,
  replaceTextAction,
  insertAtAction,
  replaceRangeAction,
  deleteRangeAction,
  formatRangeAction,
  listTablesAction,
  readTableAction,
  updateTableCellAction,
  listLinksAction,
  addLinkAction,
  updateLinkAction,
  removeLinkAction,
  listCommentsAction,
  addCommentAction,
  resolveCommentAction,
  getStateAction,
  waitForSaveAction,
  closeDocumentAction,
];
