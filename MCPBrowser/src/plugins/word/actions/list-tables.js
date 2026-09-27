import { WordActionResponse, listRenderedTables } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function listTables({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const tables = await listRenderedTables(page);
  return new WordActionResponse({ tables, renderedOnly: true }, `Found ${tables.length} rendered table(s).`, ['Use read_table with a table index.']);
}
