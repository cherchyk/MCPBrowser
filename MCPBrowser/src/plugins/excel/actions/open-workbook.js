import { InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse, listWorksheets } from '../helpers.js';
import { prepareEditor, urlParam } from './common.js';

export const openWorkbookAction = new PluginAction({
  name: 'open_workbook',
  description: 'Open an authenticated Excel Online workbook using the standard browser editor',
  params: [urlParam],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    const editor = await prepareEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    const worksheets = await listWorksheets(editor.frame);
    return new ExcelActionResponse(
      { title: await page.title(), mode: editor.mode, worksheets },
      'Excel workbook is ready.',
      ['Use read_cell with an A1 cell to read its input or formula.'],
    );
  },
});
