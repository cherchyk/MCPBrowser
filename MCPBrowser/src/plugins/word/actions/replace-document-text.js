import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, updateDocumentContent } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function replaceDocumentText({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await updateDocumentContent(page, { plainText: params?.text, placement: 'replace' });
  if (!result.accepted) {
    return new ErrorResponse(`Word rejected the text replacement (${result.reason}).`, ['Verify the document is editable and retry.']);
  }
  return new WordActionResponse(result, 'Word accepted the whole-document text replacement.', ['Use wait_for_save before closing.']);
}
