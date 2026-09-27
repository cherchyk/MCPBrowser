import { WordActionResponse, getDocumentOutline } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function getOutline({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const headings = await getDocumentOutline(page);
  return new WordActionResponse({ headings }, `Word found ${headings.length} heading(s).`, ['Use read_range with a heading locator to read that area.']);
}
