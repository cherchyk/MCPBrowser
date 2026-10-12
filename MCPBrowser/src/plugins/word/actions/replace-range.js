import { WordActionResponse, replaceDocumentTextSurgically } from '../helpers.js';
import { isPreparationResponse, mutationFailure, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function replaceRange({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await replaceDocumentTextSurgically(page, { ...params, replaceAll: false });
  if (!result.changed) {
    return mutationFailure(result);
  }
  return new WordActionResponse(result, `Replaced occurrence ${result.occurrence}.`, [
    'Use wait_for_save before closing.',
  ]);
}

export const replaceRangeAction = new PluginAction({
  name: 'replace_range',
  description: 'Replace one exact native search occurrence with plain text',
  params: [
    { name: 'query', type: 'string', description: 'Exact range text', required: true },
    { name: 'replacement', type: 'string', description: 'Replacement text', required: true },
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
  handler: replaceRange,
});
