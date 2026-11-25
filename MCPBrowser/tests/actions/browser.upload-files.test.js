import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ACTIONS } from '../../src/actions/index.js';
import { domainPages, getBrowser } from '../../src/core/browser.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';
import { startHttpTestServer } from '../browsers/http-test-server.js';

const uploadFiles = ACTIONS.find((action) => action.id === 'browser_upload_files').execute;
const directory = await mkdtemp(path.join(os.tmpdir(), 'mcpbrowser-upload-browser-'));
const firstPath = path.join(directory, 'first file.txt');
const secondPath = path.join(directory, 'second.bin');
const firstContent = 'Local upload fixture';
const secondContent = Buffer.from([0, 1, 2, 128, 255]);
let receivedBody;
let browserRuns = 0;
let testsPassed = 0;
const server = await startHttpTestServer(async (request, response) => {
  if (request.method === 'POST' && request.url === '/upload') {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    receivedBody = Buffer.concat(chunks);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{"received":true}');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(
    '<!doctype html><html><body><form><input id="single" name="single" type="file"><input id="multiple" name="files" type="file" multiple style="display:none"><input id="text"><input id="disabled" type="file" disabled><fieldset disabled><input id="fieldset" type="file"></fieldset><input id="directory" type="file" webkitdirectory></form><script>window.fileEvents=[];document.addEventListener("input",e=>fileEvents.push({type:e.type,id:e.target.id}));document.addEventListener("change",e=>fileEvents.push({type:e.type,id:e.target.id}));</script></body></html>',
  );
});

try {
  await writeFile(firstPath, firstContent);
  await writeFile(secondPath, secondContent);
  await runWithBrowsers(async (browserType) => {
    browserRuns++;
    const browser = await getBrowser(browserType);
    const page = await browser.newPage();
    const url = `${server.origin}/form`;
    const hostname = new URL(url).hostname;
    const previousPage = domainPages.get(hostname);
    try {
      await page.goto(url);
      domainPages.set(hostname, page);
      const params = { url, selector: '#single', filePaths: [firstPath] };

      const wsEndpoint = browser.wsEndpoint;
      try {
        browser.wsEndpoint = () => 'ws://remote-browser.invalid/devtools/browser/fixture';
        const remote = (await uploadFiles(params)).toMcpFormat();
        assert.equal(remote.isError, true);
        assert.match(remote.content[0].text, /local browser connection/);
        assert.equal(await page.$eval('#single', (el) => el.files.length), 0);
      } finally {
        browser.wsEndpoint = wsEndpoint;
      }
      testsPassed++;

      const result = (await uploadFiles(params)).toMcpFormat();
      assert.equal(result.isError, false);
      assert.equal(result.structuredContent.status, 'selected');
      assert.deepEqual(result.structuredContent.files, [
        { name: path.basename(firstPath), size: Buffer.byteLength(firstContent) },
      ]);
      assert.match(result.structuredContent.message, /completion have not been verified/);
      assert.equal(JSON.stringify(result).includes(firstContent), false);
      assert.deepEqual(
        await page.$eval('#single', (el) => Array.from(el.files, (file) => file.name)),
        [path.basename(firstPath)],
      );
      assert.deepEqual(await page.evaluate(() => window.fileEvents), [
        { type: 'input', id: 'single' },
        { type: 'change', id: 'single' },
      ]);
      testsPassed++;

      const multiple = (
        await uploadFiles({
          ...params,
          selector: '#multiple',
          filePaths: [firstPath, secondPath],
        })
      ).toMcpFormat();
      assert.equal(multiple.isError, false);
      assert.deepEqual(multiple.structuredContent.files, [
        { name: path.basename(firstPath), size: Buffer.byteLength(firstContent) },
        { name: path.basename(secondPath), size: secondContent.length },
      ]);
      assert.deepEqual(
        await page.$eval('#multiple', (el) => Array.from(el.files, (file) => file.name)),
        [path.basename(firstPath), path.basename(secondPath)],
      );
      testsPassed++;

      assert.equal(
        await page.evaluate(async () => {
          const body = new FormData();
          for (const file of document.querySelector('#multiple').files) {
            body.append('files', file);
          }
          return (await (await fetch('/upload', { method: 'POST', body })).json()).received;
        }),
        true,
      );
      assert.ok(receivedBody.includes(Buffer.from(firstContent)));
      assert.ok(receivedBody.includes(secondContent));
      assert.ok(receivedBody.includes(Buffer.from('filename="first file.txt"')));
      assert.ok(receivedBody.includes(Buffer.from('filename="second.bin"')));
      testsPassed++;

      for (const [overrides, message] of [
        [{ selector: '#text' }, /input\[type="file"\]/],
        [{ selector: '#disabled' }, /disabled/],
        [{ selector: '#fieldset' }, /disabled/],
        [{ selector: '#directory' }, /Directory uploads are not supported/],
        [{ filePaths: [firstPath, secondPath] }, /does not allow multiple/],
        [{ filePaths: [firstPath, path.join(directory, 'missing.txt')] }, /ENOENT/],
        [{ selector: '#missing' }, /selector.*failed|Waiting failed/i],
      ]) {
        const failure = (await uploadFiles({ ...params, ...overrides })).toMcpFormat();
        assert.equal(failure.isError, true);
        assert.match(failure.content[0].text, message);
      }
      assert.deepEqual(
        await page.$eval('#single', (el) => Array.from(el.files, (file) => file.name)),
        [path.basename(firstPath)],
      );
      testsPassed++;

      domainPages.delete(hostname);
      const unloaded = (await uploadFiles(params)).toMcpFormat();
      assert.equal(unloaded.structuredContent, undefined);
      assert.match(unloaded.content[0].text, /No open page found/);
      testsPassed++;
    } finally {
      if (previousPage) domainPages.set(hostname, previousPage);
      else domainPages.delete(hostname);
      await page.close();
    }
  }, process.argv[2] || '');
  assert.ok(browserRuns > 0, 'At least one real browser must execute the upload tests');
  console.log(`Tests Passed: ${testsPassed}`);
} finally {
  await server.close();
  await rm(directory, { recursive: true });
}
