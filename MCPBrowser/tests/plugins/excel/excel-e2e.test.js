import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ACTIONS } from '../../../src/actions/index.js';
import { getBrowser, closeBrowser } from '../../../src/core/browser.js';
import { loadPlugins } from '../../../src/core/plugin-loader.js';
import { resolvePluginPage } from '../../../src/core/plugin-page.js';
import { EXCEL_PLUGIN } from '../../../src/plugins/excel/index.js';

const url = process.env.EXCEL_E2E_URL;
assert.ok(url, 'Set EXCEL_E2E_URL to a dedicated, editable, empty Excel Online test workbook');
const fetchPage = ACTIONS.find((action) => action.id === 'browser_fetch_webpage');
const pluginAction = ACTIONS.find((action) => action.id === 'browser_plugin_action');
const marker = `MCPBrowserExcel${randomUUID()}`;
const attempted = new Map();
const errors = [];
const inputs = new Map([
  ['A1', marker],
  ['B1', '=1+2'],
  ['A2', '17'],
  ['B2', 'TRUE'],
  ['C1', "'=literal"],
  ['C2', '=sum(1,2)'],
]);

async function run(action, params = {}) {
  const response = await pluginAction.execute({ plugin: 'excel', action, params });
  assert.equal(response.toMcpFormat().isError, false, response.message || response.reason);
  assert.ok(response.data, `${action} must return structured Excel data`);
  return response.data;
}

try {
  await loadPlugins();
  const fetched = await fetchPage.execute({ url });
  assert.equal(fetched.toMcpFormat().isError, false, fetched.message);
  await run('open_workbook');
  for (const cell of [...inputs.keys(), 'C3']) {
    assert.equal(
      (await run('read_cell', { cell })).input,
      '',
      'The dedicated fixture must be empty',
    );
  }

  for (const [cell, input] of inputs) {
    attempted.set(cell, input);
    const result = await run('write_cell', { cell, input, expectedInput: '' });
    assert.equal(result.verified, true);
    assert.equal(result.saved, true);
    attempted.set(cell, result.input);
  }
  const stale = await pluginAction.execute({
    plugin: 'excel',
    action: 'write_cell',
    params: { cell: 'B1', input: '=2+2', expectedInput: '3' },
  });
  assert.equal(
    stale.toMcpFormat().isError,
    true,
    'Expected input must check formula source, not its result',
  );
  assert.match(stale.message, /expectedInput/);

  for (const [cell, input] of attempted) {
    assert.equal((await run('read_cell', { cell })).input, input);
  }
  assert.equal((await run('read_cell', { cell: 'C3' })).input, '');
  const page = await resolvePluginPage(await getBrowser(), EXCEL_PLUGIN);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
  for (const [cell, input] of attempted) {
    assert.equal(
      (await run('read_cell', { cell })).input,
      input,
      'Saved cell input must survive a workbook reload',
    );
  }
  console.log(
    'PASS: native cell reads, text, number, boolean, formula, precondition, and reload checks',
  );
} catch (error) {
  errors.push(error);
} finally {
  for (const [cell, expectedInput] of [...attempted].reverse()) {
    try {
      await run('write_cell', { cell, input: '', expectedInput });
    } catch (error) {
      errors.push(
        new Error(`Could not safely clear test cell ${cell}: ${error.message}`, { cause: error }),
      );
    }
  }
  if (attempted.size && !errors.length) {
    try {
      for (const cell of [...inputs.keys(), 'C3']) {
        assert.equal((await run('read_cell', { cell })).input, '');
      }
      await run('wait_for_save');
      console.log('PASS: test cells are cleared and saved; the test workbook remains in place');
    } catch (error) {
      errors.push(error);
    }
  }
  await closeBrowser();
}
if (errors.length) throw new AggregateError(errors, 'Excel native E2E failed');
