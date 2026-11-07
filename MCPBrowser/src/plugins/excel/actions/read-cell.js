import { ErrorResponse, InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse, parseRange, selectWorksheet } from '../helpers.js';
import { readCellInput } from '../mutations.js';
import { prepareEditor, urlParam, sheetParam, cellParam } from './common.js';

export const readCellAction = new PluginAction({
  name: 'read_cell',
  description:
    'Read one cell native formula-bar input or formula, not its formatted display or calculated result; does not enter cell editing or use the clipboard',
  params: [urlParam, sheetParam, cellParam],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    const range = parseRange(params?.cell);
    if (range.rowCount !== 1 || range.columnCount !== 1) {
      return new ErrorResponse('cell must identify exactly one A1 cell');
    }
    const editor = await prepareEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    const sheet = await selectWorksheet(editor.frame, params?.sheet);
    const input = await readCellInput(page, editor.frame, range, sheet);
    return new ExcelActionResponse({ sheet, cell: range.address, input }, `Read ${range.address}.`);
  },
});
