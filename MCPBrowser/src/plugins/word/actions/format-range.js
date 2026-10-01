import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, applySelectedFormatting } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function formatRange({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await applySelectedFormatting(page, params);
  if (!result.formatted) {
    return new ErrorResponse(`Word did not format the range (${result.reason}).`, [
      'Use find_text and specify an unambiguous occurrence.',
    ]);
  }
  return new WordActionResponse(result, `Formatted occurrence ${result.occurrence}.`, [
    'Use wait_for_save before closing.',
  ]);
}

export const formatRangeAction = new PluginAction({
  name: 'format_range',
  description: 'Apply bold, italic, underline, or strikethrough to one exact occurrence',
  params: [
    { name: 'query', type: 'string', description: 'Exact text to format', required: true },
    { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
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
    { name: 'bold', type: 'boolean', description: 'Toggle bold', required: false },
    { name: 'italic', type: 'boolean', description: 'Toggle italic', required: false },
    { name: 'underline', type: 'boolean', description: 'Toggle underline', required: false },
    {
      name: 'strikethrough',
      type: 'boolean',
      description: 'Toggle strikethrough',
      required: false,
    },
  ],
  response: WordActionResponse,
  handler: formatRange,
});
