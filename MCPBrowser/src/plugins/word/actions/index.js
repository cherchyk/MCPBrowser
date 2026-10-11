import { closeDocumentAction } from './close-document.js';
import { addCommentAction } from './add-comment.js';
import { listCommentsAction } from './list-comments.js';
import { resolveCommentAction } from './resolve-comment.js';
import { deleteRangeAction } from './delete-range.js';
import { exportMarkdownAction } from './export-markdown.js';
import { findTextAction } from './find-text.js';
import { formatRangeAction } from './format-range.js';
import { getDocumentInfoPluginAction } from './get-document-info.js';
import { getOutlineAction } from './get-outline.js';
import { getStateAction } from './get-state.js';
import { getTextContextAction } from './get-text-context.js';
import { insertAtAction } from './insert-at.js';
import { insertDocumentHtmlAction } from './insert-document-html.js';
import { insertDocumentTextAction } from './insert-document-text.js';
import { importMarkdownAction } from './import-markdown.js';
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
import { PluginAction } from '../../../core/actions.js';
import { ErrorResponse } from '../../../core/responses.js';

// Even reads navigate/select in Word. Reject overlaps instead of queueing past MCP deadlines.
let activeAction = null;

export const ACTIONS = [
  openDocumentAction,
  readDocumentAction,
  replaceDocumentTextAction,
  replaceDocumentHtmlAction,
  insertDocumentTextAction,
  insertDocumentHtmlAction,
  importMarkdownAction,
  exportMarkdownAction,
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
].map(
  (action) =>
    new PluginAction({
      name: action.name,
      description: action.description,
      params: action.params,
      response: action.response,
      handler: async (context) => {
        if (activeAction) {
          return new ErrorResponse(
            `Word is busy with '${activeAction}'. '${action.name}' was not started.`,
            ['Wait for the active Word action to finish. Do not run Word actions in parallel.'],
          );
        }
        activeAction = action.name;
        try {
          return await action.execute(context);
        } finally {
          activeAction = null;
        }
      },
    }),
);
