import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, readRenderedTable, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function updateTableCell({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const table = await readRenderedTable(page, params?.tableIndex);
  const cell = table?.rows?.[params?.rowIndex]?.cells?.[params?.columnIndex];
  if (!cell) {
    return new ErrorResponse('The requested rendered table cell was not found.', ['Use read_table to inspect row and column indices.']);
  }
  if (params?.expectedText !== undefined && cell.text !== params.expectedText) {
    return new ErrorResponse(`Cell text '${cell.text}' did not match expectedText.`, ['Refresh with read_table before retrying.']);
  }
  const result = await replaceDocumentTextSurgically(page, {
    query: cell.text,
    replacement: params?.text,
    occurrence: params?.occurrence,
    expectedMatchCount: params?.expectedMatchCount,
    matchCase: true,
    wholeWords: false,
    replaceAll: false
  });
  if (!result.changed) {
    return new ErrorResponse(`Word did not update the cell (${result.reason}).`, ['Provide occurrence or expectedMatchCount when cell text is duplicated.']);
  }
  return new WordActionResponse(result, `Updated table ${params.tableIndex}, row ${params.rowIndex}, column ${params.columnIndex}.`, ['Use wait_for_save before closing.']);
}
