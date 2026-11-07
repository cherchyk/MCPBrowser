import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as pluginModule from '../../../src/plugins/excel/index.js';
import {
  findExcelEditor,
  isAllowedExcelUrl,
  parseRange,
} from '../../../src/plugins/excel/helpers.js';
import { PLUGINS } from '../../../src/plugins/index.js';
import { detectPlugins, loadPlugins } from '../../../src/core/plugin-loader.js';
import { ErrorResponse, InformationalResponse } from '../../../src/core/responses.js';

const { EXCEL_PLUGIN } = pluginModule;
const action = (name) => EXCEL_PLUGIN.getActions().find((candidate) => candidate.name === name);

describe('Excel plugin contract and detection', () => {
  it('exports and registers only its CorePlugin descriptor', () => {
    assert.deepEqual(Object.keys(pluginModule), ['EXCEL_PLUGIN']);
    assert.ok(PLUGINS.includes(EXCEL_PLUGIN));
    assert.equal(EXCEL_PLUGIN.manifest.interfaceVersion, 2);
    assert.deepEqual(
      EXCEL_PLUGIN.getActions().map((candidate) => candidate.name),
      [
        'open_workbook',
        'list_worksheets',
        'select_worksheet',
        'create_worksheet',
        'rename_worksheet',
        'delete_worksheet',
        'read_cell',
        'write_cell',
        'wait_for_save',
      ],
    );
    assert.ok(EXCEL_PLUGIN.getInfo().actions.every((candidate) => candidate.execute === undefined));
  });

  it('detects Excel rather than Word for specific workbook URLs', async () => {
    await loadPlugins();
    for (const url of [
      'https://excel.cloud.microsoft/',
      'https://contoso.sharepoint.com/:x:/r/book',
      'https://contoso.sharepoint.com/doc2.aspx?file=Book.xlsx',
      'https://ppc-excel.officeapps.live.com/x/_layouts/xlviewerinternal.aspx',
    ]) {
      assert.equal(detectPlugins(url, '')[0].pluginName, 'excel', url);
      assert.equal(
        detectPlugins(url, '').some((item) => item.pluginName === 'word'),
        false,
      );
    }
  });

  it('does not claim Word editors, external pages, or insecure URLs', () => {
    for (const url of [
      'https://ppc-word-edit.officeapps.live.com/we/wordeditorframe.aspx',
      'https://contoso.sharepoint.com/:w:/r/book',
      'https://contoso.sharepoint.com/doc2.aspx?file=Book.docx',
      'https://officeapps.live.com.attacker.test/x/',
      'http://excel.cloud.microsoft/',
      'https://example.test',
    ]) {
      assert.equal(EXCEL_PLUGIN.matchesPage(url, '').matched, false, url);
    }
  });

  it('limits navigation to approved HTTPS origins', () => {
    assert.equal(isAllowedExcelUrl('https://contoso.sharepoint.com/doc2.aspx'), true);
    assert.equal(isAllowedExcelUrl('https://onedrive.live.com/edit.aspx'), true);
    assert.equal(isAllowedExcelUrl('https://sharepoint.com.attacker.test/book.xlsx'), false);
    assert.equal(isAllowedExcelUrl('file:///book.xlsx'), false);
  });

  it('never inspects add-in frames or requires a global Excel runtime', async () => {
    const frame = {
      url: () => 'https://ppc-excel.officeapps.live.com/x/editor',
      evaluate: async () => ({ visible: true, mode: 'Edit' }),
    };
    const editor = await findExcelEditor({
      frames: () => [
        {
          url: () => 'https://addin.resources.office.net/taskpane.html',
          evaluate: () => {
            throw new Error('Add-in frames must not be inspected');
          },
        },
        frame,
      ],
    });
    assert.strictEqual(editor.frame, frame);
  });

  it('surfaces sign-in and input errors through standard responses', async () => {
    const signIn = await action('open_workbook').execute({
      page: { url: () => 'https://login.microsoftonline.com/auth' },
      params: {},
    });
    assert.ok(signIn instanceof InformationalResponse);
    const invalid = await action('read_cell').execute({ page: {}, params: { cell: 'A:A' } });
    assert.ok(invalid instanceof ErrorResponse);
    assert.equal(invalid.toMcpFormat().isError, true);
  });

  it('rejects overlaps until the active action settles', async () => {
    let finish;
    const pending = action('open_workbook').execute({
      page: {
        url: () => 'https://excel.cloud.microsoft/',
        goto: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      },
      params: { url: 'https://contoso.sharepoint.com/:x:/r/book' },
    });
    const busy = await action('list_worksheets').execute({ page: {}, params: {} });
    assert.ok(busy instanceof ErrorResponse);
    assert.match(busy.message, /busy/);
    finish();
    assert.ok((await pending) instanceof ErrorResponse);
  });
});

describe('Excel A1 ranges', () => {
  it('normalizes bounded ranges and absolute cell references', () => {
    assert.deepEqual(parseRange('$b$2:$D$4'), {
      address: 'B2:D4',
      rowCount: 3,
      columnCount: 3,
    });
    assert.equal(parseRange('A1:A1').address, 'A1');
    assert.equal(parseRange('XFD1048576').address, 'XFD1048576');
    assert.equal(parseRange('A1:CV100').rowCount, 100);
  });

  it('rejects invalid, ambiguous, reversed, out-of-bounds, or oversized references', () => {
    for (const value of [
      undefined,
      '',
      'A0',
      'A:A',
      '1:1',
      'Sheet1!A1',
      'A1,B2',
      'B2:A1',
      'XFE1',
      'A1048577',
      'A1:CV101',
    ]) {
      assert.throws(() => parseRange(value), undefined, String(value));
    }
  });
});
