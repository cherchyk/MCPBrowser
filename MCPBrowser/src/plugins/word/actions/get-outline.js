import { WordActionResponse, getDocumentOutline } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function getOutline({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const headings = await getDocumentOutline(page);
  return new WordActionResponse({ headings }, `Word found ${headings.length} heading(s).`, [
    'Use read_range with a heading locator to read that area.',
  ]);
}

export const getOutlineAction = new PluginAction({
  name: 'get_outline',
  description: 'Read the native Word heading outline across the document',
  params: [{ name: 'url', type: 'string', description: 'Optional document URL', required: false }],
  response: WordActionResponse,
  handler: getOutline,
});
