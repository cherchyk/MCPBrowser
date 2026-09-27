import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, addCommentToSelection, listDocumentComments, resolveDocumentComment } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function listComments({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const comments = await listDocumentComments(page);
  return new WordActionResponse({ comments }, `Found ${comments.length} visible comment item(s).`, ['Use add_comment to comment on exact text.']);
}

export async function addComment({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await addCommentToSelection(page, params);
  if (!result.commented) {
    return new ErrorResponse(`Word did not add the comment (${result.reason}).`, ['Use find_text and specify an unambiguous occurrence.']);
  }
  return new WordActionResponse(result, 'Added a comment to the selected text.', ['Use list_comments to verify it.']);
}

export async function resolveComment({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await resolveDocumentComment(page, params?.commentIndex);
  if (!result.resolved) {
    return new ErrorResponse(`Word did not resolve the comment (${result.reason}).`, ['Use list_comments to refresh visible comment indices.']);
  }
  return new WordActionResponse(result, `Resolved comment ${result.commentIndex}.`, ['Use wait_for_save before closing.']);
}
