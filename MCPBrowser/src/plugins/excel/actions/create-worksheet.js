import { InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse } from '../helpers.js';
import { createWorksheet, validateWorksheetName } from '../worksheets.js';
import { prepareEditableEditor, urlParam, nameParam } from './common.js';

export const createWorksheetAction = new PluginAction({
  name: 'create_worksheet',
  description: 'Create one worksheet with the requested unique name and confirm it is saved',
  params: [urlParam, nameParam],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    const name = validateWorksheetName(params?.name);
    const editor = await prepareEditableEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    return new ExcelActionResponse(
      await createWorksheet(page, editor.frame, name),
      `Created worksheet ${name}.`,
    );
  },
});
