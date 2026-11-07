import { InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse, listWorksheets } from '../helpers.js';
import { prepareEditor, urlParam } from './common.js';

export const listWorksheetsAction = new PluginAction({
  name: 'list_worksheets',
  description: 'List worksheet tabs exposed by the Excel editor and identify the active worksheet',
  params: [urlParam],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    const editor = await prepareEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    const worksheets = await listWorksheets(editor.frame);
    return new ExcelActionResponse({ worksheets }, `Found ${worksheets.length} worksheet tab(s).`);
  },
});
