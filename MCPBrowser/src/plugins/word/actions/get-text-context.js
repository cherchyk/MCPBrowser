import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, getDocumentTextContext } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function getTextContext({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await getDocumentTextContext(page, params);
  if (!result.found) {
    return new ErrorResponse(
      result.reason === 'ambiguous_match'
        ? `Word found ${result.matchCount} matches; specify occurrence.`
        : 'The requested text context was not found.',
      ['Use find_text to inspect matches.'],
    );
  }
  return new WordActionResponse(result, `Read context for occurrence ${result.occurrence}.`, [
    'Use insert_at, replace_range, format_range, or add_comment next.',
  ]);
}

export const getTextContextAction = new PluginAction({
  name: 'get_text_context',
  description: 'Read bounded native search context for one exact occurrence',
  params: [
    { name: 'query', type: 'string', description: 'Text to locate', required: true },
    { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
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
  handler: getTextContext,
});
