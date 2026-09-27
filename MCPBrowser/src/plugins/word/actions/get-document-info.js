import { WordActionResponse, getDocumentInfo } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function getDocumentInfoAction({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const info = await getDocumentInfo(page);
  return new WordActionResponse(info, `Read metadata for ${info.title || 'the Word document'}.`, ['Use get_outline or read_range next.']);
}
