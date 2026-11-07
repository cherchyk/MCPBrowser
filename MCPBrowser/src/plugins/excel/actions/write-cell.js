import { ErrorResponse, InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse, parseRange, selectWorksheet } from '../helpers.js';
import { replaceCellInput, validateCellInput } from '../mutations.js';
import { prepareEditor, urlParam, sheetParam, cellParam } from './common.js';

export const writeCellAction = new PluginAction({
  name: 'write_cell',
  description:
    'Replace one cell input with text, a number, or an Excel formula; verify its source and save',
  params: [
    urlParam,
    sheetParam,
    cellParam,
    {
      name: 'input',
      type: 'string',
      required: true,
      description:
        'Native Excel input; = starts a formula, an apostrophe prefixes literal text, and an empty string clears the cell',
    },
    {
      name: 'expectedInput',
      type: 'string',
      required: false,
      description:
        'Abort unless the current cell source exactly matches this text or formula, not its displayed result',
    },
  ],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    const range = parseRange(params?.cell);
    if (range.rowCount !== 1 || range.columnCount !== 1) {
      return new ErrorResponse('cell must identify exactly one A1 cell');
    }
    const input = validateCellInput(params?.input);
    const expectedInput =
      params?.expectedInput === undefined ? undefined : validateCellInput(params.expectedInput);
    const editor = await prepareEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    if (editor.mode !== 'Edit') {
      return new ErrorResponse(
        'The Excel workbook is not in confirmed editing mode; no edit was started',
      );
    }
    const sheet = await selectWorksheet(editor.frame, params?.sheet);
    const result = await replaceCellInput(page, editor.frame, range, sheet, input, expectedInput);
    return new ExcelActionResponse(
      result,
      result.changed
        ? `Updated and saved ${range.address}.`
        : `${range.address} already has the requested input and is saved.`,
    );
  },
});
