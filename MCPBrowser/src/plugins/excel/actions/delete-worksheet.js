import { InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse } from '../helpers.js';
import { deleteWorksheet } from '../worksheets.js';
import { prepareEditableEditor, urlParam, sheetParam } from './common.js';

export const deleteWorksheetAction = new PluginAction({
  name: 'delete_worksheet',
  description:
    'Permanently delete one worksheet and its contents only after explicit user approval; refuse the last visible worksheet and confirm save',
  params: [
    urlParam,
    { ...sheetParam, required: true },
    {
      name: 'confirmDelete',
      type: 'boolean',
      required: true,
      description:
        'Must be true only after the user explicitly approves deleting this named worksheet and its contents',
    },
  ],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    if (params?.confirmDelete !== true)
      throw new Error(
        'Deleting a worksheet requires confirmDelete: true after explicit user approval',
      );
    if (typeof params?.sheet !== 'string' || !params.sheet.length)
      throw new Error('sheet must be a non-empty worksheet name');
    const editor = await prepareEditableEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    return new ExcelActionResponse(
      await deleteWorksheet(page, editor.frame, params.sheet, params.confirmDelete),
      `Deleted worksheet ${params.sheet}.`,
    );
  },
});
