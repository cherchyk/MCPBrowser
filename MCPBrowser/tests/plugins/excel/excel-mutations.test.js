import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { EXCEL_PLUGIN } from '../../../src/plugins/excel/index.js';
import { ErrorResponse } from '../../../src/core/responses.js';
import {
  cellInputsEqual,
  getSaveState,
  validateCellInput,
  waitForSave,
} from '../../../src/plugins/excel/mutations.js';
import * as selectors from '../../../src/plugins/excel/selectors.js';

function mockEditor({
  mode = 'Edit',
  overwrite,
  unsafeSelection = false,
  saved = true,
  sheetNames = ['Sheet1'],
  switchBlocked = false,
  insertCount = 1,
  renameBlocked = false,
  dialogTitle = 'Do you want to delete this sheet?',
  preexistingDialog = false,
  deleteDelay = 0,
  showDeleteDialog = true,
  selectionBlocked = false,
  truncateInput = false,
} = {}) {
  const cells = new Map([
    ['A1', 'old'],
    ['B1', 'neighbor'],
  ]);
  const sheetCells = new Map(sheetNames.map((name, index) => [name, index ? new Map() : cells]));
  let activeSheet = sheetNames[0];
  const tabClicks = [];
  const writes = [];
  const commands = [];
  let menuOpen = false;
  let pendingCommand;
  let renameInput;
  let dialog = null;
  let confirmations = 0;
  let address = 'A1';
  let editing = false;
  let selectedAll = false;
  let altDown = false;
  let buffer = '';
  let mouseActivated = false;
  const document = { hasFocus: () => true };
  const grid = {
    focus: () => {
      document.activeElement = grid;
    },
    contains: (node) => node === grid,
    getAttribute: (name) => (name === 'aria-activedescendant' ? 'readout' : 'true'),
    classList: { contains: () => buffer === '' },
    get innerText() {
      return buffer;
    },
  };
  const field = {
    value: 'A1',
    select: () => {},
    getAttribute: (name) =>
      name === 'aria-invalid' ? 'false' : name === 'aria-disabled' ? String(editing) : null,
    getBoundingClientRect: () => ({ x: 10, y: 20, width: 100, height: 20 }),
  };
  const formulaBar = {
    focus: () => {
      document.activeElement = formulaBar;
    },
    getAttribute: () => 'true',
    contains: (node) => node === formulaBar,
    getBoundingClientRect: () => ({ x: 200, y: 30, width: 900, height: 20 }),
    classList: { contains: () => !sheetCells.get(activeSheet).get(address) },
    get innerText() {
      return editing ? buffer : sheetCells.get(activeSheet).get(address) || '';
    },
  };
  const makeTab = (name) => {
    const tab = {
      name,
      getAttribute: (attribute) =>
        attribute === 'aria-selected' ? String(tab.name === activeSheet) : null,
      querySelector: () => ({ getAttribute: () => tab.name }),
      scrollIntoView: () => {},
      getBoundingClientRect: () => ({
        x: 10 + tabs.indexOf(tab) * 100,
        y: 500,
        width: 80,
        height: 30,
      }),
    };
    return tab;
  };
  const tabs = sheetNames.map(makeTab);
  const removeActive = () => {
    tabs.splice(
      tabs.findIndex((tab) => tab.name === activeSheet),
      1,
    );
    sheetCells.delete(activeSheet);
    activeSheet = tabs[0].name;
    dialog = null;
  };
  const primaryButton = {
    disabled: false,
    getBoundingClientRect: () => ({ x: 400, y: 300, width: 80, height: 30 }),
    click: () => {
      throw new Error('Confirmation requires trusted pointer input');
    },
  };
  const makeDialog = () => ({
    getBoundingClientRect: () => ({ x: 300, y: 200, width: 400, height: 200 }),
    getAttribute: () => 'dialog-title',
    querySelector: (selector) =>
      selector === 'button#DialogActionButton'
        ? primaryButton
        : selector === 'button#DialogCancelButton'
          ? {}
          : null,
  });
  if (preexistingDialog) dialog = makeDialog();
  const save = {
    getAttribute: () => 'Gespeichert',
    querySelector: () => (saved ? {} : null),
  };
  document.activeElement = grid;
  document.querySelector = (selector) => {
    if (selector === '#inlineRenameInput') return renameInput;
    const command = /ContextMenu-ContextMenu\.(\w+)_Enabled/.exec(selector)?.[1];
    if (command && menuOpen) {
      pendingCommand = command;
      return {
        getBoundingClientRect: () => ({ x: 40, y: 400, width: 80, height: 20 }),
        click: () => {
          throw new Error('Worksheet commands require trusted pointer input');
        },
      };
    }
    return (
      {
        [selectors.NAME_BOX]: field,
        [selectors.GRID]: grid,
        [selectors.FORMULA_BAR]: formulaBar,
        [selectors.MODE]: { getAttribute: () => mode },
        [selectors.SAVE_STATUS]: save,
      }[selector] || null
    );
  };
  document.querySelectorAll = (selector) =>
    selector.includes('dialog') ? (dialog ? [dialog] : []) : tabs;
  document.getElementById = (id) =>
    id === 'readout'
      ? {
          getAttribute: () =>
            editing
              ? 'Editing'
              : `${activeSheet} ${sheetCells.get(activeSheet).get(address) || ''} ${address} Contains Formula`,
        }
      : { textContent: dialogTitle };
  const sandbox = {
    document,
    navigator: { platform: 'Win32' },
    setTimeout,
    getComputedStyle: () => ({ visibility: 'visible' }),
    window: {
      getSelection: () => ({
        rangeCount: 1,
        anchorNode: unsafeSelection ? {} : document.activeElement,
        focusNode: document.activeElement,
        toString: () => buffer,
      }),
    },
  };
  const frame = {
    page: () => page,
    url: () => 'https://ppc-excel.officeapps.live.com/x/editor',
    evaluate: async (callback, arg) =>
      vm.runInNewContext(`(${callback.toString()})(arg)`, { ...sandbox, arg }),
    parentFrame: () => ({ parentFrame: () => null }),
    frameElement: async () => ({
      evaluate: async () => ({ x: 100, y: 200 }),
      dispose: async () => {},
    }),
  };
  const page = {
    url: () => 'https://contoso.sharepoint.com/:x:/r/book',
    frames: () => [frame],
    bringToFront: async () => {},
    evaluate: async (callback, arg) =>
      vm.runInNewContext(`(${callback.toString()})(arg)`, { ...sandbox, arg }),
    mouse: {
      move: async () => {},
      click: async (x, y, options) => {
        if (x === 750 && y === 240) {
          editing = true;
          buffer = sheetCells.get(activeSheet).get(address) || '';
          document.activeElement = formulaBar;
          return;
        }
        if (x === 180 && y === 610) {
          assert.ok(menuOpen);
          menuOpen = false;
          commands.push(pendingCommand);
          if (pendingCommand === 'InsertSheet') {
            for (let i = 0; i < insertCount; i++) {
              const name = `Sheet${tabs.length + 1}`;
              tabs.push(makeTab(name));
              sheetCells.set(name, new Map());
              activeSheet = name;
            }
          } else if (pendingCommand === 'RenameSheet') {
            renameInput = {
              value: activeSheet,
              getBoundingClientRect: () => ({ x: 10, y: 500, width: 80, height: 30 }),
              closest: () => ({ getAttribute: () => activeSheet }),
              select: () => {
                document.activeElement = renameInput;
              },
            };
          } else if (pendingCommand === 'DeleteSheet') {
            if (showDeleteDialog) dialog = makeDialog();
            else removeActive();
          } else assert.fail('Unexpected worksheet command');
          return;
        }
        if (x === 540 && y === 515) {
          assert.ok(dialog);
          confirmations++;
          if (deleteDelay) setTimeout(removeActive, deleteDelay);
          else removeActive();
          return;
        }
        if (y === 715) {
          const index = (x - 150) / 100;
          assert.ok(tabs[index]);
          if (options?.button === 'right') menuOpen = true;
          else {
            tabClicks.push(tabs[index].name);
            if (!switchBlocked) activeSheet = tabs[index].name;
          }
          return;
        }
        assert.equal(x, 160);
        assert.equal(y, 230);
        document.activeElement = field;
        mouseActivated = true;
      },
    },
    keyboard: {
      down: async (key) => {
        if (key === 'Alt') altDown = true;
      },
      up: async (key) => {
        if (key === 'Alt') altDown = false;
      },
      type: async (text) => {
        if (renameInput && document.activeElement === renameInput) renameInput.value = text;
        else if (editing) {
          buffer = selectedAll ? text : buffer + text;
          selectedAll = false;
        } else field.value = text;
      },
      sendCharacter: async (text) => {
        assert.equal(document.activeElement, formulaBar);
        assert.ok(editing);
        buffer = truncateInput ? text.slice(-2) : text;
      },
      press: async (key, options) => {
        assert.equal(options?.delay, 100, 'Native command key-down must not end immediately');
        if (key === 'a' && editing) {
          selectedAll = true;
        } else if (key === 'Enter' && altDown && editing) {
          buffer += '\n';
        } else if (key === 'Enter' && renameInput && document.activeElement === renameInput) {
          if (renameBlocked) throw new Error('Native rename refused');
          const name = renameInput.value;
          sheetCells.set(name, sheetCells.get(activeSheet));
          sheetCells.delete(activeSheet);
          tabs.find((tab) => tab.name === activeSheet).name = name;
          activeSheet = name;
          renameInput = null;
          document.activeElement = grid;
        } else if (key === 'Enter' && document.activeElement === field) {
          assert.ok(mouseActivated, 'Name Box needs a trusted mousedown');
          if (!selectionBlocked) address = field.value;
          document.activeElement = grid;
          mouseActivated = false;
        } else if (key === 'F2') {
          editing = true;
          buffer = sheetCells.get(activeSheet).get(address) || '';
        } else if (key === 'Enter' && editing) {
          writes.push({ address, input: buffer });
          sheetCells.get(activeSheet).set(address, overwrite ?? buffer);
          editing = false;
        } else if (key === 'Escape') {
          editing = false;
        } else if (key === 'Backspace') {
          buffer = '';
        }
      },
    },
  };
  return {
    page,
    frame,
    cells,
    sheetCells,
    tabClicks,
    activeSheet: () => activeSheet,
    writes,
    commands,
    names: () => tabs.map((tab) => tab.name),
    confirmations: () => confirmations,
    editing: () => editing,
  };
}

describe('Native Excel worksheet management', () => {
  const run = (editor, action, params) =>
    EXCEL_PLUGIN.getActions()
      .find((candidate) => candidate.name === action)
      .execute({ page: editor.page, params });
  it('creates, renames, navigates, and deletes only the requested worksheet through native controls', async () => {
    const editor = mockEditor();
    const created = await run(editor, 'create_worksheet', { name: "Quarter 2's results" });
    assert.equal(created.toMcpFormat().isError, false, created.message);
    assert.deepEqual(created.data, { sheet: "Quarter 2's results", created: true, saved: true });
    assert.equal(editor.activeSheet(), "Quarter 2's results");
    const renamed = await run(editor, 'rename_worksheet', {
      sheet: "Quarter 2's results",
      name: 'Renamed',
    });
    assert.equal(renamed.toMcpFormat().isError, false, renamed.message);
    assert.equal(renamed.data.previousName, "Quarter 2's results");
    const deleted = await run(editor, 'delete_worksheet', {
      sheet: 'Renamed',
      confirmDelete: true,
    });
    assert.equal(deleted.toMcpFormat().isError, false, deleted.message);
    assert.deepEqual(deleted.data, { sheet: 'Renamed', deleted: true, saved: true });
    assert.deepEqual(editor.names(), ['Sheet1']);
    assert.equal(editor.cells.get('A1'), 'old');
    assert.equal(editor.confirmations(), 1);
    assert.deepEqual(editor.commands, ['InsertSheet', 'RenameSheet', 'RenameSheet', 'DeleteSheet']);
  });
  it('rejects invalid and duplicate names before starting any worksheet command', async () => {
    const editor = mockEditor({ sheetNames: ['Sheet1', 'Existing'] });
    for (const name of [
      undefined,
      '',
      ' ',
      'x'.repeat(32),
      'a/b',
      'a\\b',
      'a:b',
      'a?b',
      'a*b',
      '[a]',
      "'a",
      "a'",
      'a\0b',
      'existing',
    ]) {
      for (const action of ['create_worksheet', 'rename_worksheet']) {
        const result = await run(editor, action, { sheet: 'Sheet1', name });
        assert.ok(result instanceof ErrorResponse, `${action}: ${String(name)}`);
      }
    }
    assert.deepEqual(editor.commands, []);
    assert.deepEqual(editor.names(), ['Sheet1', 'Existing']);
  });
  it('does not issue a command for an unchanged name, unknown sheet, or viewing mode', async () => {
    const editor = mockEditor();
    const unchanged = await run(editor, 'rename_worksheet', { sheet: 'Sheet1', name: 'Sheet1' });
    assert.equal(unchanged.data.changed, false);
    assert.ok(
      (await run(editor, 'rename_worksheet', { sheet: 'Unknown', name: 'New' })) instanceof
        ErrorResponse,
    );
    assert.deepEqual(editor.commands, []);
    const readonly = mockEditor({ mode: 'View', sheetNames: ['Sheet1', 'Sheet2'] });
    for (const action of ['create_worksheet', 'rename_worksheet', 'delete_worksheet']) {
      assert.ok(
        (await run(readonly, action, {
          name: 'New',
          sheet: 'Sheet2',
          confirmDelete: true,
        })) instanceof ErrorResponse,
      );
    }
    assert.deepEqual(readonly.commands, []);
  });
  it('requires explicit deletion confirmation and preserves the last visible sheet', async () => {
    const editor = mockEditor();
    for (const confirmDelete of [undefined, false, 'true', true]) {
      const result = await run(editor, 'delete_worksheet', { sheet: 'Sheet1', confirmDelete });
      assert.ok(result instanceof ErrorResponse);
    }
    assert.ok(
      (await run(editor, 'delete_worksheet', { sheet: 'Unknown', confirmDelete: true })) instanceof
        ErrorResponse,
    );
    assert.deepEqual(editor.names(), ['Sheet1']);
    assert.deepEqual(editor.commands, []);
  });
  it('refuses preexisting or unrecognized dialogs without accepting them', async () => {
    const preexisting = mockEditor({ sheetNames: ['Sheet1', 'Sheet2'], preexistingDialog: true });
    const blocked = await run(preexisting, 'delete_worksheet', {
      sheet: 'Sheet2',
      confirmDelete: true,
    });
    assert.match(blocked.message, /existing dialog/);
    assert.deepEqual(preexisting.commands, []);
    const unknown = mockEditor({
      sheetNames: ['Sheet1', 'Sheet2'],
      dialogTitle: 'A different confirmation',
    });
    const result = await run(unknown, 'delete_worksheet', { sheet: 'Sheet2', confirmDelete: true });
    assert.match(result.message, /not recognized/);
    assert.equal(unknown.confirmations(), 0);
    assert.deepEqual(unknown.names(), ['Sheet1', 'Sheet2']);
  });
  it('handles native deletion without a dialog and delayed removal without repeated confirmations', async () => {
    for (const options of [{ showDeleteDialog: false }, { deleteDelay: 5_100 }]) {
      const editor = mockEditor({ sheetNames: ['Sheet1', 'Sheet2'], ...options });
      const result = await run(editor, 'delete_worksheet', {
        sheet: 'Sheet2',
        confirmDelete: true,
      });
      assert.equal(result.toMcpFormat().isError, false, result.message);
      assert.deepEqual(editor.names(), ['Sheet1']);
      assert.equal(editor.confirmations(), options.showDeleteDialog === false ? 0 : 1);
      assert.deepEqual(editor.commands, ['DeleteSheet']);
    }
  });
  it('reports ambiguous creation and partial rename without reinserting or rolling back', async () => {
    const ambiguous = mockEditor({ insertCount: 2 });
    const result = await run(ambiguous, 'create_worksheet', { name: 'New' });
    assert.match(result.message, /More than one new worksheet/);
    assert.deepEqual(ambiguous.commands, ['InsertSheet']);
    const partial = mockEditor({ renameBlocked: true });
    const failed = await run(partial, 'create_worksheet', { name: 'New' });
    assert.match(failed.message, /Sheet2.*may have been created/);
    assert.deepEqual(partial.names(), ['Sheet1', 'Sheet2']);
    assert.deepEqual(partial.commands, ['InsertSheet', 'RenameSheet']);
  });
});

describe('Native Excel worksheet navigation', () => {
  const select = (editor, sheet) =>
    EXCEL_PLUGIN.getActions()
      .find((action) => action.name === 'select_worksheet')
      .execute({ page: editor.page, params: { sheet } });

  it('switches by exact name, including spaces and quotes, and can return to the first sheet', async () => {
    const editor = mockEditor({ sheetNames: ['Sheet1', "Quarter 2's results"] });
    const selected = await select(editor, "Quarter 2's results");
    assert.equal(selected.toMcpFormat().isError, false, selected.message);
    assert.equal(selected.data.sheet, "Quarter 2's results");
    assert.equal(
      selected.data.worksheets.find((sheet) => sheet.active).name,
      "Quarter 2's results",
    );
    assert.equal((await select(editor, 'Sheet1')).data.sheet, 'Sheet1');
    await select(editor, 'Sheet1');
    assert.deepEqual(editor.tabClicks, ["Quarter 2's results", 'Sheet1']);
  });

  it('does not navigate for missing or unknown names and reports a tab that fails to activate', async () => {
    const editor = mockEditor({ sheetNames: ['Sheet1', 'Sheet2'] });
    for (const name of [undefined, '', 'Not a worksheet']) {
      assert.ok((await select(editor, name)) instanceof ErrorResponse);
    }
    assert.deepEqual(editor.tabClicks, []);
    const blocked = mockEditor({ sheetNames: ['Sheet1', 'Sheet2'], switchBlocked: true });
    assert.ok((await select(blocked, 'Sheet2')) instanceof ErrorResponse);
    assert.equal(blocked.activeSheet(), 'Sheet1');
  });

  it('routes cell reads and edits to their requested worksheet without changing other sheets', async () => {
    const editor = mockEditor({ sheetNames: ['Sheet1', 'Sheet2'] });
    editor.sheetCells.get('Sheet2').set('A1', 'second worksheet');
    const read = await EXCEL_PLUGIN.getActions()
      .find((action) => action.name === 'read_cell')
      .execute({ page: editor.page, params: { sheet: 'Sheet2', cell: 'A1' } });
    assert.equal(read.data.input, 'second worksheet');
    const written = await EXCEL_PLUGIN.getActions()
      .find((action) => action.name === 'write_cell')
      .execute({
        page: editor.page,
        params: { sheet: 'Sheet1', cell: 'A1', input: 'new', expectedInput: 'old' },
      });
    assert.equal(written.toMcpFormat().isError, false, written.message);
    assert.equal(editor.cells.get('A1'), 'new');
    assert.equal(editor.sheetCells.get('Sheet2').get('A1'), 'second worksheet');
    assert.equal(editor.activeSheet(), 'Sheet1');
  });
});

describe('Native Excel cell reads', () => {
  it('does not trust a typed Name Box address when the actual cell selection has not changed', async () => {
    const editor = mockEditor({ selectionBlocked: true });
    const result = await EXCEL_PLUGIN.getActions()
      .find((action) => action.name === 'read_cell')
      .execute({ page: editor.page, params: { cell: 'B1' } });
    assert.ok(result instanceof ErrorResponse);
    assert.match(result.message, /expected B1, observed A1/);
    assert.deepEqual(editor.writes, []);
  });
  it('reads source text, formulas, and empty cells without clipboard access or submitting input', async () => {
    const editor = mockEditor();
    for (const input of ['plain text', '=SUM(1,2)', '', "'=literal"]) {
      editor.cells.set('A1', input);
      const result = await EXCEL_PLUGIN.getActions()
        .find((action) => action.name === 'read_cell')
        .execute({ page: editor.page, params: { cell: 'A1' } });
      assert.equal(result.toMcpFormat().isError, false, result.message);
      assert.deepEqual(result.data, { sheet: 'Sheet1', cell: 'A1', input });
      assert.equal(editor.editing(), false);
      assert.equal(editor.writes.length, 0);
    }
  });

  it('refuses rectangular reads and reads exposed source in viewing mode', async () => {
    for (const [mode, cell] of [
      ['Edit', 'A1:B2'],
      ['View', 'A1'],
    ]) {
      const editor = mockEditor({ mode });
      const result = await EXCEL_PLUGIN.getActions()
        .find((action) => action.name === 'read_cell')
        .execute({ page: editor.page, params: { cell } });
      if (mode === 'Edit') assert.ok(result instanceof ErrorResponse);
      else assert.equal(result.data.input, 'old');
      assert.equal(editor.writes.length, 0);
    }
  });
});

const write = (editor, params) =>
  EXCEL_PLUGIN.getActions()
    .find((action) => action.name === 'write_cell')
    .execute({
      page: editor.page,
      params: { cell: 'A1', ...params },
    });

describe('Native Excel cell mutations', () => {
  it('refuses to commit when the native editor retains only part of the requested input', async () => {
    const editor = mockEditor({ truncateInput: true });
    const result = await EXCEL_PLUGIN.getActions()
      .find((action) => action.name === 'write_cell')
      .execute({
        page: editor.page,
        params: { cell: 'A1', input: 'complete input', expectedInput: 'old' },
      });
    assert.ok(result instanceof ErrorResponse);
    assert.match(result.message, /complete requested input/);
    assert.deepEqual(editor.writes, []);
    assert.equal(editor.cells.get('A1'), 'old');
  });
  it('submits a complete multiline input as one native edit', async () => {
    const editor = mockEditor();
    const result = await EXCEL_PLUGIN.getActions()
      .find((action) => action.name === 'write_cell')
      .execute({
        page: editor.page,
        params: { cell: 'A1', input: 'first\\nsecond'.replace('\\n', '\n'), expectedInput: 'old' },
      });
    assert.equal(result.toMcpFormat().isError, false, result.message);
    assert.equal(editor.cells.get('A1'), 'first\nsecond');
    assert.equal(editor.writes.length, 1);
  });
  it('allows Excel formula case normalization without ignoring string literal changes', () => {
    assert.equal(cellInputsEqual('=sum(a1,2)', '=SUM(A1,2)'), true);
    assert.equal(cellInputsEqual('=sum("a")', '=SUM("A")'), false);
    assert.equal(cellInputsEqual('="a""b"', '="A""B"'), false);
    assert.equal(cellInputsEqual("='sheet \"name'!a1", "='SHEET \"NAME'!A1"), true);
    assert.equal(cellInputsEqual('Text', 'TEXT'), false);
  });

  it('verifies a native cell edit and save without changing neighboring cells', async () => {
    const editor = mockEditor();
    const result = await write(editor, { input: '=1+2', expectedInput: 'old' });
    assert.equal(result.toMcpFormat().isError, false, result.message);
    assert.equal(result.data.verified, true);
    assert.equal(result.data.saved, true);
    assert.equal(editor.cells.get('A1'), '=1+2');
    assert.equal(editor.cells.get('B1'), 'neighbor');
    assert.equal(editor.writes.length, 1);
  });

  it('clears only the selected cell when input is empty', async () => {
    const editor = mockEditor();
    const result = await write(editor, { input: '', expectedInput: 'old' });
    assert.equal(result.data.changed, true);
    assert.equal(editor.cells.get('A1'), '');
    assert.equal(editor.cells.get('B1'), 'neighbor');
  });

  it('does not write when the expected source is stale', async () => {
    const editor = mockEditor();
    const result = await write(editor, { input: 'new', expectedInput: 'wrong' });
    assert.ok(result instanceof ErrorResponse);
    assert.match(result.message, /expectedInput/);
    assert.equal(editor.writes.length, 0);
  });

  it('does not write when the cell editor text selection is unsafe', async () => {
    const editor = mockEditor({ unsafeSelection: true });
    const result = await write(editor, { input: 'new' });
    assert.ok(result instanceof ErrorResponse);
    assert.equal(editor.writes.length, 0);
    assert.equal(editor.cells.get('B1'), 'neighbor');
  });

  it('reports an uncertain mutation instead of silently succeeding or retrying', async () => {
    const editor = mockEditor({ overwrite: 'coauthor change' });
    const result = await write(editor, { input: 'new' });
    assert.ok(result instanceof ErrorResponse);
    assert.match(result.message, /unverified.*may have changed/);
    assert.equal(editor.writes.length, 1);
  });

  it('verifies normalized formula source and reports the actual saved input', async () => {
    const editor = mockEditor({ overwrite: '=SUM(1,2)' });
    const result = await write(editor, { input: '=sum(1,2)' });
    assert.equal(result.toMcpFormat().isError, false, result.message);
    assert.equal(result.data.input, '=SUM(1,2)');
  });

  it('rejects read-only or unknown modes before selecting or editing cells', async () => {
    for (const mode of ['View', 'unknown']) {
      const editor = mockEditor({ mode });
      const result = await write(editor, { input: 'new' });
      assert.ok(result instanceof ErrorResponse);
      assert.equal(editor.writes.length, 0);
    }
  });

  it('rejects multi-cell writes and invalid payloads', async () => {
    const editor = mockEditor();
    for (const params of [
      { cell: 'A1:B2', input: 'new' },
      { input: 1 },
      { input: 'x'.repeat(32_768) },
    ]) {
      assert.ok((await write(editor, params)) instanceof ErrorResponse);
    }
    assert.equal(editor.writes.length, 0);
    assert.equal(validateCellInput('one\r\ntwo'), 'one\ntwo');
    assert.throws(() => validateCellInput('null\0character'));
  });
});

describe('Excel save confirmation', () => {
  it('uses the saved icon independently of the user interface language', async () => {
    const editor = mockEditor();
    assert.equal(await getSaveState(editor.frame), 'saved');
    assert.equal((await waitForSave(editor.frame, 500)).saved, true);
  });

  it('fails when persistence cannot be confirmed', async () => {
    await assert.rejects(
      waitForSave(mockEditor({ saved: false }).frame, 500),
      /save could not be confirmed/,
    );
    await assert.rejects(waitForSave(mockEditor().frame, 60_001), /timeoutMs/);
  });
});
