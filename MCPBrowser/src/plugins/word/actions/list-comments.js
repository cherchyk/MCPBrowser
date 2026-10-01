import { WordActionResponse, listDocumentComments } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function listComments({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const comments = await listDocumentComments(page);
  return new WordActionResponse({ comments }, `Found ${comments.length} visible comment item(s).`, [
    'Use add_comment to comment on exact text.',
  ]);
}

export const listCommentsAction = new PluginAction({
  name: 'list_comments',
  description: 'List visible Word comment items',
  params: [],
  response: WordActionResponse,
  handler: listComments,
});
