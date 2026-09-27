import { WordActionResponse, findDocumentText } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function findText({ page, params }) {
  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await findDocumentText(page, params);
  return new WordActionResponse(
    result,
    `Word found ${result.matchCount} match(es) across the document.`,
    result.matchCount > 0 ? ['Use get_text_context or replace_text next.'] : ['Adjust the query or search options.']
  );
}
