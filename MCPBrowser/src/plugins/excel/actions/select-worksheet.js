import { InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse, listWorksheets, selectWorksheet } from '../helpers.js';
import { prepareEditor, urlParam, sheetParam } from './common.js';

export const selectWorksheetAction = new PluginAction({
  name: 'select_worksheet',
  description: 'Navigate to an existing worksheet by its exact tab name and confirm it is active',
  params: [urlParam, { ...sheetParam, required: true }],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    if (typeof params?.sheet !== 'string' || !params.sheet.length) {
      throw new Error('sheet must be a non-empty worksheet name');
    }
    const editor = await prepareEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    const sheet = await selectWorksheet(editor.frame, params.sheet);
    const worksheets = await listWorksheets(editor.frame);
    return new ExcelActionResponse({ sheet, worksheets }, `Selected worksheet ${sheet}.`);
  },
});
