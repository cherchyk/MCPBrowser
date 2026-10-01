import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HTML_BYTES,
  MAX_READ_CHARACTERS,
  MAX_TEXT_CHARACTERS,
  addLinkToSelection,
  ensureWordEditor,
  getDocumentInfo,
  getDocumentOutline,
  getDocumentState,
  getDocumentTextContext,
  isAllowedWordUrl,
  isAuthenticationUrl,
  isOfficeEditorHost,
  isSharePointHost,
  listDocumentComments,
  listRenderedLinks,
  listRenderedTables,
  readRenderedParagraphRange,
  updateDocumentContent,
  validateMutationPayload,
  validateReadLimit,
  validateReadOffset,
  validateSearchValue,
} from '../../../src/plugins/word/helpers.js';

describe('Word helpers — URL validation', () => {
  it('allows supported HTTPS hosts', () => {
    assert.equal(isAllowedWordUrl('https://word.cloud.microsoft/'), true);
    assert.equal(isAllowedWordUrl('https://contoso.sharepoint.com/sites/a/file.docx'), true);
    assert.equal(isAllowedWordUrl('https://word-edit.officeapps.live.com/we/editor'), true);
    assert.equal(isAllowedWordUrl('https://onedrive.live.com/edit.aspx'), true);
  });

  it('rejects insecure, lookalike, and malformed URLs', () => {
    assert.equal(isAllowedWordUrl('http://word.cloud.microsoft/'), false);
    assert.equal(isAllowedWordUrl('https://sharepoint.com.evil.test/file.docx'), false);
    assert.equal(isAllowedWordUrl('https://officeapps.live.com.evil.test/editor'), false);
    assert.equal(isAllowedWordUrl('not a url'), false);
  });

  it('classifies SharePoint, Office editor, and authentication hosts', () => {
    assert.equal(isSharePointHost('tenant.sharepoint.com'), true);
    assert.equal(isOfficeEditorHost('ring-word-edit.officeapps.live.com'), true);
    assert.equal(
      isAuthenticationUrl('https://login.microsoftonline.com/common/oauth2/authorize'),
      true,
    );
    assert.equal(isAuthenticationUrl('https://word.cloud.microsoft/'), false);
  });
});

describe('Word helpers — input limits', () => {
  it('uses and validates read limits', () => {
    assert.equal(validateReadLimit(undefined), 20_000);
    assert.equal(validateReadLimit(MAX_READ_CHARACTERS), MAX_READ_CHARACTERS);
    assert.throws(() => validateReadLimit(0), /maxCharacters/);
    assert.throws(() => validateReadLimit(MAX_READ_CHARACTERS + 1), /maxCharacters/);
    assert.throws(() => validateReadLimit(1.5), /maxCharacters/);
  });

  it('uses and validates chunk offsets', () => {
    assert.equal(validateReadOffset(undefined), 0);
    assert.equal(validateReadOffset(42), 42);
    assert.throws(() => validateReadOffset(-1), /offset/);
    assert.throws(() => validateReadOffset(1.5), /offset/);
  });

  it('accepts bounded mutation payloads', () => {
    assert.doesNotThrow(() =>
      validateMutationPayload({
        html: '<p>Hello</p>',
        plainText: 'Hello',
      }),
    );
    assert.doesNotThrow(() => validateMutationPayload({ plainText: 'Hello' }));
  });

  it('rejects invalid or oversized mutation payloads', () => {
    assert.throws(() => validateMutationPayload({ plainText: undefined }), /plainText/);
    assert.throws(
      () => validateMutationPayload({ plainText: 'x'.repeat(MAX_TEXT_CHARACTERS + 1) }),
      /character limit/,
    );
    assert.throws(
      () => validateMutationPayload({ html: 'x'.repeat(MAX_HTML_BYTES + 1), plainText: '' }),
      /byte limit/,
    );
  });

  it('validates bounded surgical search values', () => {
    assert.equal(validateSearchValue('needle', 'query', 10), 'needle');
    assert.throws(() => validateSearchValue('', 'query', 10), /non-empty/);
    assert.throws(() => validateSearchValue('too long', 'query', 3), /character limit/);
  });
});

describe('Word helpers — embedded editor context', () => {
  function frame(url, evaluate) {
    return { url: () => url, evaluate };
  }

  function embeddedWordPage(word) {
    const parent = frame(
      'https://contoso.sharepoint.com/sites/docs/Doc.aspx?id=1',
      async () => null,
    );
    const rejectParentDom = async () =>
      assert.fail('the SharePoint parent must not receive Word DOM operations');
    return {
      url: parent.url,
      frames: () => [parent, word],
      evaluate: rejectParentDom,
      $: rejectParentDom,
      $$: rejectParentDom,
      $eval: rejectParentDom,
      click: rejectParentDom,
      waitForSelector: rejectParentDom,
      keyboard: {
        down: async () => {},
        press: async () => {},
        type: async () => {},
        up: async () => {},
      },
    };
  }

  it('finds and waits for a Word surface in a SharePoint WOPI frame', async () => {
    const parent = frame(
      'https://contoso.sharepoint.com/sites/docs/Doc.aspx?id=1',
      async () => null,
    );
    let inspections = 0;
    const word = frame(
      'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
      async (_fn, argument) => {
        if (typeof argument === 'string') {
          if (inspections++ === 0) return null;
          return { editable: true, visible: true };
        }
        return {
          editorFound: true,
          mode: 'edit',
          pageCount: 1,
          paragraphCount: 1,
          textLength: 5,
          wordCount: 1,
          wordCountState: 'ready',
          saveState: 'saved',
        };
      },
    );
    const page = {
      url: parent.url,
      frames: () => [parent, word],
      evaluate: async () => assert.fail('the SharePoint parent must not be used as the editor'),
      $: async () => assert.fail('DOM handles must not cross frame execution worlds'),
      waitForSelector: async () => assert.fail('selector handles must not cross worlds'),
    };

    assert.deepEqual(await ensureWordEditor(page), { status: 'ready', mode: 'edit' });
  });

  it('reads document state in the frame that owns the editor without passing handles', async () => {
    const parent = frame(
      'https://contoso.sharepoint.com/sites/docs/Doc.aspx?id=1',
      async () => null,
    );
    let calls = 0;
    const word = frame(
      'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
      async (_fn, argument) => {
        calls++;
        if (typeof argument === 'string') {
          return { editable: false, visible: true };
        }
        assert.equal(Object.getPrototypeOf(argument), Object.prototype);
        assert.equal('asElement' in argument, false);
        return {
          editorFound: true,
          mode: 'view',
          pageCount: 1,
          paragraphCount: 1,
          textLength: 5,
          saveState: 'saved',
          text: 'Hello',
          offset: 0,
          nextOffset: 5,
          hasMore: false,
          truncated: false,
        };
      },
    );
    const page = {
      frames: () => [parent, word],
      evaluate: async () =>
        assert.fail('document state must be evaluated in the Word frame execution world'),
    };

    const state = await getDocumentState(page, { includeText: true, maxCharacters: 100 });

    assert.equal(calls, 2);
    assert.equal(state.text, 'Hello');
    assert.equal(state.editorFound, true);
  });

  it('updates document content in the frame that owns the editor', async () => {
    const parent = frame(
      'https://contoso.sharepoint.com/sites/docs/Doc.aspx?id=1',
      async () => null,
    );
    let calls = 0;
    const word = {
      ...frame(
        'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
        async (_fn, argument) => {
          calls++;
          if (typeof argument === 'string') {
            return { editable: true, visible: true };
          }
          assert.equal(Object.getPrototypeOf(argument), Object.prototype);
          assert.equal(argument.selector, '#PagesContainer[contenteditable="true"]');
          assert.equal(argument.text, 'Hello');
          return {
            accepted: true,
            format: 'text',
            placement: 'replace',
          };
        },
      ),
    };
    const page = {
      frames: () => [parent, word],
      click: async () => assert.fail('the SharePoint parent must not receive the editor click'),
      evaluate: async () =>
        assert.fail('the SharePoint parent must not execute the document update'),
    };

    const result = await updateDocumentContent(page, {
      plainText: 'Hello',
      placement: 'replace',
    });

    assert.equal(calls, 3);
    assert.equal(result.accepted, true);
    assert.equal(result.format, 'text');
    assert.match(result.operationId, /^[0-9a-f-]{36}$/);
  });

  it('opens and reads the outline entirely inside the Office editor frame', async () => {
    const clicks = [];
    const waits = [];
    const word = {
      ...frame(
        'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
        async (_fn, argument) => {
          if (argument === '#PagesContainer') return { editable: true, visible: true };
          if (argument === '#ToggleTotalPageCount') return true;
          assert.equal(argument, '[data-automation-id="navigationPaneHeadingButton"]');
          return [{ index: 0, level: 1, text: 'Introduction' }];
        },
      ),
      $eval: async () => {
        throw new Error('navigation pane is closed');
      },
      click: async (selector) => clicks.push(selector),
      waitForSelector: async (selector) => waits.push(selector),
    };
    const page = embeddedWordPage(word);

    const outline = await getDocumentOutline(page);

    assert.deepEqual(outline, [{ index: 0, level: 1, text: 'Introduction' }]);
    assert.deepEqual(clicks, ['#navigationTab1']);
    assert.deepEqual(waits, ['#navigationTab1', '#navigationTab1-panel']);
  });

  it('retains one editor-frame affinity for document info and rendered range reads', async () => {
    let frameCalls = 0;
    const word = frame(
      'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
      async (_fn, argument) => {
        frameCalls++;
        if (argument === '#PagesContainer') return { editable: true, visible: true };
        if (argument?.selector === '#PagesContainer') {
          return {
            editorFound: true,
            mode: 'edit',
            pageCount: 2,
            paragraphCount: 3,
            textLength: 20,
            saveState: 'saved',
          };
        }
        if (argument?.titleSelector) {
          return { title: 'Frame document', wordCount: 3, modeLabel: 'Editing' };
        }
        assert.equal(argument.paragraphSelector, '.ParagraphTextContent');
        return {
          renderedParagraphCount: 3,
          startParagraph: 1,
          nextParagraph: 2,
          hasMoreRendered: true,
          paragraphs: [{ index: 1, page: 1, text: 'Second' }],
        };
      },
    );
    const decoy = frame(
      'https://other-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
      async () => assert.fail('frame affinity must not switch to another Word editor'),
    );
    let reversed = false;
    const page = embeddedWordPage(word);
    page.frames = () => {
      const parent = frame(
        'https://contoso.sharepoint.com/sites/docs/Doc.aspx?id=1',
        async () => null,
      );
      return reversed ? [parent, decoy, word] : [parent, word, decoy];
    };

    const info = await getDocumentInfo(page);
    reversed = true;
    const range = await readRenderedParagraphRange(page, {
      startParagraph: 1,
      paragraphCount: 1,
    });

    assert.equal(info.title, 'Frame document');
    assert.equal(info.editorFound, true);
    assert.equal(range.paragraphs[0].text, 'Second');
    assert.ok(frameCalls >= 6);
  });

  it('selects find results in the editor frame while keeping keyboard input on the page', async () => {
    const clicks = [];
    const elementHandle = (label) => ({
      click: async () => clicks.push(label),
      evaluate: async (fn) =>
        fn({
          textContent: label,
          getAttribute: (name) => (name === 'aria-checked' ? 'false' : null),
        }),
    });
    const word = {
      ...frame(
        'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
        async (fn, argument) => {
          if (argument === '#PagesContainer') return { editable: true, visible: true };
          if (argument?.editorSelector === '#PagesContainer[contenteditable="true"]') return true;
          if (fn.toString().includes('navigator.platform')) return 'Control';
          return {
            ready: true,
            currentMatch: 1,
            matchCount: 2,
            snippets: [],
          };
        },
      ),
      $eval: async () => true,
      $$: async (selector) => {
        assert.equal(selector, '[role="menuitemcheckbox"]');
        return [elementHandle('Match case'), elementHandle('Whole words only')];
      },
      $: async (selector) => elementHandle(selector),
      click: async (selector) => clicks.push(selector),
      waitForSelector: async () => {},
    };
    const page = embeddedWordPage(word);

    const textContext = await getDocumentTextContext(page, {
      query: 'needle',
      occurrence: 2,
    });
    const link = await addLinkToSelection(page, {
      query: 'needle',
      occurrence: 2,
      url: 'https://example.test',
    });

    assert.equal(textContext.found, true);
    assert.equal(link.selected, true);
    assert.equal(link.linked, true);
    assert.equal(clicks.filter((selector) => selector === '#NextSearchResult').length, 2);
    assert.ok(clicks.includes('[data-automation-type="SearchResult"][data-unique-id="2"]'));
  });

  it('reads tables, links, and comments from the editor frame', async () => {
    let commentsOpened = false;
    const word = {
      ...frame(
        'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
        async (_fn, argument) => {
          if (argument === '#PagesContainer') return { editable: true, visible: true };
          if (argument === '#PagesContainer table, #PagesContainer [role="table"]') {
            return [{ index: 0, rowCount: 1, columnCount: 1, preview: [['Cell']] }];
          }
          if (argument === '#PagesContainer a.Hyperlink, #PagesContainer a[href]') {
            return [{ index: 0, text: 'Link', url: 'https://example.test', title: null }];
          }
          return [{ index: 0, author: 'Ada', text: 'Review this.' }];
        },
      ),
      $: async (selector) => {
        assert.equal(selector, '#ShowCommentsTopBar');
        return { click: async () => (commentsOpened = true) };
      },
    };
    const page = embeddedWordPage(word);

    const tables = await listRenderedTables(page);
    const links = await listRenderedLinks(page);
    const comments = await listDocumentComments(page);

    assert.equal(tables[0].preview[0][0], 'Cell');
    assert.equal(links[0].text, 'Link');
    assert.equal(comments[0].author, 'Ada');
    assert.equal(commentsOpened, true);
  });
});
