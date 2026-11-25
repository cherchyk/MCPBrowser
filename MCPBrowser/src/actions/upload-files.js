import { constants } from 'node:fs';
import { access, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { CoreAction } from '../core/actions.js';
import { getBrowser, getValidatedPage } from '../core/browser.js';
import { MCPResponse, ErrorResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';
import { isWSL, wslToWindowsPath } from '../utils.js';

class UploadFilesResponse extends MCPResponse {
  constructor(currentUrl, selector, files) {
    super([
      'Use browser_get_current_html to check upload progress or validation messages before retrying',
      'Use browser_click_element to submit the form if the site requires it',
    ]);
    if (typeof currentUrl !== 'string' || typeof selector !== 'string') {
      throw new TypeError('currentUrl and selector must be strings');
    }
    if (
      !Array.isArray(files) ||
      files.length === 0 ||
      files.some(
        (file) =>
          typeof file.name !== 'string' || !Number.isSafeInteger(file.size) || file.size < 0,
      )
    ) {
      throw new TypeError('files must contain filenames and non-negative byte sizes');
    }
    this.currentUrl = currentUrl;
    this.selector = selector;
    this.files = files;
  }

  _getAdditionalFields() {
    return {
      status: 'selected',
      currentUrl: this.currentUrl,
      selector: this.selector,
      files: this.files,
      message: this.getTextSummary(),
    };
  }

  getTextSummary() {
    return `Selected ${this.files.length} file(s). Selection may start an upload immediately; server acceptance and upload completion have not been verified.`;
  }
}

async function uploadFiles({ url, selector, filePaths } = {}) {
  let element;
  try {
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error('url is required and must be a non-empty string');
    }
    const hostname = new URL(url).hostname;
    if (!hostname) throw new Error('url must have a hostname');
    if (typeof selector !== 'string' || !selector.trim()) {
      throw new Error('selector is required and must be a non-empty string');
    }
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
      throw new Error('filePaths must be a non-empty array of absolute file paths');
    }
    if (filePaths.some((filePath) => typeof filePath !== 'string' || !path.isAbsolute(filePath))) {
      throw new Error('Every filePaths entry must be an absolute file path');
    }

    const files = [];
    const browserPaths = [];
    for (const filePath of filePaths) {
      const resolvedPath = await realpath(filePath);
      const fileStat = await stat(resolvedPath);
      if (!fileStat.isFile()) throw new Error(`Not a regular file: ${filePath}`);
      await access(resolvedPath, constants.R_OK);
      const browserPath = isWSL() ? wslToWindowsPath(resolvedPath) : resolvedPath;
      if (isWSL() && !path.win32.isAbsolute(browserPath)) {
        throw new Error('WSL uploads require files on a Windows-mounted drive under /mnt/<drive>/');
      }
      files.push({ name: path.basename(resolvedPath), size: fileStat.size });
      browserPaths.push(browserPath);
    }

    const browser = await getBrowser();
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(browser.wsEndpoint()).hostname)) {
      throw new Error(
        'File uploads require a local browser connection; remote file transport is not supported',
      );
    }
    const { page, error } = await getValidatedPage(hostname);
    if (!page) {
      return new InformationalResponse(
        `No open page found for ${hostname}`,
        error || 'The page must be loaded before selecting files',
        ['Use browser_fetch_webpage to load the page first, then retry browser_upload_files'],
      );
    }

    element = await page.waitForSelector(selector, { timeout: 5000 });
    if (!element) throw new Error(`File input not found: ${selector}`);
    const input = await element.evaluate((el) => ({
      isFileInput: el.tagName === 'INPUT' && el.type === 'file',
      disabled: el.matches(':disabled'),
      multiple: el.multiple,
      directory: el.hasAttribute('webkitdirectory'),
    }));
    if (!input.isFileInput) throw new Error('selector must target an input[type="file"] element');
    if (input.disabled) throw new Error('The file input is disabled');
    if (input.directory)
      throw new Error('Directory uploads are not supported; select a file input');
    if (files.length > 1 && !input.multiple) {
      throw new Error('The file input does not allow multiple files');
    }

    await element.uploadFile(...browserPaths);
    logger.info(`browser_upload_files: selected ${files.length} file(s) for ${hostname}`);
    return new UploadFilesResponse(page.url(), selector, files);
  } catch (error) {
    logger.error(`browser_upload_files failed: ${error.message}`);
    return new ErrorResponse(`File selection failed: ${error.message}`, [
      'Check that all paths identify readable local files accessible to the browser on the same machine',
      'Use browser_detect_forms or browser_get_current_html to find an enabled input[type="file"]',
      'Check the page before retrying: selecting files may already have started an upload',
    ]);
  } finally {
    if (element) await element.dispose();
  }
}

export const UPLOAD_FILES_ACTION = new CoreAction({
  tool: {
    name: 'browser_upload_files',
    title: 'Upload Files',
    description:
      'Select local files in an input[type="file"] on a browser-loaded page, including hidden file inputs. Use for file uploads and attachments instead of typing file paths or opening an OS picker. Selection may immediately send the files to the website. Requires explicit user authorization for the files and destination. Returns filenames and sizes, not file contents; does not verify server acceptance or upload completion. PREREQUISITE: Load the page with browser_fetch_webpage first. Files must be accessible on the browser machine.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL of the previously loaded page', minLength: 1 },
        selector: {
          type: 'string',
          description: 'CSS selector for the file input, not its visible upload button',
          minLength: 1,
        },
        filePaths: {
          type: 'array',
          description:
            'Absolute paths to readable local files. Multiple files require an input with the multiple attribute. In WSL use /mnt/<drive>/ paths shared with the Windows browser.',
          items: { type: 'string', minLength: 1 },
          minItems: 1,
        },
      },
      required: ['url', 'selector', 'filePaths'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['selected'] },
        currentUrl: { type: 'string' },
        selector: { type: 'string' },
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              size: { type: 'integer', minimum: 0, description: 'File size in bytes' },
            },
            required: ['name', 'size'],
            additionalProperties: false,
          },
          minItems: 1,
        },
        message: { type: 'string' },
        nextSteps: { type: 'array', items: { type: 'string' } },
      },
      required: ['status', 'currentUrl', 'selector', 'files', 'message', 'nextSteps'],
      additionalProperties: false,
    },
    annotations: {
      title: 'Upload Files',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
  response: UploadFilesResponse,
  handler: uploadFiles,
});
