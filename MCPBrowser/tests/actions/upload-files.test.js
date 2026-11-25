import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ACTIONS } from '../../src/actions/index.js';

const action = ACTIONS.find((entry) => entry.id === 'browser_upload_files');
let directory;
let filePath;

before(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), 'mcpbrowser-upload-unit-'));
  filePath = path.join(directory, 'fixture.txt');
  await writeFile(filePath, 'local fixture');
});

after(async () => {
  if (directory) await rm(directory, { recursive: true });
});

describe('Upload file validation', () => {
  it('rejects invalid arguments before connecting to a browser', async () => {
    const valid = { url: 'https://example.com', selector: '#files', filePaths: [filePath] };
    for (const [params, message] of [
      [{}, /url is required/],
      [{ ...valid, url: 'not a URL' }, /Invalid URL/],
      [{ ...valid, url: 'file:///fixture.html' }, /hostname/],
      [{ ...valid, selector: ' ' }, /selector is required/],
      [{ ...valid, filePaths: [] }, /non-empty array/],
      [{ ...valid, filePaths: 'fixture.txt' }, /non-empty array/],
      [{ ...valid, filePaths: ['relative.txt'] }, /absolute file path/],
      [{ ...valid, filePaths: [null] }, /absolute file path/],
      [{ ...valid, filePaths: [directory] }, /Not a regular file/],
      [{ ...valid, filePaths: [filePath, path.join(directory, 'missing.txt')] }, /ENOENT/],
    ]) {
      const result = (await action.execute(params)).toMcpFormat();
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, message);
      assert.equal(result.structuredContent, undefined);
    }
  });
});
