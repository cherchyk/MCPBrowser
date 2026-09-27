import { ErrorResponse } from '../../../core/responses.js';
import { WordActionResponse, readRenderedParagraphRange } from '../helpers.js';
import { isPreparationResponse, prepareEditor } from './common.js';

export async function readRange({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;
  const result = await readRenderedParagraphRange(page, params);
  if (result.navigated === false) {
    return new ErrorResponse(`Heading '${params?.heading}' was not found.`, ['Use get_outline to inspect available headings.']);
  }
  return new WordActionResponse(result, `Read ${result.paragraphs.length} rendered paragraph(s).`, result.hasMoreRendered
    ? [`Call read_range with startParagraph: ${result.nextParagraph}.`]
    : ['Use another heading locator or find_text to navigate elsewhere.']);
}
