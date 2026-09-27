import { WordActionResponse, listRenderedLinks } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function listLinks({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const links = await listRenderedLinks(page);
  return new WordActionResponse({ links, renderedOnly: true }, `Found ${links.length} rendered link(s).`, ['Use add_link or update_link with anchor text.']);
}
