import { ErrorResponse } from '../../../core/responses.js';
import { PluginAction } from '../../../core/actions.js';
import { WordActionResponse, copyDocumentContent } from '../helpers.js';
import { writeWordClipboardAsMarkdown } from '../markdown-files.js';
import { isPreparationResponse, prepareEditor } from './common.js';

async function exportMarkdown({ page, params }) {
  const prepared = await prepareEditor(page, params, 'view');
  if (isPreparationResponse(prepared)) return prepared;

  let clipboard;
  try {
    clipboard = await copyDocumentContent(page);
  } catch (error) {
    return new ErrorResponse(`Word export could not copy the document: ${error.message}`, [
      'Verify that the document is open and retry.',
    ]);
  }
  if (!clipboard.accepted || (!clipboard.html && !clipboard.text)) {
    return new ErrorResponse('Word did not provide document content for Markdown export.', [
      'Open the document in Word editing or viewing mode and retry.',
    ]);
  }

  let exported;
  try {
    exported = await writeWordClipboardAsMarkdown(params?.outputPath, clipboard, {
      overwrite: params?.overwrite === true,
    });
  } catch (error) {
    return new ErrorResponse(`Markdown export could not write the output: ${error.message}`, [
      'Choose a writable absolute outputPath and retry.',
    ]);
  }

  return new WordActionResponse(
    {
      ...exported,
      copiedFileCount: clipboard.files.length,
    },
    `Exported the Word document to ${exported.outputPath}.`,
    exported.unresolvedImages.length > 0
      ? ['Some Word images could not be extracted; inspect unresolvedImages in the result.']
      : [],
  );
}

export const exportMarkdownAction = new PluginAction({
  name: 'export_markdown',
  description:
    'Export the complete Word document to a local Markdown file without returning its content through MCP',
  params: [
    { name: 'url', type: 'string', description: 'Optional document URL', required: false },
    {
      name: 'outputPath',
      type: 'string',
      description:
        'Absolute .md or .markdown output path; images use a sibling <name>.assets folder',
      required: true,
    },
    {
      name: 'overwrite',
      type: 'boolean',
      description: 'Replace an existing Markdown file',
      required: false,
      default: false,
    },
  ],
  response: WordActionResponse,
  handler: exportMarkdown,
});
