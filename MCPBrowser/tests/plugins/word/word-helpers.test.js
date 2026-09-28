import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HTML_BYTES,
  MAX_READ_CHARACTERS,
  MAX_TEXT_CHARACTERS,
  ensureWordEditor,
  getDocumentState,
  isAllowedWordUrl,
  isAuthenticationUrl,
  isOfficeEditorHost,
  isSharePointHost,
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

  it('finds and waits for a Word surface in a SharePoint WOPI frame', async () => {
    const parent = frame(
      'https://contoso.sharepoint.com/sites/docs/Doc.aspx?id=1',
      async () => null,
    );
    let inspections = 0;
    const word = frame(
      'https://contoso-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
      async (_fn, argument) => {
        assert.equal(argument, '#PagesContainer');
        if (inspections++ === 0) return null;
        return { editable: true, visible: true };
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
    let clicked = false;
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
      click: async (selector) => {
        assert.equal(selector, '#PagesContainer[contenteditable="true"]');
        clicked = true;
      },
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

    assert.equal(clicked, true);
    assert.equal(calls, 2);
    assert.equal(result.accepted, true);
    assert.equal(result.format, 'text');
    assert.match(result.operationId, /^[0-9a-f-]{36}$/);
  });
});
