import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function insertAt({ page, params }) {
  if (!['before', 'after'].includes(params?.position)) {
    return new ErrorResponse("position must be 'before' or 'after'.", ['Choose a position relative to the anchor query.']);
  }
  if (typeof params?.text !== 'string') {
    return new ErrorResponse('text is required.', ['Provide the plain text to insert.']);
  }
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const replacement = params.position === 'before'
    ? `${params.text}${params.query}`
    : `${params.query}${params.text}`;
  const result = await replaceDocumentTextSurgically(page, { ...params, replacement, replaceAll: false });
  if (!result.changed) {
    return new ErrorResponse(`Word did not insert content (${result.reason}).`, ['Use find_text and specify an unambiguous occurrence.']);
  }
  return new WordActionResponse(result, `Inserted text ${params.position} occurrence ${result.occurrence}.`, ['Use wait_for_save before closing.']);
}
