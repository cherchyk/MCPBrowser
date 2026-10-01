import {
  WordActionResponse,
  getDocumentState,
  validateReadLimit,
  validateReadOffset,
} from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function readDocument({ page, params }) {
  const maxCharacters = validateReadLimit(params?.maxCharacters);
  const offset = validateReadOffset(params?.offset);
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const state = await getDocumentState(page, { includeText: true, maxCharacters, offset });
  return new WordActionResponse(
    { ...state, mayBePartial: state.pageCount > 0 },
    `Read ${state.text.length} of ${state.textLength} rendered characters from Word Online.`,
    state.hasMore
      ? [`Call read_document with offset: ${state.nextOffset} for the next rendered chunk.`]
      : ['Use get_outline or find_text to navigate beyond rendered pages.'],
  );
}

export const readDocumentAction = new PluginAction({
  name: 'read_document',
  description: 'Read a bounded chunk from currently rendered Word pages',
  params: [
    {
      name: 'url',
      type: 'string',
      description: 'Optional document URL to open first',
      required: false,
    },
    {
      name: 'offset',
      type: 'number',
      description: 'Rendered-text character offset',
      required: false,
      default: 0,
    },
    {
      name: 'maxCharacters',
      type: 'number',
      description: 'Maximum characters to return',
      required: false,
      default: 20000,
    },
  ],
  response: WordActionResponse,
  handler: readDocument,
});
