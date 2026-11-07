import { InformationalResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { ExcelActionResponse } from '../helpers.js';
import { waitForSave } from '../mutations.js';
import { prepareEditor, urlParam } from './common.js';

export const waitForSaveAction = new PluginAction({
  name: 'wait_for_save',
  description:
    'Wait for Excel to confirm a stable saved state; fail if the save signal is unavailable',
  params: [
    urlParam,
    {
      name: 'timeoutMs',
      type: 'number',
      description: 'Save deadline from 500 to 60000 milliseconds',
      required: false,
      default: 30000,
    },
  ],
  response: ExcelActionResponse,
  handler: async ({ page, params }) => {
    const editor = await prepareEditor(page, params);
    if (editor instanceof InformationalResponse) return editor;
    const result = await waitForSave(editor.frame, params?.timeoutMs);
    return new ExcelActionResponse(result, 'Excel confirms the workbook is saved.');
  },
});
