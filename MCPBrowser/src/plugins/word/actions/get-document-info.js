import { WordActionResponse, getDocumentInfo } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function getDocumentInfoAction({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const info = await getDocumentInfo(page);
  return new WordActionResponse(info, `Read metadata for ${info.title || 'the Word document'}.`, [
    'Use get_outline or read_range next.',
  ]);
}

export const getDocumentInfoPluginAction = new PluginAction({
  name: 'get_document_info',
  description: 'Read document title, mode, word count, rendered layout, and save state',
  params: [{ name: 'url', type: 'string', description: 'Optional document URL', required: false }],
  response: WordActionResponse,
  handler: getDocumentInfoAction,
});
