import { PluginAction } from '../../../core/actions.js';
import { WordActionResponse } from '../helpers.js';
import { insertDocument } from './insert-document-common.js';

function insertDocumentHtml(options) {
  return insertDocument(options, true);
}

export const insertDocumentHtmlAction = new PluginAction({
  name: 'insert_document_html',
  description: 'Prepend or append sanitized rich HTML',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    { name: 'position', type: 'string', description: 'start or end', required: true },
    { name: 'html', type: 'string', description: 'Rich HTML to insert', required: true },
    {
      name: 'plainText',
      type: 'string',
      description: 'Equivalent plain-text fallback',
      required: true,
    },
  ],
  response: WordActionResponse,
  handler: insertDocumentHtml,
});
