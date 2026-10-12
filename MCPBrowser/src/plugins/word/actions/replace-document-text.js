import { WordActionResponse, updateDocumentContent } from '../helpers.js';
import { isPreparationResponse, mutationFailure, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function replaceDocumentText({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await updateDocumentContent(page, {
    plainText: params?.text,
    placement: 'replace',
  });
  if (!result.accepted) {
    return mutationFailure(result);
  }
  return new WordActionResponse(result, 'Word document text matches the requested replacement.', [
    'Use wait_for_save before closing.',
  ]);
}

export const replaceDocumentTextAction = new PluginAction({
  name: 'replace_document_text',
  description: 'Replace the entire document with plain text',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    { name: 'text', type: 'string', description: 'Plain text replacement content', required: true },
  ],
  response: WordActionResponse,
  handler: replaceDocumentText,
});
