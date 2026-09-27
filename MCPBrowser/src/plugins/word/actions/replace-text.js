import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function replaceText({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await replaceDocumentTextSurgically(page, params);
  if (!result.changed) {
    const messages = {
      no_matches: 'Word found no matching text, so the document was not changed.',
      ambiguous_match: `Word found ${result.matchCount} matches. Specify occurrence or set replaceAll: true.`,
      occurrence_out_of_range: `Occurrence ${result.occurrence} is outside the ${result.matchCount} matches.`,
      unexpected_match_count: `Word found ${result.actualMatchCount} matches instead of the expected ${result.expectedMatchCount}.`
    };
    return new ErrorResponse(messages[result.reason] || `Word did not perform the replacement (${result.reason}).`, ['Use find_text before retrying.']);
  }
  return new WordActionResponse(result, `Word surgically replaced ${result.replacedCount} occurrence(s).`, ['Use wait_for_save before closing.']);
}
