import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, waitForDocumentSave } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function closeDocument({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  if (params?.force !== true) {
    const save = await waitForDocumentSave(page, params);
    if (!save.saved) {
      return new ErrorResponse(
        `Word save could not be confirmed (${save.reason}); the tab remains open.`,
        ['Retry close_document after Word reports saved or use force: true.'],
      );
    }
  }
  await page.close();
  return new WordActionResponse(
    { closed: true, forced: params?.force === true },
    'Closed the Word document tab.',
    [],
  );
}

export const closeDocumentAction = new PluginAction({
  name: 'close_document',
  description: 'Close the Word tab after confirmed save unless force is true',
  params: [
    {
      name: 'force',
      type: 'boolean',
      description: 'Close even if save cannot be confirmed',
      required: false,
      default: false,
    },
    {
      name: 'timeoutMs',
      type: 'number',
      description: 'Save confirmation timeout',
      required: false,
      default: 60000,
    },
  ],
  response: WordActionResponse,
  handler: closeDocument,
});
