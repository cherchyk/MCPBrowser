import { randomUUID } from 'crypto';
import { MCPResponse } from '../../core/responses.js';
import * as sel from './selectors.js';

export const WORD_EDITOR_SELECTOR = sel.WORD_EDITOR;
export const EDITABLE_WORD_EDITOR_SELECTOR = sel.EDITABLE_WORD_EDITOR;
export const DEFAULT_NAVIGATION_TIMEOUT = 45_000;
export const DEFAULT_STATE_TIMEOUT = 60_000;
export const MAX_HTML_BYTES = 200_000;
export const MAX_TEXT_CHARACTERS = 100_000;
export const MAX_READ_CHARACTERS = 100_000;

const WORD_HOSTS = new Set(['word.cloud.microsoft', 'word.office.com', 'onedrive.live.com']);

export class WordActionResponse extends MCPResponse {
  constructor(data, summary, nextSteps = []) {
    super(nextSteps);
    this.data = data;
    this.summary = summary;
  }

  _getAdditionalFields() {
    return { data: this.data };
  }

  getTextSummary() {
    return this.summary;
  }
}

export function isOfficeEditorHost(hostname) {
  return hostname === 'officeapps.live.com' || hostname.endsWith('.officeapps.live.com');
}

export function isSharePointHost(hostname) {
  return hostname === 'sharepoint.com' || hostname.endsWith('.sharepoint.com');
}

export function isAllowedWordUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (WORD_HOSTS.has(url.hostname) ||
        isSharePointHost(url.hostname) ||
        isOfficeEditorHost(url.hostname))
    );
  } catch {
    return false;
  }
}

export function isAuthenticationUrl(value) {
  try {
    const hostname = new URL(value).hostname;
    return (
      hostname === 'login.microsoftonline.com' ||
      hostname.endsWith('.login.microsoftonline.com') ||
      hostname === 'login.live.com' ||
      hostname === 'account.live.com'
    );
  } catch {
    return false;
  }
}

export function matchesWordUrl(value) {
  return typeof value === 'string' && isAllowedWordUrl(value);
}

export function validateReadLimit(value) {
  const limit = value ?? 20_000;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_READ_CHARACTERS) {
    throw new Error(`maxCharacters must be an integer between 1 and ${MAX_READ_CHARACTERS}`);
  }
  return limit;
}

export function validateReadOffset(value) {
  const offset = value ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    throw new Error('offset must be a non-negative integer');
  }
  return offset;
}

export function validateMutationPayload({ html, plainText }) {
  if (typeof plainText !== 'string') {
    throw new Error('plainText is required and must be a string');
  }
  if (plainText.length > MAX_TEXT_CHARACTERS) {
    throw new Error(`plainText exceeds the ${MAX_TEXT_CHARACTERS} character limit`);
  }
  if (html !== undefined) {
    if (typeof html !== 'string') {
      throw new Error('html must be a string');
    }
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
      throw new Error(`html exceeds the ${MAX_HTML_BYTES} byte limit`);
    }
  }
}

export function validateSearchValue(value, name, maxCharacters = 10_000) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${name} is required and must be a non-empty string`);
  }
  if (value.length > maxCharacters) {
    throw new Error(`${name} exceeds the ${maxCharacters} character limit`);
  }
  return value;
}

function getPageFrames(page) {
  try {
    const frames = page.frames?.();
    if (Array.isArray(frames) && frames.length > 0) return frames;
  } catch {
    // Fall back to the page for tests and older browser adapters.
  }
  return [page];
}

function frameMatchesUrl(frame, predicate) {
  try {
    return predicate(new URL(frame.url()).hostname);
  } catch {
    return false;
  }
}

async function inspectWordEditor(frame) {
  try {
    return await frame.evaluate((selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        editable: element.getAttribute('contenteditable') === 'true',
        visible: rect.width >= 100 && rect.height >= 100,
      };
    }, WORD_EDITOR_SELECTOR);
  } catch {
    return null;
  }
}

async function findWordEditorContext(page) {
  const frames = [...getPageFrames(page)].sort(
    (left, right) =>
      Number(frameMatchesUrl(right, isOfficeEditorHost)) -
      Number(frameMatchesUrl(left, isOfficeEditorHost)),
  );
  let hiddenEditor = null;
  for (const frame of frames) {
    const editor = await inspectWordEditor(frame);
    if (!editor) continue;
    const result = { frame, editor };
    if (editor.visible) return result;
    hiddenEditor ??= result;
  }
  return hiddenEditor;
}

async function waitForWordEditorContext(page, timeout = DEFAULT_NAVIGATION_TIMEOUT) {
  const deadline = Date.now() + timeout;
  let result = null;
  do {
    result = await findWordEditorContext(page);
    if (result?.editor.visible || Date.now() >= deadline) return result;
    await new Promise((resolve) => setTimeout(resolve, 200));
  } while (true);
}

export async function ensureWordEditor(page, { url, mode = 'edit' } = {}) {
  if (!['edit', 'view'].includes(mode)) {
    throw new Error("mode must be either 'edit' or 'view'");
  }

  if (url !== undefined) {
    if (!isAllowedWordUrl(url)) {
      throw new Error(
        'url must be an HTTPS Word, OneDrive, SharePoint, or Office Online document URL',
      );
    }
    if (page.url() !== url) {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: DEFAULT_NAVIGATION_TIMEOUT,
      });
    }
  }

  if (isAuthenticationUrl(page.url())) {
    return { status: 'user_action_required', reason: 'authentication_required' };
  }

  let currentUrl = new URL(page.url());
  let editorContext = await findWordEditorContext(page);
  let editorFrameExpected = false;
  if (!isOfficeEditorHost(currentUrl.hostname)) {
    const hasOfficeFrame = getPageFrames(page).some((frame) =>
      frameMatchesUrl(frame, isOfficeEditorHost),
    );
    if (!editorContext && !hasOfficeFrame) {
      const navigation = page
        .waitForNavigation({
          waitUntil: 'domcontentloaded',
          timeout: DEFAULT_NAVIGATION_TIMEOUT,
        })
        .catch(() => null);

      const promotion = await page.evaluate(
        ({ requestedMode }) => {
          const form = document.querySelector('form[target^="WacFrame"]');
          if (!form) {
            return { status: 'launch_form_missing' };
          }

          const destination = new URL(form.action);
          const allowedHost =
            destination.hostname === 'officeapps.live.com' ||
            destination.hostname.endsWith('.officeapps.live.com');
          if (destination.protocol !== 'https:' || !allowedHost) {
            return { status: 'unexpected_editor_origin' };
          }

          const readonly =
            destination.searchParams.get('readonly') === '1' ||
            destination.searchParams.get('ro') === '1' ||
            destination.searchParams.get('action') === 'view';
          if (requestedMode === 'edit' && readonly) {
            return { status: 'read_only' };
          }

          const targetFrameExists =
            form.target &&
            Array.from(document.querySelectorAll('iframe, frame')).some(
              (frame) => frame.getAttribute('name') === form.target,
            );
          if (!targetFrameExists) form.target = '_self';
          form.submit();
          return { status: 'submitted', targetFrameExists };
        },
        { requestedMode: mode },
      );

      if (promotion.status !== 'submitted') {
        return promotion;
      }
      editorFrameExpected = promotion.targetFrameExists;
      if (!promotion.targetFrameExists) await navigation;
    }

    if (isAuthenticationUrl(page.url())) {
      return { status: 'user_action_required', reason: 'authentication_required' };
    }
    currentUrl = new URL(page.url());
  }

  const hasOfficeFrame = getPageFrames(page).some((frame) =>
    frameMatchesUrl(frame, isOfficeEditorHost),
  );
  if (
    !isOfficeEditorHost(currentUrl.hostname) &&
    !hasOfficeFrame &&
    !editorContext &&
    !editorFrameExpected
  ) {
    return { status: 'unexpected_editor_origin' };
  }

  editorContext = await waitForWordEditorContext(page);
  const editor = editorContext?.editor;

  if (!editor) return { status: 'editor_missing' };
  if (!editor?.visible) {
    return { status: 'editor_not_visible' };
  }
  if (mode === 'edit' && !editor.editable) {
    return { status: 'read_only' };
  }
  return { status: 'ready', mode: editor.editable ? 'edit' : 'view' };
}

export async function getDocumentState(page, options = {}) {
  const maxCharacters = validateReadLimit(options.maxCharacters ?? 1);
  const offset = validateReadOffset(options.offset);
  const expectedTextPrefix = options.expectedTextPrefix;
  const expectedTextSuffix = options.expectedTextSuffix;
  if (expectedTextPrefix !== undefined && typeof expectedTextPrefix !== 'string') {
    throw new Error('expectedTextPrefix must be a string');
  }
  if (expectedTextSuffix !== undefined && typeof expectedTextSuffix !== 'string') {
    throw new Error('expectedTextSuffix must be a string');
  }

  const editorContext = await findWordEditorContext(page);
  const context = editorContext?.frame ?? page;
  return context.evaluate(
    ({ selector, includeText, maxChars, textOffset, prefix, suffix }) => {
      const editor = document.querySelector(selector);
      if (!editor) {
        return {
          editorFound: false,
          mode: 'unknown',
          pageCount: 0,
          paragraphCount: 0,
          textLength: 0,
          saveState: 'unknown',
        };
      }

      const renderedParagraphs = Array.from(editor.querySelectorAll('.ParagraphTextContent')).map(
        (paragraph) => paragraph.innerText || paragraph.textContent || '',
      );
      const text = (
        renderedParagraphs.length > 0
          ? renderedParagraphs.join('\n\n')
          : editor.innerText || editor.textContent || ''
      )
        .replace(/\u200B/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
      const signals = [];
      const signalElements = document.querySelectorAll(
        '#SaveStatusButton, [aria-label], [title], [role="status"]',
      );
      for (const element of Array.from(signalElements).slice(0, 3000)) {
        const value = [
          element.getAttribute('aria-label'),
          element.getAttribute('title'),
          element.getAttribute('role') === 'status' ? element.textContent : '',
        ]
          .filter(Boolean)
          .join(' ')
          .trim();
        if (value && value.length <= 200) signals.push(value.toLowerCase());
      }

      let saveState = 'unknown';
      if (
        signals.some((value) =>
          /\b(save failed|unable to save|couldn['’]t save|upload failed)\b/.test(value),
        )
      ) {
        saveState = 'error';
      } else if (signals.some((value) => /\b(saving|uploading|syncing)\b/.test(value))) {
        saveState = 'saving';
      } else if (signals.some((value) => /\b(saved|saved to|all changes saved)\b/.test(value))) {
        saveState = 'saved';
      }

      const result = {
        editorFound: true,
        mode: editor.getAttribute('contenteditable') === 'true' ? 'edit' : 'view',
        pageCount: editor.querySelectorAll('.Page').length,
        paragraphCount: editor.querySelectorAll('.CanvasParagraph').length,
        textLength: text.length,
        saveState,
      };
      if (includeText) {
        result.text = text.slice(textOffset, textOffset + maxChars);
        result.offset = textOffset;
        result.nextOffset = Math.min(textOffset + result.text.length, text.length);
        result.hasMore = result.nextOffset < text.length;
        result.truncated = textOffset > 0 || result.hasMore;
      }
      if (prefix !== undefined) result.textPrefixMatches = text.startsWith(prefix);
      if (suffix !== undefined) result.textSuffixMatches = text.endsWith(suffix);
      return result;
    },
    {
      selector: WORD_EDITOR_SELECTOR,
      includeText: options.includeText === true,
      maxChars: maxCharacters,
      textOffset: offset,
      prefix: expectedTextPrefix,
      suffix: expectedTextSuffix,
    },
  );
}

export async function updateDocumentContent(page, { html, plainText, placement = 'replace' }) {
  validateMutationPayload({ html, plainText });
  if (!['replace', 'start', 'end'].includes(placement)) {
    throw new Error("placement must be 'replace', 'start', or 'end'");
  }
  let sanitized;
  if (html !== undefined) {
    const sanitizerPage = await page.browser().newPage();
    try {
      sanitized = await sanitizerPage.evaluate((richHtml) => {
        const documentFragment = new DOMParser().parseFromString(richHtml, 'text/html');
        const blocked =
          'script,style,link,meta,iframe,frame,object,embed,form,input,button,textarea,select,option,video,audio,source,canvas,svg,math,img';
        documentFragment.querySelectorAll(blocked).forEach((element) => element.remove());
        for (const element of documentFragment.body.querySelectorAll('*')) {
          for (const attribute of Array.from(element.attributes)) {
            const name = attribute.name.toLowerCase();
            if (
              name.startsWith('on') ||
              ['style', 'src', 'srcset', 'action', 'formaction', 'poster'].includes(name)
            ) {
              element.removeAttribute(attribute.name);
              continue;
            }
            if (name === 'href') {
              try {
                const target = new URL(attribute.value, 'https://word.cloud.microsoft/');
                if (!['http:', 'https:', 'mailto:'].includes(target.protocol)) {
                  element.removeAttribute(attribute.name);
                }
              } catch {
                element.removeAttribute(attribute.name);
              }
            }
          }
        }

        return {
          html: documentFragment.body.innerHTML,
          nodeCount: documentFragment.body.querySelectorAll('*').length,
          tableCount: documentFragment.body.querySelectorAll('table').length,
          linkCount: documentFragment.body.querySelectorAll('a[href]').length,
        };
      }, html);
    } finally {
      await sanitizerPage.close();
    }

    if (sanitized.nodeCount > 5000) {
      return { accepted: false, reason: 'html_node_limit_exceeded', operationId: randomUUID() };
    }
    if (sanitized.tableCount > 100) {
      return { accepted: false, reason: 'html_table_limit_exceeded', operationId: randomUUID() };
    }
    if (sanitized.linkCount > 1000) {
      return { accepted: false, reason: 'html_link_limit_exceeded', operationId: randomUUID() };
    }
  }

  const editorContext = await findWordEditorContext(page);
  const context = editorContext?.frame ?? page;
  await context.click(EDITABLE_WORD_EDITOR_SELECTOR);

  const result = await context.evaluate(
    async ({ selector, richHtml, text, sanitization, targetPlacement }) => {
      const editor = document.querySelector(selector);
      if (!editor) return { accepted: false, reason: 'editor_missing' };
      if (editor.getAttribute('contenteditable') !== 'true') {
        return { accepted: false, reason: 'read_only' };
      }

      editor.focus();
      if (!document.hasFocus() || document.activeElement !== editor) {
        return { accepted: false, reason: 'editor_not_focused' };
      }

      const keyConfig =
        targetPlacement === 'replace'
          ? { key: 'a', code: 'KeyA', keyCode: 65 }
          : targetPlacement === 'start'
            ? { key: 'Home', code: 'Home', keyCode: 36 }
            : { key: 'End', code: 'End', keyCode: 35 };
      const keyOptions = {
        ...keyConfig,
        which: keyConfig.keyCode,
        ctrlKey: !/Mac|iPhone|iPad|iPod/.test(navigator.platform),
        metaKey: /Mac|iPhone|iPad|iPod/.test(navigator.platform),
        bubbles: true,
        cancelable: true,
      };
      let navigationHandled = false;
      const eventTypes =
        targetPlacement === 'replace' ? ['keydown', 'keypress', 'keyup'] : ['keydown', 'keyup'];
      for (const type of eventTypes) {
        const event = new KeyboardEvent(type, keyOptions);
        editor.dispatchEvent(event);
        if (type === 'keydown') navigationHandled = event.defaultPrevented;
      }
      if (!navigationHandled) {
        return {
          accepted: false,
          reason:
            targetPlacement === 'replace'
              ? 'select_all_not_handled'
              : 'document_navigation_not_handled',
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));

      if (richHtml === undefined) {
        const inserted = document.execCommand('insertText', false, text);
        return {
          accepted: inserted,
          reason: inserted ? undefined : 'text_insertion_rejected',
          format: 'text',
          placement: targetPlacement,
        };
      }

      const data = new DataTransfer();
      data.setData('text/html', richHtml);
      data.setData('text/plain', text);
      const paste = new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(paste);
      return {
        accepted: paste.defaultPrevented,
        reason: paste.defaultPrevented ? undefined : 'paste_not_handled',
        format: 'html',
        sanitized: sanitization.changed,
        nodeCount: sanitization.nodeCount,
        tableCount: sanitization.tableCount,
        linkCount: sanitization.linkCount,
        placement: targetPlacement,
      };
    },
    {
      selector: EDITABLE_WORD_EDITOR_SELECTOR,
      richHtml: sanitized?.html,
      text: plainText,
      targetPlacement: placement,
      sanitization: sanitized
        ? {
            changed: sanitized.html !== html,
            nodeCount: sanitized.nodeCount,
            tableCount: sanitized.tableCount,
            linkCount: sanitized.linkCount,
          }
        : null,
    },
  );

  return {
    ...result,
    operationId: randomUUID(),
  };
}

async function openFindReplacePane(page) {
  const editorContext = await findWordEditorContext(page);
  const context = editorContext?.frame ?? page;
  const findVisible = await context
    .$eval('#FindSearchBoxV2', (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .catch(() => false);

  if (!findVisible) {
    await context.click(EDITABLE_WORD_EDITOR_SELECTOR);
    const modifier = await page.evaluate(() =>
      /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? 'Meta' : 'Control',
    );
    await page.keyboard.down(modifier);
    await page.keyboard.press('h');
    await page.keyboard.up(modifier);
  }

  await context.waitForSelector('#FindSearchBoxV2', {
    visible: true,
    timeout: 10_000,
  });

  const replaceVisible = await context
    .$eval('#ReplaceSearchBoxV2', (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .catch(() => false);
  if (!replaceVisible) {
    await context.click('#navigationTab3');
  }
  await context.waitForSelector('#ReplaceSearchBoxV2', {
    visible: true,
    timeout: 10_000,
  });
  return context;
}

async function replaceInputValue(page, context, selector, value) {
  await context.click(selector);
  const modifier = await page.evaluate(() =>
    /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? 'Meta' : 'Control',
  );
  await page.keyboard.down(modifier);
  await page.keyboard.press('a');
  await page.keyboard.up(modifier);
  await page.keyboard.type(value);
}

async function setFindFilter(page, context, label, enabled) {
  const filterButton = '#navigationTab3-panel button[aria-label="Filter"]';
  async function findTarget() {
    const handles = await context.$$('[role="menuitemcheckbox"]');
    for (const handle of handles) {
      const text = await handle.evaluate((element) => (element.textContent || '').trim());
      if (text === label || text.endsWith(label)) {
        return handle;
      }
    }
    return null;
  }

  let target = await findTarget();
  if (!target) {
    const expanded = await context
      .$eval(filterButton, (element) => element.getAttribute('aria-expanded') === 'true')
      .catch(() => false);
    if (expanded) {
      await context.click(filterButton);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await context.click(filterButton);
    await new Promise((resolve) => setTimeout(resolve, 500));
    target = await findTarget();
  }
  if (!target) throw new Error(`Word find option is unavailable: ${label}`);

  const checked = await target.evaluate(
    (element) => element.getAttribute('aria-checked') === 'true',
  );
  if (checked !== enabled) {
    await target.click();
  } else {
    await page.keyboard.press('Escape');
  }
}

async function configureFindFilters(
  page,
  context,
  { matchCase = false, wholeWords = false } = {},
) {
  await setFindFilter(page, context, 'Match case', matchCase);
  await setFindFilter(page, context, 'Whole words only', wholeWords);
}

async function readFindResults(context) {
  return context.evaluate(() => {
    const panel = document.querySelector('#navigationTab3-panel');
    if (!panel) return { ready: false, matchCount: 0, currentMatch: 0, snippets: [] };
    const text = panel.innerText || '';
    const countMatch = text.match(/Result\s+(\d+)\s+of\s+(\d+)/i);
    const noMatches = /\b(no results|no matches|0 results)\b/i.test(text);
    const snippets = Array.from(panel.querySelectorAll('[data-automation-type="SearchResult"]'))
      .slice(0, 20)
      .map((element, index) => ({
        occurrence: index + 1,
        text: (element.textContent || '').trim().slice(0, 300),
      }));
    return {
      ready: Boolean(countMatch || noMatches),
      currentMatch: countMatch ? Number(countMatch[1]) : 0,
      matchCount: countMatch ? Number(countMatch[2]) : 0,
      snippets,
    };
  });
}

export async function findDocumentText(page, options) {
  const query = validateSearchValue(options?.query, 'query', 5_000);
  const context = await openFindReplacePane(page);
  await configureFindFilters(page, context, options);
  await replaceInputValue(page, context, '#FindSearchBoxV2', query);

  await new Promise((resolve) => setTimeout(resolve, 750));
  const deadline = Date.now() + 10_000;
  let results;
  let previousSignature;
  let stableObservations = 0;
  while (Date.now() < deadline) {
    results = await readFindResults(context);
    const signature = JSON.stringify([results.currentMatch, results.matchCount, results.snippets]);
    stableObservations =
      results.ready && signature === previousSignature ? stableObservations + 1 : 0;
    previousSignature = signature;
    if (stableObservations >= 1) return { queryLength: query.length, ...results };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Word did not finish searching the document before the timeout');
}

export async function replaceDocumentTextSurgically(page, options) {
  const query = validateSearchValue(options?.query, 'query', 5_000);
  const replacement = options?.replacement;
  if (typeof replacement !== 'string') {
    throw new Error('replacement is required and must be a string');
  }
  if (replacement.length > 10_000) {
    throw new Error('replacement exceeds the 10000 character limit');
  }
  if (options?.replaceAll === true && options?.occurrence !== undefined) {
    throw new Error('occurrence cannot be combined with replaceAll');
  }
  if (
    options?.occurrence !== undefined &&
    (!Number.isInteger(options.occurrence) || options.occurrence < 1)
  ) {
    throw new Error('occurrence must be a positive integer');
  }
  if (
    options?.expectedMatchCount !== undefined &&
    (!Number.isInteger(options.expectedMatchCount) || options.expectedMatchCount < 0)
  ) {
    throw new Error('expectedMatchCount must be a non-negative integer');
  }

  const found = await findDocumentText(page, {
    query,
    matchCase: options?.matchCase,
    wholeWords: options?.wholeWords,
  });
  if (
    options?.expectedMatchCount !== undefined &&
    found.matchCount !== options.expectedMatchCount
  ) {
    return {
      changed: false,
      reason: 'unexpected_match_count',
      expectedMatchCount: options.expectedMatchCount,
      actualMatchCount: found.matchCount,
    };
  }
  if (found.matchCount === 0) {
    return { changed: false, reason: 'no_matches', matchCount: 0 };
  }

  let occurrence = options?.occurrence;
  if (options?.replaceAll !== true && occurrence === undefined) {
    if (found.matchCount !== 1) {
      return {
        changed: false,
        reason: 'ambiguous_match',
        matchCount: found.matchCount,
        snippets: found.snippets,
      };
    }
    occurrence = 1;
  }
  if (occurrence !== undefined && occurrence > found.matchCount) {
    return {
      changed: false,
      reason: 'occurrence_out_of_range',
      occurrence,
      matchCount: found.matchCount,
    };
  }

  const editorContext = await findWordEditorContext(page);
  const context = editorContext?.frame ?? page;
  if (occurrence !== undefined) {
    for (let current = found.currentMatch || 1; current < occurrence; current++) {
      await context.click('#NextSearchResult');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  await replaceInputValue(page, context, '#ReplaceSearchBoxV2', replacement);
  await context.click(options?.replaceAll === true ? '#ReplaceAllButton' : '#ReplaceButton');
  await new Promise((resolve) => setTimeout(resolve, 500));
  const after = await readFindResults(context);

  return {
    changed: true,
    operationId: randomUUID(),
    replacedCount: options?.replaceAll === true ? found.matchCount : 1,
    matchCountBefore: found.matchCount,
    matchCountAfter: after.matchCount,
    occurrence: options?.replaceAll === true ? undefined : occurrence,
    matchCase: options?.matchCase === true,
    wholeWords: options?.wholeWords === true,
  };
}

async function keyboardModifier(page) {
  return page.evaluate(() =>
    /Mac|iPhone|iPad|iPod/.test(navigator.platform) ? 'Meta' : 'Control',
  );
}

async function openNavigationPane(page) {
  const headingsTabVisible = await page
    .$eval(sel.NAVIGATION_HEADINGS_TAB, (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    })
    .catch(() => false);
  if (!headingsTabVisible) {
    await page.click(sel.WORD_EDITOR);
    const modifier = await keyboardModifier(page);
    await page.keyboard.down(modifier);
    await page.keyboard.press('f');
    await page.keyboard.up(modifier);
  }
  await page.waitForSelector(sel.NAVIGATION_HEADINGS_TAB, { visible: true, timeout: 10_000 });
}

export async function getDocumentInfo(page) {
  const state = await getDocumentState(page, { maxCharacters: 1 });
  const metadata = await page.evaluate(
    ({ titleSelector, wordCountSelector, modeSelector }) => {
      const titleElement = document.querySelector(titleSelector);
      const wordCountLabel =
        document.querySelector(wordCountSelector)?.getAttribute('aria-label') || '';
      const wordCountMatch = wordCountLabel.match(/([\d,]+)\s+words?/i);
      return {
        title: titleElement?.textContent?.trim() || null,
        wordCount: wordCountMatch ? Number(wordCountMatch[1].replace(/,/g, '')) : null,
        modeLabel: document.querySelector(modeSelector)?.getAttribute('aria-label') || null,
      };
    },
    {
      titleSelector: sel.DOCUMENT_TITLE,
      wordCountSelector: sel.WORD_COUNT,
      modeSelector: sel.MODE_SWITCHER,
    },
  );
  return { ...metadata, ...state };
}

export async function getDocumentOutline(page) {
  await openNavigationPane(page);
  await page.click(sel.NAVIGATION_HEADINGS_TAB);
  await page.waitForSelector(sel.NAVIGATION_HEADINGS_PANEL, { visible: true, timeout: 10_000 });
  await new Promise((resolve) => setTimeout(resolve, 300));
  return page.evaluate(
    (headingSelector) =>
      Array.from(document.querySelectorAll(headingSelector))
        .map((element, index) => ({
          index,
          level: Number(element.getAttribute('aria-level')) || 1,
          text: (element.textContent || '').trim(),
        }))
        .filter((heading) => heading.text),
    sel.NAVIGATION_HEADING,
  );
}

export async function navigateToHeading(page, headingText, occurrence = 1) {
  validateSearchValue(headingText, 'headingText', 1_000);
  if (!Number.isInteger(occurrence) || occurrence < 1) {
    throw new Error('occurrence must be a positive integer');
  }
  const outline = await getDocumentOutline(page);
  const matches = outline.filter((heading) => heading.text === headingText);
  if (matches.length < occurrence) {
    return { navigated: false, reason: 'heading_not_found', matches: matches.length };
  }
  const targetIndex = matches[occurrence - 1].index;
  const headings = await page.$$(sel.NAVIGATION_HEADING);
  await headings[targetIndex].click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  return { navigated: true, heading: matches[occurrence - 1] };
}

export async function readRenderedParagraphRange(page, options = {}) {
  if (options.heading !== undefined) {
    const navigation = await navigateToHeading(
      page,
      options.heading,
      options.headingOccurrence ?? 1,
    );
    if (!navigation.navigated) return { ...navigation, paragraphs: [] };
  }
  const startParagraph = options.startParagraph ?? 0;
  const useHeadingStart = options.heading !== undefined && options.startParagraph === undefined;
  const paragraphCount = options.paragraphCount ?? 50;
  if (!Number.isInteger(startParagraph) || startParagraph < 0) {
    throw new Error('startParagraph must be a non-negative integer');
  }
  if (!Number.isInteger(paragraphCount) || paragraphCount < 1 || paragraphCount > 500) {
    throw new Error('paragraphCount must be an integer between 1 and 500');
  }
  return page.evaluate(
    ({ paragraphSelector, pageSelector, start, count, heading, anchorToHeading }) => {
      const pages = Array.from(document.querySelectorAll(pageSelector));
      const all = Array.from(document.querySelectorAll(paragraphSelector))
        .map((element, index) => ({
          index,
          page: Math.max(1, pages.indexOf(element.closest(pageSelector)) + 1),
          text: (element.innerText || element.textContent || '')
            .replace(/\u200B/g, '')
            .replace(/\u00A0/g, ' ')
            .trim(),
        }))
        .filter((paragraph) => paragraph.text);
      const headingIndex = anchorToHeading
        ? all.findIndex((paragraph) => paragraph.text === heading)
        : -1;
      const effectiveStart = headingIndex >= 0 ? headingIndex : start;
      const paragraphs = all.slice(effectiveStart, effectiveStart + count);
      return {
        renderedParagraphCount: all.length,
        startParagraph: effectiveStart,
        nextParagraph: effectiveStart + paragraphs.length,
        hasMoreRendered: effectiveStart + paragraphs.length < all.length,
        paragraphs,
      };
    },
    {
      paragraphSelector: sel.RENDERED_PARAGRAPH,
      pageSelector: sel.RENDERED_PAGE,
      start: startParagraph,
      count: paragraphCount,
      heading: options.heading,
      anchorToHeading: useHeadingStart,
    },
  );
}

export async function getDocumentTextContext(page, options) {
  const found = await findDocumentText(page, options);
  if (found.matchCount === 0) return { found: false, matchCount: 0 };
  const occurrence = options?.occurrence ?? (found.matchCount === 1 ? 1 : undefined);
  if (occurrence === undefined) {
    return {
      found: false,
      reason: 'ambiguous_match',
      matchCount: found.matchCount,
      snippets: found.snippets,
    };
  }
  if (!Number.isInteger(occurrence) || occurrence < 1 || occurrence > found.matchCount) {
    return { found: false, reason: 'occurrence_out_of_range', matchCount: found.matchCount };
  }
  const snippet = found.snippets.find((item) => item.occurrence === occurrence);
  if (snippet)
    return { found: true, matchCount: found.matchCount, occurrence, context: snippet.text };
  for (let current = found.currentMatch || 1; current < occurrence; current++) {
    await page.click(sel.NEXT_FIND_RESULT);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return { found: true, matchCount: found.matchCount, occurrence, context: null };
}

export async function selectDocumentText(page, options) {
  const found = await findDocumentText(page, options);
  if (found.matchCount === 0) return { selected: false, reason: 'no_matches', matchCount: 0 };
  const occurrence = options?.occurrence ?? (found.matchCount === 1 ? 1 : undefined);
  if (occurrence === undefined) {
    return {
      selected: false,
      reason: 'ambiguous_match',
      matchCount: found.matchCount,
      snippets: found.snippets,
    };
  }
  if (!Number.isInteger(occurrence) || occurrence < 1 || occurrence > found.matchCount) {
    return { selected: false, reason: 'occurrence_out_of_range', matchCount: found.matchCount };
  }
  for (let current = found.currentMatch || 1; current < occurrence; current++) {
    await page.click(sel.NEXT_FIND_RESULT);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const resultButton = await page.$(`${sel.FIND_RESULT}[data-unique-id="${occurrence}"]`);
  if (resultButton) {
    await resultButton.click();
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  if (options?.closePane !== false) {
    const close = await page.$(sel.NAVIGATION_CLOSE);
    if (close) {
      await close.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  return { selected: true, occurrence, matchCount: found.matchCount };
}

export async function applySelectedFormatting(page, options) {
  const selected = await selectDocumentText(page, { ...options, closePane: false });
  if (!selected.selected) return selected;
  const modifier = await keyboardModifier(page);
  const shortcuts = [];
  if (options.bold === true) shortcuts.push(['b']);
  if (options.italic === true) shortcuts.push(['i']);
  if (options.underline === true) shortcuts.push(['u']);
  if (options.strikethrough === true) shortcuts.push(['Shift', 'x']);
  if (shortcuts.length === 0) throw new Error('At least one formatting option must be true');
  for (const keys of shortcuts) {
    await page.keyboard.down(modifier);
    if (keys[0] === 'Shift') {
      await page.keyboard.down('Shift');
      await page.keyboard.press(keys[1]);
      await page.keyboard.up('Shift');
    } else {
      await page.keyboard.press(keys[0]);
    }
    await page.keyboard.up(modifier);
  }
  return { ...selected, formatted: true, operationId: randomUUID() };
}

export async function listRenderedTables(page) {
  return page.evaluate(
    (tableSelector) =>
      Array.from(document.querySelectorAll(tableSelector)).map((table, index) => {
        const rows = Array.from(table.querySelectorAll('tr'));
        const cells = rows.map((row) =>
          Array.from(row.querySelectorAll('th,td,[role="cell"],[role="columnheader"]')).map(
            (cell) => (cell.innerText || cell.textContent || '').replace(/\u00A0/g, ' ').trim(),
          ),
        );
        return {
          index,
          rowCount: cells.length,
          columnCount: cells.reduce((max, row) => Math.max(max, row.length), 0),
          preview: cells.slice(0, 3),
        };
      }),
    sel.RENDERED_TABLE,
  );
}

export async function readRenderedTable(page, tableIndex) {
  if (!Number.isInteger(tableIndex) || tableIndex < 0) {
    throw new Error('tableIndex must be a non-negative integer');
  }
  return page.evaluate(
    ({ tableSelector, index }) => {
      const table = document.querySelectorAll(tableSelector)[index];
      if (!table) return null;
      const rows = Array.from(table.querySelectorAll('tr')).map((row, rowIndex) => ({
        rowIndex,
        cells: Array.from(row.querySelectorAll('th,td,[role="cell"],[role="columnheader"]')).map(
          (cell, columnIndex) => ({
            columnIndex,
            text: (cell.innerText || cell.textContent || '').replace(/\u00A0/g, ' ').trim(),
            header: cell.tagName === 'TH' || cell.getAttribute('role') === 'columnheader',
          }),
        ),
      }));
      return { index, rows };
    },
    { tableSelector: sel.RENDERED_TABLE, index: tableIndex },
  );
}

export async function listRenderedLinks(page) {
  return page.evaluate(
    (linkSelector) =>
      Array.from(document.querySelectorAll(linkSelector))
        .map((link, index) => ({
          index,
          text: (link.textContent || '').trim(),
          url: link.href || link.getAttribute('href') || '',
          title: link.getAttribute('title') || null,
        }))
        .filter((link) => link.text || link.url),
    sel.RENDERED_LINK,
  );
}

export async function addLinkToSelection(page, options) {
  let selected;
  if (options?.query) {
    selected = await selectDocumentText(page, { ...options, closePane: false });
    if (!selected.selected) return selected;
  } else {
    throw new Error('query is required to identify the text that will become a link');
  }
  const url = new URL(options.url);
  if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) {
    throw new Error('url must use http, https, or mailto');
  }
  const inserted = await page.evaluate(
    ({ editorSelector, text, href }) => {
      const editor = document.querySelector(editorSelector);
      if (!editor) return false;
      editor.focus();
      const escapedText = text.replace(
        /[&<>"']/g,
        (character) =>
          ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
          })[character],
      );
      const escapedHref = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      const data = new DataTransfer();
      data.setData('text/html', `<a href="${escapedHref}">${escapedText}</a>`);
      data.setData('text/plain', text);
      const event = new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { editorSelector: sel.EDITABLE_WORD_EDITOR, text: options.query, href: url.toString() },
  );
  if (!inserted) throw new Error('Word rejected the hyperlink paste');
  return { ...selected, linked: true, url: url.toString(), operationId: randomUUID() };
}

export async function removeLinkFromSelection(page, options) {
  const selected = await selectDocumentText(page, { ...options, closePane: false });
  if (!selected.selected) return selected;
  const removed = await page.evaluate(
    ({ editorSelector, text }) => {
      const editor = document.querySelector(editorSelector);
      if (!editor) return false;
      editor.focus();
      const data = new DataTransfer();
      data.setData('text/plain', text);
      const event = new ClipboardEvent('paste', {
        clipboardData: data,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(event);
      return event.defaultPrevented;
    },
    { editorSelector: sel.EDITABLE_WORD_EDITOR, text: options.query },
  );
  if (!removed) throw new Error('Word rejected the plain-text unlink paste');
  return { ...selected, linkRemoved: true, operationId: randomUUID() };
}

export async function listDocumentComments(page) {
  const button = await page.$(sel.COMMENTS_BUTTON);
  if (!button) return [];
  await button.click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  return page.evaluate(() => {
    const candidates = document.querySelectorAll('[role="comment"]');
    return Array.from(candidates)
      .map((element, index) => ({
        index,
        author: element.getAttribute('aria-label')?.match(/^Comment from (.*?) on /i)?.[1] || null,
        text: (element.innerText || element.textContent || '').trim().slice(0, 2_000),
      }))
      .filter((comment) => comment.text);
  });
}

export async function addCommentToSelection(page, options) {
  validateSearchValue(options?.comment, 'comment', 5_000);
  const selected = await selectDocumentText(page, { ...options, closePane: false });
  if (!selected.selected) return selected;
  const modifier = await keyboardModifier(page);
  await page.keyboard.down(modifier);
  await page.keyboard.down('Alt');
  await page.keyboard.press('m');
  await page.keyboard.up('Alt');
  await page.keyboard.up(modifier);
  const editor = await page.waitForSelector(
    '[contenteditable="true"][aria-label*="comment" i], textarea[aria-label*="comment" i]',
    { visible: true, timeout: 5_000 },
  );
  await editor.click();
  await page.keyboard.type(options.comment);
  const submit = await page.$('button[id^="sendReplyButton_"][aria-label="Comment"]');
  if (!submit) throw new Error('Word comment submit button was not found');
  await submit.click();
  return { ...selected, commented: true, operationId: randomUUID() };
}

export async function resolveDocumentComment(page, commentIndex) {
  if (!Number.isInteger(commentIndex) || commentIndex < 0) {
    throw new Error('commentIndex must be a non-negative integer');
  }
  const button = await page.$(sel.COMMENTS_BUTTON);
  if (!button) return { resolved: false, reason: 'comments_unavailable' };
  await button.click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const candidates = await page.$$('[role="comment"]');
  const candidate = candidates[commentIndex];
  if (!candidate) return { resolved: false, reason: 'comment_not_found' };
  const cardHandle = await candidate.evaluateHandle((element) =>
    element.closest('[role="treeitem"]'),
  );
  const card = cardHandle.asElement();
  const menu = await card?.$('button[aria-label="More thread actions"]');
  if (!menu) return { resolved: false, reason: 'resolve_action_unavailable' };
  await menu.click();
  await new Promise((resolve) => setTimeout(resolve, 200));
  const menuItems = await page.$$('[role="menuitem"]');
  for (const item of menuItems) {
    const text = await item.evaluate((element) => (element.textContent || '').trim());
    if (/^resolve\b/i.test(text)) {
      await item.click();
      return { resolved: true, commentIndex, operationId: randomUUID() };
    }
  }
  return { resolved: false, reason: 'resolve_action_unavailable' };
}

export async function waitForDocumentSave(page, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_STATE_TIMEOUT;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 120_000) {
    throw new Error('timeoutMs must be an integer between 1000 and 120000');
  }
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 250 || pollIntervalMs > 5_000) {
    throw new Error('pollIntervalMs must be an integer between 250 and 5000');
  }

  const deadline = Date.now() + timeoutMs;
  let previousSignature;
  let stableObservations = 0;
  let lastState;
  while (Date.now() < deadline) {
    lastState = await getDocumentState(page, {
      maxCharacters: 1,
      expectedTextPrefix: options.expectedTextPrefix,
      expectedTextSuffix: options.expectedTextSuffix,
    });
    const signature = `${lastState.pageCount}:${lastState.paragraphCount}:${lastState.textLength}`;
    stableObservations = signature === previousSignature ? stableObservations + 1 : 0;
    previousSignature = signature;

    const contentMatches =
      lastState.textPrefixMatches !== false && lastState.textSuffixMatches !== false;
    if (lastState.saveState === 'saved' && stableObservations >= 2 && contentMatches) {
      return { saved: true, stableObservations, state: lastState };
    }
    if (lastState.saveState === 'error') {
      return { saved: false, reason: 'save_error', stableObservations, state: lastState };
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  return {
    saved: false,
    reason: lastState?.saveState === 'unknown' ? 'save_state_unavailable' : 'timeout',
    stableObservations,
    state: lastState,
  };
}
