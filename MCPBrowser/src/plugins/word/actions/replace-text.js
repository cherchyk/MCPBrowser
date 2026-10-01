import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function replaceText({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await replaceDocumentTextSurgically(page, params);
  if (!result.changed) {
    const messages = {
      no_matches: 'Word found no matching text, so the document was not changed.',
      ambiguous_match: `Word found ${result.matchCount} matches. Specify occurrence or set replaceAll: true.`,
      occurrence_out_of_range: `Occurrence ${result.occurrence} is outside the ${result.matchCount} matches.`,
      unexpected_match_count: `Word found ${result.actualMatchCount} matches instead of the expected ${result.expectedMatchCount}.`,
    };
    return new ErrorResponse(
      messages[result.reason] || `Word did not perform the replacement (${result.reason}).`,
      ['Use find_text before retrying.'],
    );
  }
  return new WordActionResponse(
    result,
    `Word surgically replaced ${result.replacedCount} occurrence(s).`,
    ['Use wait_for_save before closing.'],
  );
}

export const replaceTextAction = new PluginAction({
  name: 'replace_text',
  description: 'Surgically replace one or all native Word search matches',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    { name: 'query', type: 'string', description: 'Existing text', required: true },
    { name: 'replacement', type: 'string', description: 'Replacement text', required: true },
    { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
    {
      name: 'replaceAll',
      type: 'boolean',
      description: 'Replace every match',
      required: false,
      default: false,
    },
    {
      name: 'expectedMatchCount',
      type: 'number',
      description: 'Abort if count differs',
      required: false,
    },
    {
      name: 'matchCase',
      type: 'boolean',
      description: 'Require matching case',
      required: false,
      default: false,
    },
    {
      name: 'wholeWords',
      type: 'boolean',
      description: 'Match whole words only',
      required: false,
      default: false,
    },
  ],
  response: WordActionResponse,
  handler: replaceText,
});
