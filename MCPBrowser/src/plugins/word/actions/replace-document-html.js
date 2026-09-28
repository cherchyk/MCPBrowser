import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, updateDocumentContent } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function replaceDocumentHtml({ page, params }) {
  if (typeof params?.html !== 'string') {
    return new ErrorResponse('html is required and must be a string.', [
      'Provide HTML and an equivalent plainText fallback.',
    ]);
  }
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await updateDocumentContent(page, {
    html: params.html,
    plainText: params?.plainText,
    placement: 'replace',
  });
  if (!result.accepted) {
    return new ErrorResponse(`Word rejected the rich document replacement (${result.reason}).`, [
      'Reduce or simplify the HTML and retry.',
    ]);
  }
  return new WordActionResponse(
    result,
    'Word accepted the sanitized whole-document HTML replacement.',
    ['Use wait_for_save before closing.'],
  );
}

export const replaceDocumentHtmlAction = new PluginAction({
  name: 'replace_document_html',
  description: 'Replace the entire document with sanitized rich HTML',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    { name: 'html', type: 'string', description: 'Rich HTML replacement content', required: true },
    {
      name: 'plainText',
      type: 'string',
      description: 'Equivalent plain-text fallback',
      required: true,
    },
  ],
  response: WordActionResponse,
  handler: replaceDocumentHtml,
});
