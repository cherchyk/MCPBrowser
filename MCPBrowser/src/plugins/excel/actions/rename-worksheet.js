import { InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse } from '../helpers.js';
import { renameWorksheet, validateWorksheetName } from '../worksheets.js';
import { prepareEditableEditor, urlParam, sheetParam, nameParam } from './common.js';

export const renameWorksheetAction = new PluginAction({
  name: 'rename_worksheet',
  description:
    'Rename an existing worksheet without overwriting another worksheet name; confirm save',
  params: [urlParam, { ...sheetParam, required: true }, nameParam],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    if (typeof params?.sheet !== 'string' || !params.sheet.length)
      throw new Error('sheet must be a non-empty worksheet name');
    const name = validateWorksheetName(params?.name);
    const editor = await prepareEditableEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    return new ExcelActionResponse(
      await renameWorksheet(page, editor.frame, params.sheet, name),
      `Renamed worksheet to ${name}.`,
    );
  },
});
