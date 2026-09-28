import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function deleteRange({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await replaceDocumentTextSurgically(page, {
    ...params,
    replacement: '',
    replaceAll: false,
  });
  if (!result.changed) {
    return new ErrorResponse(`Word did not delete the range (${result.reason}).`, [
      'Use get_text_context and specify occurrence.',
    ]);
  }
  return new WordActionResponse(result, `Deleted occurrence ${result.occurrence}.`, [
    'Use wait_for_save before closing.',
  ]);
}

export const deleteRangeAction = new PluginAction({
  name: 'delete_range',
  description: 'Delete one exact native search occurrence',
  params: [
    { name: 'query', type: 'string', description: 'Exact range text', required: true },
    { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
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
  handler: deleteRange,
});
