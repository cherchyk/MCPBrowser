import { WordActionResponse, getDocumentState } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function getState({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const state = await getDocumentState(page, {
    maxCharacters: 1,
    expectedTextPrefix: params?.expectedTextPrefix,
    expectedTextSuffix: params?.expectedTextSuffix,
  });
  return new WordActionResponse(
    state,
    `Word is in ${state.mode} mode; save state is ${state.saveState}.`,
    ['Use wait_for_save when saveState is saving.'],
  );
}

export const getStateAction = new PluginAction({
  name: 'get_state',
  description: 'Inspect editor, layout, content checks, and save state',
  params: [
    {
      name: 'expectedTextPrefix',
      type: 'string',
      description: 'Optional expected prefix',
      required: false,
    },
    {
      name: 'expectedTextSuffix',
      type: 'string',
      description: 'Optional expected suffix',
      required: false,
    },
  ],
  response: WordActionResponse,
  handler: getState,
});
