import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function insertAt({ page, params }) {
  if (!['before', 'after'].includes(params?.position)) {
    return new ErrorResponse("position must be 'before' or 'after'.", [
      'Choose a position relative to the anchor query.',
    ]);
  }
  if (typeof params?.text !== 'string') {
    return new ErrorResponse('text is required.', ['Provide the plain text to insert.']);
  }
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const replacement =
    params.position === 'before'
      ? `${params.text}${params.query}`
      : `${params.query}${params.text}`;
  const result = await replaceDocumentTextSurgically(page, {
    ...params,
    replacement,
    replaceAll: false,
  });
  if (!result.changed) {
    return new ErrorResponse(`Word did not insert content (${result.reason}).`, [
      'Use find_text and specify an unambiguous occurrence.',
    ]);
  }
  return new WordActionResponse(
    result,
    `Inserted text ${params.position} occurrence ${result.occurrence}.`,
    ['Use wait_for_save before closing.'],
  );
}

export const insertAtAction = new PluginAction({
  name: 'insert_at',
  description: 'Insert plain text immediately before or after an exact native search occurrence',
  params: [
    { name: 'query', type: 'string', description: 'Anchor text', required: true },
    { name: 'text', type: 'string', description: 'Text to insert', required: true },
    { name: 'position', type: 'string', description: 'before or after', required: true },
    { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
    {
      name: 'expectedMatchCount',
      type: 'number',
      description: 'Abort if count differs',
      required: false,
    },
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
  handler: insertAt,
});
