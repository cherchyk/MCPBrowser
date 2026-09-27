import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, applySelectedFormatting } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function formatRange({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await applySelectedFormatting(page, params);
  if (!result.formatted) {
    return new ErrorResponse(`Word did not format the range (${result.reason}).`, ['Use find_text and specify an unambiguous occurrence.']);
  }
  return new WordActionResponse(result, `Formatted occurrence ${result.occurrence}.`, ['Use wait_for_save before closing.']);
}
