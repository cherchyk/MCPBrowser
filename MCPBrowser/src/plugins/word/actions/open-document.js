import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, getDocumentState, isAllowedWordUrl } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function openDocument({ page, params }) {
  if (params?.url !== undefined && !isAllowedWordUrl(params.url)) {
    return new ErrorResponse(
      'url must be an HTTPS Word, OneDrive, SharePoint, or Office Online document URL.',
      ['Use an authenticated SharePoint or OneDrive Word document link.']
    );
  }
  const prepared = await prepareEditor(page, params, params?.mode ?? 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const state = await getDocumentState(page, { maxCharacters: 1 });
  return new WordActionResponse(
    { status: 'ready', ...state },
    `Word document opened in ${state.mode} mode.`,
    ['Use read_document, get_outline, or get_document_info next.']
  );
}
