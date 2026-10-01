import { ErrorResponse } from '../../../core/responses.js';
import {
  WordActionResponse,
  readRenderedTable,
  replaceDocumentTextSurgically,
} from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function updateTableCell({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const table = await readRenderedTable(page, params?.tableIndex);
  const cell = table?.rows?.[params?.rowIndex]?.cells?.[params?.columnIndex];
  if (!cell) {
    return new ErrorResponse('The requested rendered table cell was not found.', [
      'Use read_table to inspect row and column indices.',
    ]);
  }
  if (params?.expectedText !== undefined && cell.text !== params.expectedText) {
    return new ErrorResponse(`Cell text '${cell.text}' did not match expectedText.`, [
      'Refresh with read_table before retrying.',
    ]);
  }
  const result = await replaceDocumentTextSurgically(page, {
    query: cell.text,
    replacement: params?.text,
    occurrence: params?.occurrence,
    expectedMatchCount: params?.expectedMatchCount,
    matchCase: true,
    wholeWords: false,
    replaceAll: false,
  });
  if (!result.changed) {
    return new ErrorResponse(`Word did not update the cell (${result.reason}).`, [
      'Provide occurrence or expectedMatchCount when cell text is duplicated.',
    ]);
  }
  return new WordActionResponse(
    result,
    `Updated table ${params.tableIndex}, row ${params.rowIndex}, column ${params.columnIndex}.`,
    ['Use wait_for_save before closing.'],
  );
}

export const updateTableCellAction = new PluginAction({
  name: 'update_table_cell',
  description: 'Safely update one rendered table cell using its current text as a locator',
  params: [
    { name: 'tableIndex', type: 'number', description: '0-based table index', required: true },
    { name: 'rowIndex', type: 'number', description: '0-based row index', required: true },
    { name: 'columnIndex', type: 'number', description: '0-based column index', required: true },
    { name: 'text', type: 'string', description: 'Replacement cell text', required: true },
    {
      name: 'expectedText',
      type: 'string',
      description: 'Abort unless the cell currently has this text',
      required: false,
    },
    {
      name: 'occurrence',
      type: 'number',
      description: 'Occurrence when cell text is duplicated',
      required: false,
    },
    {
      name: 'expectedMatchCount',
      type: 'number',
      description: 'Abort if document-wide count differs',
      required: false,
    },
  ],
  response: WordActionResponse,
  handler: updateTableCell,
});
