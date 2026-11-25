import { constants } from 'node:fs';
import { access, link, lstat, mkdtemp, realpath, rmdir, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { CoreAction } from '../core/actions.js';
import { getBrowser, getValidatedPage } from '../core/browser.js';
import { MCPResponse, ErrorResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';
import { isWSL, wslToWindowsPath } from '../utils.js';

let captureActive = false;

class DownloadFileResponse extends MCPResponse {
  constructor(currentUrl, outputPath, filename, size, warnings = []) {
    super(['Treat downloaded files as untrusted; do not execute them automatically']);
    if (
      typeof currentUrl !== 'string' ||
      typeof outputPath !== 'string' ||
      typeof filename !== 'string' ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      !Array.isArray(warnings) ||
      warnings.some((warning) => typeof warning !== 'string')
    ) {
      throw new TypeError('Invalid download result metadata');
    }
    this.currentUrl = currentUrl;
    this.outputPath = outputPath;
    this.suggestedFilename = filename;
    this.size = size;
    this.warnings = warnings;
  }

  _getAdditionalFields() {
    return {
      status: 'completed',
      currentUrl: this.currentUrl,
      outputPath: this.outputPath,
      suggestedFilename: this.suggestedFilename,
      size: this.size,
      warnings: this.warnings,
    };
  }

  getTextSummary() {
    return `Downloaded ${this.size} bytes to ${this.outputPath}${this.warnings.length ? `\n${this.warnings.join('\n')}` : ''}`;
  }
}

async function downloadFile({ url, selector, outputPath, timeoutMs = 30000 } = {}) {
  let session;
  let element;
  let stagingPath;
  let timer;
  let download;
  let saved;
  let failure;
  let behaviorChanged = false;
  let context;
  const warnings = [];
  const unrelated = new Set();
  let acquired = false;
  let currentUrl;
  try {
    if (typeof url !== 'string' || !url.trim()) throw new Error('url is required');
    const hostname = new URL(url).hostname;
    if (!hostname) throw new Error('url must have a hostname');
    if (typeof selector !== 'string' || !selector.trim()) throw new Error('selector is required');
    if (typeof outputPath !== 'string' || !path.isAbsolute(outputPath)) {
      throw new Error('outputPath must be an absolute file path');
    }
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
      throw new Error('timeoutMs must be an integer between 1 and 120000');
    }
    const parent = await realpath(path.dirname(outputPath));
    outputPath = path.join(parent, path.basename(outputPath));
    try {
      await lstat(outputPath);
      throw new Error(`outputPath already exists: ${outputPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await access(parent, constants.W_OK);
    if (captureActive) throw new Error('Another download capture is active; wait before retrying');
    captureActive = true;
    acquired = true;

    const browser = await getBrowser();
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(browser.wsEndpoint()).hostname)) {
      throw new Error(
        'Downloads require a local browser connection; remote file transport is not supported',
      );
    }
    const { page, error } = await getValidatedPage(hostname);
    if (!page) {
      return new InformationalResponse(
        `No open page found for ${hostname}`,
        error || 'Load the page before downloading',
        ['Use browser_fetch_webpage first, then retry browser_download_file'],
      );
    }
    element = await page.waitForSelector(selector, {
      visible: true,
      timeout: Math.min(timeoutMs, 5000),
    });
    if (!element) throw new Error(`Download control not found: ${selector}`);
    session = await page.target().createCDPSession();
    const { frameTree } = await session.send('Page.getFrameTree');
    const frameIds = new Set();
    function collectFrames(tree) {
      frameIds.add(tree.frame.id);
      for (const child of tree.childFrames || []) collectFrames(child);
    }
    collectFrames(frameTree);
    await session.detach();
    session = await browser.target().createCDPSession();
    context = page.browserContext().id;
    stagingPath = await mkdtemp(path.join(parent, '.mcpbrowser-download-'));
    const browserPath = isWSL() ? wslToWindowsPath(stagingPath) : stagingPath;
    if (isWSL() && !path.win32.isAbsolute(browserPath)) {
      throw new Error(
        'WSL downloads require an outputPath on a Windows-mounted drive under /mnt/<drive>/',
      );
    }

    let finish;
    const completed = new Promise((resolve) => {
      finish = resolve;
    });
    session.on('Browser.downloadWillBegin', (event) => {
      if (!download && frameIds.has(event.frameId)) {
        download = event;
      } else {
        unrelated.add(event.guid);
      }
    });
    session.on('Browser.downloadProgress', (event) => {
      if (event.guid !== download?.guid) return;
      if (event.state === 'completed') finish({ event });
      if (event.state === 'canceled')
        finish({ error: new Error('The browser canceled the download') });
    });
    behaviorChanged = true;
    await session.send('Browser.setDownloadBehavior', {
      behavior: 'allowAndName',
      browserContextId: context,
      downloadPath: browserPath,
      eventsEnabled: true,
    });
    // The listener must be armed before the click; never retry a potentially mutating trigger.
    await page.bringToFront();
    await element.click();
    timer = setTimeout(
      () => finish({ error: new Error(`Download timed out after ${timeoutMs}ms`) }),
      timeoutMs,
    );
    const outcome = await completed;
    if (outcome.error) throw outcome.error;
    if (!download || !/^[a-zA-Z0-9-]+$/.test(download.guid)) {
      throw new Error('The browser returned an invalid download identifier');
    }
    const sourcePath = path.join(stagingPath, download.guid);
    const sourceStat = await stat(sourcePath);
    if (!sourceStat.isFile()) throw new Error('Completed download is not a regular file');
    if (sourceStat.size !== outcome.event.receivedBytes) {
      throw new Error('Downloaded file size does not match the browser completion event');
    }
    // Staging is on the destination filesystem. Linking publishes atomically without overwriting.
    await link(sourcePath, outputPath);
    saved = { size: sourceStat.size, filename: download.suggestedFilename };
    currentUrl = page.url();
    await unlink(sourcePath);
  } catch (error) {
    failure = error;
    logger.error(`browser_download_file failed: ${error.message}`);
  } finally {
    clearTimeout(timer);
    if (session && behaviorChanged) {
      if (download && !saved) {
        try {
          await session.send('Browser.cancelDownload', {
            guid: download.guid,
            browserContextId: context,
          });
        } catch (error) {
          warnings.push(`Could not cancel download: ${error.message}`);
        }
      }
      try {
        await session.send('Browser.setDownloadBehavior', {
          behavior: 'default',
          browserContextId: context,
          eventsEnabled: false,
        });
      } catch (error) {
        failure ||= error;
        warnings.push(`Could not restore browser-default download behavior: ${error.message}`);
      }
    }
    for (const resource of [element, session]) {
      if (!resource) continue;
      try {
        if (resource === element) await resource.dispose();
        else await resource.detach();
      } catch (error) {
        warnings.push(`Download cleanup failed: ${error.message}`);
      }
    }
    if (stagingPath) {
      if (unrelated.size) {
        warnings.push(
          `Other downloads were captured and preserved in ${stagingPath}; files use browser download GUIDs`,
        );
      } else {
        try {
          await rmdir(stagingPath);
        } catch (error) {
          warnings.push(`Download staging files preserved in ${stagingPath}: ${error.message}`);
        }
      }
    }
    if (acquired) captureActive = false;
  }
  if (failure) {
    return new ErrorResponse(
      `Download failed: ${failure.message}${saved ? `. File was saved to ${outputPath}; do not repeat the download` : ''}${warnings.length ? `\n${warnings.join('\n')}` : ''}`,
      [
        'Inspect the page before retrying: the click may already have had side effects',
        'Check the destination directory and browser download status',
      ],
    );
  }
  logger.info(`browser_download_file: saved ${saved.size} bytes`);
  return new DownloadFileResponse(currentUrl, outputPath, saved.filename, saved.size, warnings);
}

export const DOWNLOAD_FILE_ACTION = new CoreAction({
  tool: {
    name: 'browser_download_file',
    title: 'Download File',
    description:
      "Click an observed download control on a previously loaded page, wait for a single browser download to complete, and save it to an absolute local outputPath without overwriting. Returns verified path and byte size, not file contents. Uses the signed-in session. Temporarily redirects downloads for the entire browser context and restores browser defaults afterward (not another client's unknown override); avoid other downloads during capture. Other captured files are preserved with a warning. Requires a local browser; OS Save As dialogs and downloads in new tabs are unsupported.",
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the previously loaded page' },
        selector: { type: 'string', description: 'CSS selector of the download control to click' },
        outputPath: {
          type: 'string',
          description:
            'Absolute new file path in an existing writable directory; in WSL use /mnt/<drive>/',
        },
        timeoutMs: {
          type: 'integer',
          minimum: 1,
          maximum: 120000,
          default: 30000,
          description: 'Maximum wait after triggering the download, in milliseconds',
        },
      },
      required: ['url', 'selector', 'outputPath'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['completed'] },
        currentUrl: { type: 'string' },
        outputPath: { type: 'string' },
        suggestedFilename: { type: 'string' },
        size: { type: 'integer', minimum: 0 },
        warnings: { type: 'array', items: { type: 'string' } },
        nextSteps: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'status',
        'currentUrl',
        'outputPath',
        'suggestedFilename',
        'size',
        'warnings',
        'nextSteps',
      ],
      additionalProperties: false,
    },
    annotations: {
      title: 'Download File',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  response: DownloadFileResponse,
  handler: downloadFile,
});
