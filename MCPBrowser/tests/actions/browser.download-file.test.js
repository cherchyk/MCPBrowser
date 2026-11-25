import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { ACTIONS } from '../../src/actions/index.js';
import { domainPages, getBrowser, GetBrowser, closeBrowser } from '../../src/core/browser.js';
import { startHttpTestServer } from '../browsers/http-test-server.js';

const downloadFile = ACTIONS.find((action) => action.id === 'browser_download_file').execute;
const directory = await mkdtemp(path.join(os.tmpdir(), 'mcpbrowser-download-browser-'));
const content = Buffer.from([0, 1, 128, 255, 42]);
let onSlowRequest;
let onRaceRequest;
let runs = 0;
let testsPassed = 0;
const server = await startHttpTestServer(async (request, response) => {
  if (['/file', '/slow', '/race'].includes(request.url)) {
    response.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="server-name.bin"',
      'Content-Length': request.url === '/slow' ? 1000000 : content.length,
    });
    response.write(request.url === '/slow' ? Buffer.alloc(65536) : content);
    if (request.url === '/slow') onSlowRequest?.();
    else {
      if (request.url === '/race') await onRaceRequest();
      response.end();
    }
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html' });
  response.end(
    '<!doctype html><html><body><a id="download" href="/file">Download</a><a id="slow" href="/slow">Slow</a><a id="race" href="/race">Race</a><button id="nothing">Nothing</button><button id="blob" onclick="const a=document.createElement(\'a\');a.href=window.URL.createObjectURL(new Blob([\'blob fixture\']));a.download=\'blob.txt\';a.click()">Blob</button></body></html>',
  );
});

const browserType = process.argv[2] || 'chrome';
const implementation = await GetBrowser(browserType);
const originalEndpoint = implementation.config.wsEndpoint;
const isolatedBrowser = await puppeteer.launch({
  executablePath: implementation.findExecutablePath(),
  headless: true,
  userDataDir: path.join(directory, 'browser-profile'),
});
implementation.config.wsEndpoint = isolatedBrowser.wsEndpoint();
try {
  await (async () => {
    runs++;
    const browser = await getBrowser(browserType);
    let context = browser.defaultBrowserContext();
    let page = await context.newPage();
    const url = `${server.origin}/form`;
    const hostname = new URL(url).hostname;
    const previousPage = domainPages.get(hostname);
    const output = (name) => path.join(directory, `${browserType}-${name}`);
    const params = { url, selector: '#download', outputPath: output('file.bin'), timeoutMs: 5000 };
    async function resetPage() {
      if (context.id) await context.close();
      else await page.close();
      context = await browser.createBrowserContext();
      page = await context.newPage();
      await page.goto(url);
      domainPages.set(hostname, page);
    }
    try {
      await page.goto(url);
      domainPages.set(hostname, page);
      const result = (await downloadFile(params)).toMcpFormat();
      assert.equal(result.isError, false, JSON.stringify(result));
      assert.equal(result.structuredContent.status, 'completed');
      assert.equal(result.structuredContent.outputPath, params.outputPath);
      assert.equal(result.structuredContent.size, content.length);
      assert.equal(result.structuredContent.suggestedFilename, 'server-name.bin');
      assert.deepEqual(result.structuredContent.warnings, []);
      assert.deepEqual(await readFile(params.outputPath), content);
      testsPassed++;

      const blobPath = output('blob.txt');
      await resetPage();
      const blob = (
        await downloadFile({ ...params, selector: '#blob', outputPath: blobPath })
      ).toMcpFormat();
      assert.equal(blob.isError, false, JSON.stringify(blob));
      assert.equal(await readFile(blobPath, 'utf8'), 'blob fixture');
      testsPassed++;

      const exists = (await downloadFile(params)).toMcpFormat();
      assert.equal(exists.isError, true);
      assert.match(exists.content[0].text, /already exists/);
      assert.deepEqual(await readFile(params.outputPath), content);
      testsPassed++;

      const noDownloadPath = output('nothing.bin');
      const noDownload = (
        await downloadFile({
          ...params,
          selector: '#nothing',
          outputPath: noDownloadPath,
          timeoutMs: 200,
        })
      ).toMcpFormat();
      assert.equal(noDownload.isError, true);
      assert.match(noDownload.content[0].text, /timed out/);
      await assert.rejects(access(noDownloadPath), /ENOENT/);
      testsPassed++;

      const observer = await browser.target().createCDPSession();
      await resetPage();
      try {
        await observer.send('Browser.setDownloadBehavior', {
          behavior: 'default',
          browserContextId: context.id,
          eventsEnabled: true,
        });
        const cancel = async (event) => {
          if (event.url.endsWith('/slow')) {
            await observer.send('Browser.cancelDownload', {
              guid: event.guid,
              browserContextId: context.id,
            });
          }
        };
        observer.on('Browser.downloadWillBegin', cancel);
        const canceledPath = output('canceled.bin');
        const canceled = (
          await downloadFile({ ...params, selector: '#slow', outputPath: canceledPath })
        ).toMcpFormat();
        observer.off('Browser.downloadWillBegin', cancel);
        assert.equal(canceled.isError, true);
        assert.match(canceled.content[0].text, /canceled/);
        await assert.rejects(access(canceledPath), /ENOENT/);
        testsPassed++;
      } finally {
        await observer.detach();
      }

      let markStarted;
      await resetPage();
      const started = new Promise((resolve) => {
        markStarted = resolve;
      });
      onSlowRequest = markStarted;
      const slowPath = output('timeout.bin');
      const pending = downloadFile({
        ...params,
        selector: '#slow',
        outputPath: slowPath,
        timeoutMs: 1000,
      });
      await started;
      const concurrent = (
        await downloadFile({ ...params, outputPath: output('concurrent.bin') })
      ).toMcpFormat();
      assert.equal(concurrent.isError, true);
      assert.match(concurrent.content[0].text, /capture is active/);
      const timedOut = (await pending).toMcpFormat();
      assert.equal(timedOut.isError, true);
      assert.match(timedOut.content[0].text, /timed out/);
      await assert.rejects(access(slowPath), /ENOENT/);
      onSlowRequest = undefined;
      testsPassed++;

      const racePath = output('race.bin');
      await resetPage();
      onRaceRequest = () => writeFile(racePath, 'preserve concurrent writer');
      const race = downloadFile({
        ...params,
        selector: '#race',
        outputPath: racePath,
      });
      const raceResult = (await race).toMcpFormat();
      assert.equal(raceResult.isError, true);
      assert.match(raceResult.content[0].text, /EEXIST/);
      assert.equal(await readFile(racePath, 'utf8'), 'preserve concurrent writer');
      onSlowRequest = undefined;
      testsPassed++;

      await resetPage();
      const otherPage = await context.newPage();
      try {
        await otherPage.goto(url);
        const before = new Set(await readdir(directory));
        let startedDownload;
        const downloadStarted = new Promise((resolve) => {
          startedDownload = resolve;
        });
        onSlowRequest = startedDownload;
        const capture = downloadFile({
          ...params,
          selector: '#slow',
          outputPath: output('unrelated.bin'),
          timeoutMs: 1500,
        });
        await downloadStarted;
        await otherPage.evaluate(() => document.querySelector('#download').click());
        const captured = (await capture).toMcpFormat();
        assert.equal(captured.isError, true);
        assert.match(captured.content[0].text, /Other downloads were captured and preserved/);
        const stages = (await readdir(directory)).filter(
          (name) => !before.has(name) && name.startsWith('.mcpbrowser-download-'),
        );
        assert.equal(stages.length, 1);
        const stage = path.join(directory, stages[0]);
        const files = await readdir(stage);
        assert.ok(files.length > 0);
        assert.ok(
          (await Promise.all(files.map((name) => readFile(path.join(stage, name))))).some((bytes) =>
            bytes.equals(content),
          ),
        );
        testsPassed++;
      } finally {
        onSlowRequest = undefined;
        await otherPage.close();
      }

      // A failure must release capture state so the next download succeeds.
      const retryPath = output('after-timeout.bin');
      await resetPage();
      const retry = (await downloadFile({ ...params, outputPath: retryPath })).toMcpFormat();
      assert.equal(retry.isError, false, JSON.stringify(retry));
      assert.deepEqual(await readFile(retryPath), content);
      testsPassed++;
      assert.ok((await readdir(directory)).includes(path.basename(retryPath)));
    } finally {
      onSlowRequest = undefined;
      if (previousPage) domainPages.set(hostname, previousPage);
      else domainPages.delete(hostname);
      if (context.id) await context.close();
      else await page.close();
    }
  })();
  assert.ok(runs > 0, 'At least one real browser must execute download tests');
  console.log(`Tests Passed: ${testsPassed}`);
} finally {
  await closeBrowser();
  implementation.config.wsEndpoint = originalEndpoint;
  await isolatedBrowser.close();
  await server.close();
  await rm(directory, { recursive: true });
}
