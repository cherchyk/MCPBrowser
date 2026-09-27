import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { manifest, matchesPage, getActions, getInfo } from '../../../src/plugins/word/index.js';

describe('Word Plugin — manifest', () => {
  it('has the required plugin fields', () => {
    assert.equal(manifest.name, 'word');
    assert.equal(manifest.interfaceVersion, 1);
    assert.equal(typeof manifest.version, 'string');
    assert.ok(manifest.urlPatterns.includes('word.cloud.microsoft'));
    assert.ok(manifest.urlPatterns.includes('sharepoint.com'));
    assert.ok(manifest.urlPatterns.includes('officeapps.live.com'));
  });
});

describe('Word Plugin — matchesPage', () => {
  it('prefers the live Office editor over launch and home pages', () => {
    assert.deepEqual(matchesPage('https://ppc-word-edit.officeapps.live.com/we/wordeditorframe.aspx', ''), { matched: true, confidence: 1 });
    assert.deepEqual(matchesPage('https://microsoft-my.sharepoint.com/:w:/r/document', ''), { matched: true, confidence: 0.95 });
    assert.deepEqual(matchesPage('https://word.cloud.microsoft/', ''), { matched: true, confidence: 0.7 });
    assert.deepEqual(matchesPage('https://onedrive.live.com/edit.aspx', ''), { matched: true, confidence: 0.7 });
  });

  it('matches the Word editor DOM marker', () => {
    assert.deepEqual(
      matchesPage('https://example.test', '<div id="PagesContainer"></div>'),
      { matched: true, confidence: 0.8 }
    );
  });

  it('rejects unrelated and insecure URLs', () => {
    assert.equal(matchesPage('https://example.com', '').matched, false);
    assert.equal(matchesPage('http://word.cloud.microsoft', '').matched, false);
  });
});

describe('Word Plugin — action catalog', () => {
  const actions = getActions();

  it('exposes the complete action set', () => {
    assert.deepEqual(actions.map(action => action.name), [
      'open_document',
      'read_document',
      'replace_document_text',
      'replace_document_html',
      'insert_document_text',
      'insert_document_html',
      'find_text',
      'get_document_info',
      'get_outline',
      'read_range',
      'get_text_context',
      'replace_text',
      'insert_at',
      'replace_range',
      'delete_range',
      'format_range',
      'list_tables',
      'read_table',
      'update_table_cell',
      'list_links',
      'add_link',
      'update_link',
      'remove_link',
      'list_comments',
      'add_comment',
      'resolve_comment',
      'get_state',
      'wait_for_save',
      'close_document'
    ]);
  });

  it('provides valid unique action descriptors', () => {
    assert.equal(new Set(actions.map(action => action.name)).size, actions.length);
    for (const action of actions) {
      assert.equal(typeof action.description, 'string');
      assert.ok(Array.isArray(action.params));
      assert.equal(typeof action.execute, 'function');
    }
  });

  it('does not serialize action execute functions in plugin info', () => {
    const info = getInfo();
    assert.equal(info.actions.length, actions.length);
    assert.ok(info.actions.every(action => action.execute === undefined));
  });

  it('rejects a missing HTML payload instead of falling back to text', async () => {
    const action = actions.find(candidate => candidate.name === 'replace_document_html');
    const result = await action.execute({ page: {}, params: { plainText: 'fallback' } });
    assert.equal(result.constructor.name, 'ErrorResponse');
    assert.match(result.message, /html is required/);
  });
});
