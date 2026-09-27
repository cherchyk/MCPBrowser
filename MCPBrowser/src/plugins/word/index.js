import { findText } from './actions/find-text.js';
import { addComment, listComments, resolveComment } from './actions/comments.js';
import { closeDocument } from './actions/close-document.js';
import { deleteRange } from './actions/delete-range.js';
import { formatRange } from './actions/format-range.js';
import { getDocumentInfoAction } from './actions/get-document-info.js';
import { getOutline } from './actions/get-outline.js';
import { getState } from './actions/get-state.js';
import { getTextContext } from './actions/get-text-context.js';
import { insertAt } from './actions/insert-at.js';
import { insertDocumentHtml, insertDocumentText } from './actions/insert-document.js';
import { addLink, removeLink, updateLink } from './actions/link.js';
import { listLinks } from './actions/list-links.js';
import { listTables } from './actions/list-tables.js';
import { openDocument } from './actions/open-document.js';
import { readDocument } from './actions/read-document.js';
import { readRange } from './actions/read-range.js';
import { readTable } from './actions/read-table.js';
import { replaceDocumentHtml } from './actions/replace-document-html.js';
import { replaceDocumentText } from './actions/replace-document-text.js';
import { replaceRange } from './actions/replace-range.js';
import { replaceText } from './actions/replace-text.js';
import { updateTableCell } from './actions/update-table-cell.js';
import { waitForSave } from './actions/wait-for-save.js';
import { matchesWordUrl } from './helpers.js';

export const manifest = {
  name: 'word',
  version: '1.0.0',
  description: 'Microsoft Word Online controller for reading, editing, and reviewing authenticated documents',
  interfaceVersion: 1,
  urlPatterns: ['word.cloud.microsoft', 'word.office.com', 'sharepoint.com', 'officeapps.live.com', 'onedrive.live.com'],
  domPatterns: ['#PagesContainer', 'form[target^="WacFrame"]']
};

export function matchesPage(url, html) {
  try {
    if (matchesWordUrl(url)) {
      const hostname = new URL(url).hostname;
      if (hostname === 'officeapps.live.com' || hostname.endsWith('.officeapps.live.com')) {
        return { matched: true, confidence: 1.0 };
      }
      if (hostname === 'sharepoint.com' || hostname.endsWith('.sharepoint.com')) {
        return { matched: true, confidence: 0.95 };
      }
      return { matched: true, confidence: 0.7 };
    }
    if (html?.includes('id="PagesContainer"') || html?.includes('target="WacFrame')) {
      return { matched: true, confidence: 0.8 };
    }
    return { matched: false };
  } catch {
    return { matched: false };
  }
}

export function getActions() {
  return [
    { name: 'open_document', description: 'Open and prepare an authenticated Word Online document', params: [
      { name: 'url', type: 'string', description: 'HTTPS Word, SharePoint, OneDrive, or Office Online document URL', required: false },
      { name: 'mode', type: 'string', description: 'Requested mode: edit or view', required: false, default: 'edit' }
    ], execute: openDocument },
    { name: 'read_document', description: 'Read a bounded chunk from currently rendered Word pages', params: [
      { name: 'url', type: 'string', description: 'Optional document URL to open first', required: false },
      { name: 'offset', type: 'number', description: 'Rendered-text character offset', required: false, default: 0 },
      { name: 'maxCharacters', type: 'number', description: 'Maximum characters to return', required: false, default: 20000 }
    ], execute: readDocument },
    { name: 'replace_document_text', description: 'Replace the entire document with plain text', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false },
      { name: 'text', type: 'string', description: 'Plain text replacement content', required: true }
    ], execute: replaceDocumentText },
    { name: 'replace_document_html', description: 'Replace the entire document with sanitized rich HTML', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false },
      { name: 'html', type: 'string', description: 'Rich HTML replacement content', required: true },
      { name: 'plainText', type: 'string', description: 'Equivalent plain-text fallback', required: true }
    ], execute: replaceDocumentHtml },
    { name: 'insert_document_text', description: 'Prepend or append plain text', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false },
      { name: 'position', type: 'string', description: 'start or end', required: true },
      { name: 'text', type: 'string', description: 'Plain text to insert', required: true }
    ], execute: insertDocumentText },
    { name: 'insert_document_html', description: 'Prepend or append sanitized rich HTML', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false },
      { name: 'position', type: 'string', description: 'start or end', required: true },
      { name: 'html', type: 'string', description: 'Rich HTML to insert', required: true },
      { name: 'plainText', type: 'string', description: 'Equivalent plain-text fallback', required: true }
    ], execute: insertDocumentHtml },
    { name: 'find_text', description: 'Search the full document and return native match counts and snippets', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false },
      { name: 'query', type: 'string', description: 'Text to find', required: true },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false },
      { name: 'wholeWords', type: 'boolean', description: 'Match whole words only', required: false, default: false }
    ], execute: findText },
    { name: 'get_document_info', description: 'Read document title, mode, word count, rendered layout, and save state', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false }
    ], execute: getDocumentInfoAction },
    { name: 'get_outline', description: 'Read the native Word heading outline across the document', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false }
    ], execute: getOutline },
    { name: 'read_range', description: 'Navigate to an optional heading and read a bounded rendered paragraph range', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false },
      { name: 'heading', type: 'string', description: 'Optional exact heading text to navigate to', required: false },
      { name: 'headingOccurrence', type: 'number', description: '1-based heading occurrence', required: false, default: 1 },
      { name: 'startParagraph', type: 'number', description: '0-based rendered paragraph index', required: false, default: 0 },
      { name: 'paragraphCount', type: 'number', description: 'Maximum paragraphs to return', required: false, default: 50 }
    ], execute: readRange },
    { name: 'get_text_context', description: 'Read bounded native search context for one exact occurrence', params: [
      { name: 'query', type: 'string', description: 'Text to locate', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false },
      { name: 'wholeWords', type: 'boolean', description: 'Match whole words only', required: false, default: false }
    ], execute: getTextContext },
    { name: 'replace_text', description: 'Surgically replace one or all native Word search matches', params: [
      { name: 'url', type: 'string', description: 'Optional document URL', required: false },
      { name: 'query', type: 'string', description: 'Existing text', required: true },
      { name: 'replacement', type: 'string', description: 'Replacement text', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'replaceAll', type: 'boolean', description: 'Replace every match', required: false, default: false },
      { name: 'expectedMatchCount', type: 'number', description: 'Abort if count differs', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false },
      { name: 'wholeWords', type: 'boolean', description: 'Match whole words only', required: false, default: false }
    ], execute: replaceText },
    { name: 'insert_at', description: 'Insert plain text immediately before or after an exact native search occurrence', params: [
      { name: 'query', type: 'string', description: 'Anchor text', required: true },
      { name: 'text', type: 'string', description: 'Text to insert', required: true },
      { name: 'position', type: 'string', description: 'before or after', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'expectedMatchCount', type: 'number', description: 'Abort if count differs', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false },
      { name: 'wholeWords', type: 'boolean', description: 'Match whole words only', required: false, default: false }
    ], execute: insertAt },
    { name: 'replace_range', description: 'Replace one exact native search occurrence with plain text', params: [
      { name: 'query', type: 'string', description: 'Exact range text', required: true },
      { name: 'replacement', type: 'string', description: 'Replacement text', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'expectedMatchCount', type: 'number', description: 'Abort if count differs', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false },
      { name: 'wholeWords', type: 'boolean', description: 'Match whole words only', required: false, default: false }
    ], execute: replaceRange },
    { name: 'delete_range', description: 'Delete one exact native search occurrence', params: [
      { name: 'query', type: 'string', description: 'Exact range text', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'expectedMatchCount', type: 'number', description: 'Abort if count differs', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false },
      { name: 'wholeWords', type: 'boolean', description: 'Match whole words only', required: false, default: false }
    ], execute: deleteRange },
    { name: 'format_range', description: 'Apply bold, italic, underline, or strikethrough to one exact occurrence', params: [
      { name: 'query', type: 'string', description: 'Exact text to format', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false },
      { name: 'wholeWords', type: 'boolean', description: 'Match whole words only', required: false, default: false },
      { name: 'bold', type: 'boolean', description: 'Toggle bold', required: false },
      { name: 'italic', type: 'boolean', description: 'Toggle italic', required: false },
      { name: 'underline', type: 'boolean', description: 'Toggle underline', required: false },
      { name: 'strikethrough', type: 'boolean', description: 'Toggle strikethrough', required: false }
    ], execute: formatRange },
    { name: 'list_tables', description: 'List tables on currently rendered Word pages with dimensions and previews', params: [], execute: listTables },
    { name: 'read_table', description: 'Read rows and cells from a rendered table', params: [
      { name: 'tableIndex', type: 'number', description: '0-based rendered table index', required: true }
    ], execute: readTable },
    { name: 'update_table_cell', description: 'Safely update one rendered table cell using its current text as a locator', params: [
      { name: 'tableIndex', type: 'number', description: '0-based table index', required: true },
      { name: 'rowIndex', type: 'number', description: '0-based row index', required: true },
      { name: 'columnIndex', type: 'number', description: '0-based column index', required: true },
      { name: 'text', type: 'string', description: 'Replacement cell text', required: true },
      { name: 'expectedText', type: 'string', description: 'Abort unless the cell currently has this text', required: false },
      { name: 'occurrence', type: 'number', description: 'Occurrence when cell text is duplicated', required: false },
      { name: 'expectedMatchCount', type: 'number', description: 'Abort if document-wide count differs', required: false }
    ], execute: updateTableCell },
    { name: 'list_links', description: 'List links on currently rendered Word pages', params: [], execute: listLinks },
    { name: 'add_link', description: 'Turn one exact text occurrence into a hyperlink', params: [
      { name: 'query', type: 'string', description: 'Exact link text', required: true },
      { name: 'url', type: 'string', description: 'http, https, or mailto URL', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false }
    ], execute: addLink },
    { name: 'update_link', description: 'Update the hyperlink on one exact linked text occurrence', params: [
      { name: 'query', type: 'string', description: 'Exact linked text', required: true },
      { name: 'url', type: 'string', description: 'New http, https, or mailto URL', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false }
    ], execute: updateLink },
    { name: 'remove_link', description: 'Remove hyperlink formatting from one exact text occurrence', params: [
      { name: 'query', type: 'string', description: 'Exact linked text', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false }
    ], execute: removeLink },
    { name: 'list_comments', description: 'List visible Word comment items', params: [], execute: listComments },
    { name: 'add_comment', description: 'Add a comment to one exact text occurrence', params: [
      { name: 'query', type: 'string', description: 'Exact text to comment on', required: true },
      { name: 'comment', type: 'string', description: 'Comment text', required: true },
      { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
      { name: 'matchCase', type: 'boolean', description: 'Require matching case', required: false, default: false }
    ], execute: addComment },
    { name: 'resolve_comment', description: 'Resolve one visible Word comment by index', params: [
      { name: 'commentIndex', type: 'number', description: '0-based visible comment index', required: true }
    ], execute: resolveComment },
    { name: 'get_state', description: 'Inspect editor, layout, content checks, and save state', params: [
      { name: 'expectedTextPrefix', type: 'string', description: 'Optional expected prefix', required: false },
      { name: 'expectedTextSuffix', type: 'string', description: 'Optional expected suffix', required: false }
    ], execute: getState },
    { name: 'wait_for_save', description: 'Wait for stable layout and Word confirmed save', params: [
      { name: 'timeoutMs', type: 'number', description: 'Timeout in milliseconds', required: false, default: 60000 },
      { name: 'pollIntervalMs', type: 'number', description: 'Polling interval', required: false, default: 1000 },
      { name: 'expectedTextPrefix', type: 'string', description: 'Optional expected prefix', required: false },
      { name: 'expectedTextSuffix', type: 'string', description: 'Optional expected suffix', required: false }
    ], execute: waitForSave },
    { name: 'close_document', description: 'Close the Word tab after confirmed save unless force is true', params: [
      { name: 'force', type: 'boolean', description: 'Close even if save cannot be confirmed', required: false, default: false },
      { name: 'timeoutMs', type: 'number', description: 'Save confirmation timeout', required: false, default: 60000 }
    ], execute: closeDocument }
  ];
}

export function getInfo() {
  return {
    recommendation: 'Use Word actions for authenticated online documents instead of generic DOM manipulation.',
    description: manifest.description,
    targetPages: ['Word home', 'SharePoint and OneDrive Word links', 'Word Online editors'],
    authFlow: 'Uses the existing browser session; complete Microsoft authentication in the browser.',
    actions: getActions().map(({ name, description, params }) => ({ name, description, params }))
  };
}
