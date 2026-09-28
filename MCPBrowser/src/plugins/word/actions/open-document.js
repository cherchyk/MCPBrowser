import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, getDocumentState, isAllowedWordUrl } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function openDocument({ page, params }) {
  if (params?.url !== undefined && !isAllowedWordUrl(params.url)) {
    return new ErrorResponse(
      'url must be an HTTPS Word, OneDrive, SharePoint, or Office Online document URL.',
      ['Use an authenticated SharePoint or OneDrive Word document link.'],
    );
  }
  const prepared = await prepareEditor(page, params, params?.mode ?? 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const state = await getDocumentState(page, { maxCharacters: 1 });
  return new WordActionResponse(
    { status: 'ready', ...state },
    `Word document opened in ${state.mode} mode.`,
    ['Use read_document, get_outline, or get_document_info next.'],
  );
}

export const openDocumentAction = new PluginAction({
  name: 'open_document',
  description: 'Open and prepare an authenticated Word Online document',
  params: [
    {
      name: 'url',
      type: 'string',
      description: 'HTTPS Word, SharePoint, OneDrive, or Office Online document URL',
      required: false,
    },
    {
      name: 'mode',
      type: 'string',
      description: 'Requested mode: edit or view',
      required: false,
      default: 'edit',
    },
  ],
  response: WordActionResponse,
  handler: openDocument,
});
