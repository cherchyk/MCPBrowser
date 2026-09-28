import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, addLinkToSelection, removeLinkFromSelection } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function mutateLink({ page, params }, remove) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = remove
    ? await removeLinkFromSelection(page, params)
    : await addLinkToSelection(page, params);
  if (!(result.linked || result.linkRemoved)) {
    return new ErrorResponse(`Word did not update the link (${result.reason}).`, [
      'Use find_text and specify an unambiguous occurrence.',
    ]);
  }
  return new WordActionResponse(
    result,
    remove ? 'Removed the selected link.' : 'Applied the link to the selected text.',
    ['Use wait_for_save before closing.'],
  );
}
