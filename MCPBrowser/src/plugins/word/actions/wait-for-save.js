import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, waitForDocumentSave } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function waitForSave({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await waitForDocumentSave(page, params);
  if (!result.saved) {
    return new ErrorResponse(`Word save could not be confirmed (${result.reason}).`, [
      'Keep the document open and retry wait_for_save.',
    ]);
  }
  return new WordActionResponse(
    result,
    'Word confirmed the document is saved and layout is stable.',
    ['The document can now be closed.'],
  );
}

export const waitForSaveAction = new PluginAction({
  name: 'wait_for_save',
  description: 'Wait for stable layout and Word confirmed save',
  params: [
    {
      name: 'timeoutMs',
      type: 'number',
      description: 'Timeout in milliseconds',
      required: false,
      default: 60000,
    },
    {
      name: 'pollIntervalMs',
      type: 'number',
      description: 'Polling interval',
      required: false,
      default: 1000,
    },
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
  handler: waitForSave,
});
