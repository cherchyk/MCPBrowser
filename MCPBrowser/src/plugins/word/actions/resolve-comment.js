import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, resolveDocumentComment } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function resolveComment({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await resolveDocumentComment(page, params?.commentIndex);
  if (!result.resolved) {
    return new ErrorResponse(`Word did not resolve the comment (${result.reason}).`, [
      'Use list_comments to refresh visible comment indices.',
    ]);
  }
  return new WordActionResponse(result, `Resolved comment ${result.commentIndex}.`, [
    'Use wait_for_save before closing.',
  ]);
}

export const resolveCommentAction = new PluginAction({
  name: 'resolve_comment',
  description: 'Resolve one visible Word comment by index',
  params: [
    {
      name: 'commentIndex',
      type: 'number',
      description: '0-based visible comment index',
      required: true,
    },
  ],
  response: WordActionResponse,
  handler: resolveComment,
});
