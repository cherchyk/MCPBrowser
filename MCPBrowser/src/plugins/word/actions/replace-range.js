import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function replaceRange({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await replaceDocumentTextSurgically(page, { ...params, replaceAll: false });
  if (!result.changed) {
    return new ErrorResponse(`Word did not replace the range (${result.reason}).`, ['Use get_text_context and specify occurrence.']);
  }
  return new WordActionResponse(result, `Replaced occurrence ${result.occurrence}.`, ['Use wait_for_save before closing.']);
}
