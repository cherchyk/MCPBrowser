import assert from 'assert';
import { randomUUID } from 'crypto';
import { FETCH_WEBPAGE_ACTION } from '../../../src/actions/fetch-page.js';
import { ACTIONS as CORE_ACTIONS } from '../../../src/actions/index.js';
import { closeBrowser, getBrowser } from '../../../src/core/browser.js';
import { loadPlugins } from '../../../src/core/plugin-loader.js';
import { ErrorResponse, InformationalResponse } from '../../../src/core/responses.js';

const DEFAULT_WORD_E2E_URL =
  'https://microsoft-my.sharepoint.com/:w:/r/personal/bocherch_microsoft_com/_layouts/15/doc2.aspx?sourcedoc=%7BD698C47B-73C8-4E4F-8598-D3BF78D6EBFC%7D&file=Document%201.docx&action=editNew&mobileredirect=true&wdOrigin=APPHOME-WEB.DIRECT%2CAPPHOME-WEB.BANNER.NEWBLANK&wdPreviousSession=fc806b98-5a1d-4f3f-ba7c-502beeda301a&wdPreviousSessionSrc=AppHomeWeb&ct=1790612974885';
const documentUrl = process.env.WORD_E2E_URL || DEFAULT_WORD_E2E_URL;
const browserType = process.argv[2] || 'chrome';
const pluginAction = CORE_ACTIONS.find((action) => action.id === 'browser_plugin_action');
const marker = `MCPBrowserE2E${randomUUID().replaceAll('-', '')}`;

function assertSuccessfulResponse(response, actionName) {
  assert.ok(
    !(response instanceof ErrorResponse),
    `${actionName} failed: ${response instanceof ErrorResponse ? response.message : 'unknown error'}`,
  );
  assert.ok(
    !(response instanceof InformationalResponse),
    `${actionName} requires user action: ${
      response instanceof InformationalResponse ? response.reason : 'unknown reason'
    }`,
  );
  const mcp = response.toMcpFormat({ includeSerializedContent: false });
  assert.strictEqual(mcp.isError, false);
  assert.strictEqual(mcp.content.length, 1, `${actionName} must not serialize JSON as text`);
  assert.ok(mcp.structuredContent, `${actionName} must return structured JSON`);
  return response;
}

async function runWordAction(action, params = {}) {
  const response = await pluginAction.execute({ plugin: 'word', action, params });
  return assertSuccessfulResponse(response, action);
}

async function openDocument() {
  const fetched = await FETCH_WEBPAGE_ACTION.execute({ url: documentUrl, browser: browserType });
  assertSuccessfulResponse(fetched, 'browser_fetch_webpage');
  await runWordAction('open_document', { url: documentUrl, mode: 'edit' });
}

async function readDocument() {
  return runWordAction('read_document', { maxCharacters: 100_000 });
}

async function reconnectAndRead() {
  await closeBrowser();
  await openDocument();
  return readDocument();
}

async function closeFixtureTabs() {
  const browser = await getBrowser(browserType);
  for (const page of await browser.pages()) {
    if (page.url().includes('D698C47B-73C8-4E4F-8598-D3BF78D6EBFC')) {
      await page.close();
    }
  }
  await closeBrowser();
}

async function insertMarker() {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await pluginAction.execute({
      plugin: 'word',
      action: 'insert_document_text',
      params: { position: 'end', text: marker },
    });
    if (!(response instanceof ErrorResponse) && !(response instanceof InformationalResponse)) {
      assertSuccessfulResponse(response, 'insert_document_text');
      assert.strictEqual(response.data.accepted, true);
      return;
    }

    lastError = response;
    const read = await reconnectAndRead();
    if (read.data.text.includes(marker)) return;
  }

  assertSuccessfulResponse(lastError, 'insert_document_text');
}

async function undoInsertion() {
  const browser = await getBrowser(browserType);
  for (const page of await browser.pages()) {
    for (const frame of page.frames()) {
      const editor = await frame.$('#PagesContainer[contenteditable="true"]');
      if (!editor) continue;
      await editor.click();
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await page.keyboard.press('z');
      await page.keyboard.up(modifier);
      return;
    }
  }
  throw new Error('Editable Word frame was not found for cleanup');
}

console.log('Word plugin browser E2E: opening and editing a real Word Online document');

let markerMayExist = false;
try {
  await loadPlugins();
  await closeFixtureTabs();
  await openDocument();

  const initial = await readDocument();
  assert.strictEqual(initial.data.hasMore, false, 'The fixture must fit in one read operation');
  assert.strictEqual(initial.data.text, '', 'The dedicated Word E2E fixture must be empty');

  markerMayExist = true;
  await insertMarker();

  await runWordAction('wait_for_save', {
    timeoutMs: 60_000,
    expectedTextSuffix: marker,
  });

  const readAfterInsert = await readDocument();
  assert.ok(readAfterInsert.data.text.includes(marker), 'Inserted marker must be readable');

  await undoInsertion();

  await runWordAction('wait_for_save', { timeoutMs: 60_000 });

  const readAfterCleanup = await readDocument();
  markerMayExist = readAfterCleanup.data.text.includes(marker);
  assert.strictEqual(
    readAfterCleanup.data.text,
    '',
    'The Word E2E fixture must be empty after cleanup',
  );

  console.log('PASS: Word document was edited, verified, cleaned up, and saved');
} finally {
  if (markerMayExist) {
    try {
      const current = await readDocument();
      if (current.data.text.includes(marker)) {
        await undoInsertion();
        await runWordAction('wait_for_save', { timeoutMs: 60_000 });
        console.log('Cleanup: removed the E2E marker after a test failure');
      }
    } catch (error) {
      console.error(`Cleanup failed for marker ${marker}: ${error.message}`);
    }
  }
  await closeFixtureTabs();
}
