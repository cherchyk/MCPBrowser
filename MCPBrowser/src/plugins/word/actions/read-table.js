import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, readRenderedTable } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function readTable({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const table = await readRenderedTable(page, params?.tableIndex);
  if (!table) return new ErrorResponse(`Table ${params?.tableIndex} is not rendered.`, ['Use list_tables after navigating to the table.']);
  return new WordActionResponse({ table }, `Read table ${table.index}.`, ['Use update_table_cell to change a cell safely.']);
}
