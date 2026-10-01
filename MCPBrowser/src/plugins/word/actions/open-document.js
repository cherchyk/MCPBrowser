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
  const status = state.wordCountState === 'ready' ? 'ready' : 'loading';
  return new WordActionResponse(
    { status, ...state },
    status === 'ready'
      ? `Word document opened in ${state.mode} mode.`
      : `Word document opened in ${state.mode} mode and is still loading.`,
    status === 'ready'
      ? ['Use read_document, get_outline, or get_document_info next.']
      : [
          'Use read_document for currently rendered content, or retry open_document after Word finishes counting.',
        ],
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
