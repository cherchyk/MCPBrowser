import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, waitForDocumentSave } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function waitForSave({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await waitForDocumentSave(page, params);
  if (!result.saved) {
    return new ErrorResponse(`Word save could not be confirmed (${result.reason}).`, ['Keep the document open and retry wait_for_save.']);
  }
  return new WordActionResponse(result, 'Word confirmed the document is saved and layout is stable.', ['The document can now be closed.']);
}
