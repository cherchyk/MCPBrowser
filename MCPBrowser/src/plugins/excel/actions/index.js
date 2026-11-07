import { PluginAction } from '../../../core/actions.js';
import { ErrorResponse } from '../../../core/responses.js';
import logger from '../../../core/logger.js';
import { openWorkbookAction } from './open-workbook.js';
import { listWorksheetsAction } from './list-worksheets.js';
import { selectWorksheetAction } from './select-worksheet.js';
import { createWorksheetAction } from './create-worksheet.js';
import { renameWorksheetAction } from './rename-worksheet.js';
import { deleteWorksheetAction } from './delete-worksheet.js';
import { readCellAction } from './read-cell.js';
import { writeCellAction } from './write-cell.js';
import { waitForSaveAction } from './wait-for-save.js';

let activeAction = null;

export const ACTIONS = [
  openWorkbookAction,
  listWorksheetsAction,
  selectWorksheetAction,
  createWorksheetAction,
  renameWorksheetAction,
  deleteWorksheetAction,
  readCellAction,
  writeCellAction,
  waitForSaveAction,
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
            `Excel is busy with '${activeAction}'. '${action.name}' was not started.`,
            ['Run Excel actions sequentially and wait for the active action to finish.'],
          );
        }
        activeAction = action.name;
        try {
          return await action.execute(context);
        } catch (error) {
          logger.error(`Excel ${action.name} failed: ${error.message}`);
          return new ErrorResponse(error.message, [
            'Inspect the workbook, permissions, and selection before retrying.',
          ]);
        } finally {
          activeAction = null;
        }
      },
    }),
);
