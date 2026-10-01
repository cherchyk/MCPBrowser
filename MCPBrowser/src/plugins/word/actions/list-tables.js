import { WordActionResponse, listRenderedTables } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function listTables({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const tables = await listRenderedTables(page);
  return new WordActionResponse(
    { tables, renderedOnly: true },
    `Found ${tables.length} rendered table(s).`,
    ['Use read_table with a table index.'],
  );
}

export const listTablesAction = new PluginAction({
  name: 'list_tables',
  description: 'List tables on currently rendered Word pages with dimensions and previews',
  params: [],
  response: WordActionResponse,
  handler: listTables,
});
