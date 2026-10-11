import { ErrorResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { WordActionResponse, updateDocumentContent } from '../helpers.js';
import { MAX_MARKDOWN_CHUNK_HTML_BYTES, loadMarkdownForWord } from '../markdown-files.js';
import { isPreparationResponse, prepareEditor } from './common.js';

async function importMarkdown({ page, params }) {
  if (!['replace', 'start', 'end'].includes(params?.placement)) {
    return new ErrorResponse("placement must be 'replace', 'start', or 'end'.", [
      "Use 'replace', 'start', or 'end'.",
    ]);
  }

  let imported;
  try {
    imported = await loadMarkdownForWord(params?.sourcePath);
  } catch (error) {
    return new ErrorResponse(`Markdown import could not read the source: ${error.message}`, [
      'Verify sourcePath and all local image paths, then retry.',
    ]);
  }

  const prepared = await prepareEditor(page, params, 'edit');
  if (isPreparationResponse(prepared)) return prepared;

  const chunks = params.placement === 'start' ? [...imported.chunks].reverse() : imported.chunks;
  for (let index = 0; index < chunks.length; index++) {
    const placement =
      params.placement === 'replace' ? (index === 0 ? 'replace' : 'end') : params.placement;
    const result = await updateDocumentContent(page, {
      ...chunks[index],
      placement,
      allowImages: true,
      maxHtmlBytes: MAX_MARKDOWN_CHUNK_HTML_BYTES,
    });
    if (!result.accepted) {
      return new ErrorResponse(
        `Word rejected Markdown chunk ${index + 1} of ${chunks.length} (${result.reason}). ${
          index > 0 ? `${index} chunk(s) were already inserted.` : 'The document was not changed.'
        }`,
        ['Inspect the Word document before retrying to avoid duplicate content.'],
      );
    }
  }

  return new WordActionResponse(
    {
      sourcePath: imported.sourcePath,
      sourceBytes: imported.sourceBytes,
      chunksInserted: imported.chunks.length,
      imagesEmbedded: imported.imageCount,
      imageReferences: imported.imageReferences,
      imageBytes: imported.imageBytes,
      placement: params.placement,
    },
    `Imported Markdown from ${imported.sourcePath} in ${imported.chunks.length} chunk(s).`,
    ['Use wait_for_save before closing the document.'],
  );
}

export const importMarkdownAction = new PluginAction({
  name: 'import_markdown',
  description:
    'Import a local Markdown file and its local images without sending the file content through MCP',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    {
      name: 'sourcePath',
      type: 'string',
      description: 'Absolute path to a local .md or .markdown file',
      required: true,
    },
    {
      name: 'placement',
      type: 'string',
      description: 'replace, start, or end',
      required: true,
    },
  ],
  response: WordActionResponse,
  handler: importMarkdown,
});
