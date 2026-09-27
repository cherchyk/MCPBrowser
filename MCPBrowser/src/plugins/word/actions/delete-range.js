import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function deleteRange({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await replaceDocumentTextSurgically(page, { ...params, replacement: '', replaceAll: false });
  if (!result.changed) {
    return new ErrorResponse(`Word did not delete the range (${result.reason}).`, ['Use get_text_context and specify occurrence.']);
  }
  return new WordActionResponse(result, `Deleted occurrence ${result.occurrence}.`, ['Use wait_for_save before closing.']);
}
