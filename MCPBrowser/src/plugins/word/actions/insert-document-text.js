import { PluginAction } from '../../../core/actions.js';
import { WordActionResponse } from '../helpers.js';
import { insertDocument } from './insert-document-common.js';

function insertDocumentText(options) {
  return insertDocument(options, false);
}

export const insertDocumentTextAction = new PluginAction({
  name: 'insert_document_text',
  description: 'Prepend or append plain text',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    { name: 'position', type: 'string', description: 'start or end', required: true },
    { name: 'text', type: 'string', description: 'Plain text to insert', required: true },
  ],
  response: WordActionResponse,
  handler: insertDocumentText,
});
