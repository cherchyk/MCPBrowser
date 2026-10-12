import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, updateDocumentContent } from '../helpers.js';
import { isPreparationResponse, mutationFailure, prepareEditor } from './common.js';

export async function insertDocument({ page, params }, rich) {
  if (!['start', 'end'].includes(params?.position)) {
    return new ErrorResponse("position must be either 'start' or 'end'.", [
      "Use 'start' to prepend or 'end' to append.",
    ]);
  }
  if (rich && typeof params?.html !== 'string') {
    return new ErrorResponse('html is required and must be a string.', [
      'Provide HTML and an equivalent plainText fallback.',
    ]);
  }
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await updateDocumentContent(page, {
    html: rich ? params.html : undefined,
    plainText: rich ? params?.plainText : params?.text,
    placement: params.position,
  });
  if (!result.accepted) {
    return mutationFailure(result);
  }
  return new WordActionResponse(
    result,
    `Verified document text after insertion at the ${params.position}.`,
    ['Use wait_for_save before closing.'],
  );
}
