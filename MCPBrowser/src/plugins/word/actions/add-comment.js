import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, addCommentToSelection } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function addComment({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await addCommentToSelection(page, params);
  if (!result.commented) {
    return new ErrorResponse(`Word did not add the comment (${result.reason}).`, [
      'Use find_text and specify an unambiguous occurrence.',
    ]);
  }
  return new WordActionResponse(result, 'Added a comment to the selected text.', [
    'Use list_comments to verify it.',
  ]);
}

export const addCommentAction = new PluginAction({
  name: 'add_comment',
  description: 'Add a comment to one exact text occurrence',
  params: [
    { name: 'query', type: 'string', description: 'Exact text to comment on', required: true },
    { name: 'comment', type: 'string', description: 'Comment text', required: true },
    { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
    {
      name: 'matchCase',
      type: 'boolean',
      description: 'Require matching case',
      required: false,
      default: false,
    },
  ],
  response: WordActionResponse,
  handler: addComment,
});
