import { after, before, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ACTIONS } from '../../src/actions/index.js';

const action = ACTIONS.find((entry) => entry.id === 'browser_download_file');
let directory;
before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'mcpbrowser-download-unit-'));
});
after(async () => {
  if (directory) await rm(directory, { recursive: true });
});

it('rejects invalid download arguments and existing destinations before clicking', async () => {
  const outputPath = path.join(directory, 'existing.txt');
  await writeFile(outputPath, 'keep');
  const valid = { url: 'https://example.com', selector: '#download', outputPath };
  for (const [params, message] of [
    [{}, /url is required/],
    [{ ...valid, url: 'invalid' }, /Invalid URL/],
    [{ ...valid, url: 'file:///fixture.html' }, /hostname/],
    [{ ...valid, selector: '' }, /selector is required/],
    [{ ...valid, outputPath: 'relative.txt' }, /absolute file path/],
    [{ ...valid, timeoutMs: 0 }, /timeoutMs/],
    [{ ...valid, timeoutMs: 120001 }, /timeoutMs/],
    [{ ...valid, timeoutMs: 1.5 }, /timeoutMs/],
    [valid, /already exists/],
    [{ ...valid, outputPath: path.join(directory, 'missing', 'file.txt') }, /ENOENT/],
  ]) {
    const result = (await action.execute(params)).toMcpFormat();
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, message);
    assert.equal(result.structuredContent, undefined);
  }
});
