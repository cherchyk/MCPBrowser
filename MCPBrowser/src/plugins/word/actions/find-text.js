import { WordActionResponse, findDocumentText } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function findText({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await findDocumentText(page, params);
  return new WordActionResponse(
    result,
    `Word found ${result.matchCount} match(es) across the document.`,
    result.matchCount > 0
      ? ['Use get_text_context or replace_text next.']
      : ['Adjust the query or search options.'],
  );
}

export const findTextAction = new PluginAction({
  name: 'find_text',
  description: 'Search the full document and return native match counts and snippets',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    { name: 'query', type: 'string', description: 'Text to find', required: true },
    {
      name: 'matchCase',
      type: 'boolean',
      description: 'Require matching case',
      required: false,
      default: false,
    },
    {
      name: 'wholeWords',
      type: 'boolean',
      description: 'Match whole words only',
      required: false,
      default: false,
    },
  ],
  response: WordActionResponse,
  handler: findText,
});
