import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_HTML_BYTES,
  MAX_READ_CHARACTERS,
  MAX_TEXT_CHARACTERS,
  isAllowedWordUrl,
  isAuthenticationUrl,
  isOfficeEditorHost,
  isSharePointHost,
  validateMutationPayload,
  validateReadLimit,
  validateReadOffset,
  validateSearchValue
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
    assert.equal(isAuthenticationUrl('https://login.microsoftonline.com/common/oauth2/authorize'), true);
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
    assert.doesNotThrow(() => validateMutationPayload({
      html: '<p>Hello</p>',
      plainText: 'Hello'
    }));
    assert.doesNotThrow(() => validateMutationPayload({ plainText: 'Hello' }));
  });

  it('rejects invalid or oversized mutation payloads', () => {
    assert.throws(() => validateMutationPayload({ plainText: undefined }), /plainText/);
    assert.throws(
      () => validateMutationPayload({ plainText: 'x'.repeat(MAX_TEXT_CHARACTERS + 1) }),
      /character limit/
    );
    assert.throws(
      () => validateMutationPayload({ html: 'x'.repeat(MAX_HTML_BYTES + 1), plainText: '' }),
      /byte limit/
    );
  });

  it('validates bounded surgical search values', () => {
    assert.equal(validateSearchValue('needle', 'query', 10), 'needle');
    assert.throws(() => validateSearchValue('', 'query', 10), /non-empty/);
    assert.throws(() => validateSearchValue('too long', 'query', 3), /character limit/);
  });
});
