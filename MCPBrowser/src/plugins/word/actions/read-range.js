import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, readRenderedParagraphRange } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';
import { PluginAction } from '../../../core/actions.js';

async function readRange({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await readRenderedParagraphRange(page, params);
  if (result.navigated === false) {
    return new ErrorResponse(`Heading '${params?.heading}' was not found.`, [
      'Use get_outline to inspect available headings.',
    ]);
  }
  return new WordActionResponse(
    result,
    `Read ${result.paragraphs.length} rendered paragraph(s).`,
    result.hasMoreRendered
      ? [`Call read_range with startParagraph: ${result.nextParagraph}.`]
      : ['Use another heading locator or find_text to navigate elsewhere.'],
  );
}

export const readRangeAction = new PluginAction({
  name: 'read_range',
  description: 'Navigate to an optional heading and read a bounded rendered paragraph range',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    {
      name: 'heading',
      type: 'string',
      description: 'Optional exact heading text to navigate to',
      required: false,
    },
    {
      name: 'headingOccurrence',
      type: 'number',
      description: '1-based heading occurrence',
      required: false,
      default: 1,
    },
    {
      name: 'startParagraph',
      type: 'number',
      description: '0-based rendered paragraph index',
      required: false,
      default: 0,
    },
    {
      name: 'paragraphCount',
      type: 'number',
      description: 'Maximum paragraphs to return',
      required: false,
      default: 50,
    },
  ],
  response: WordActionResponse,
  handler: readRange,
});
