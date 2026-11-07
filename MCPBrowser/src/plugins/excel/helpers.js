import { MCPResponse } from '../../core/responses.js';
import {
  isOfficeEditorHost,
  isSharePointHost,
  isAuthenticationUrl,
} from '../../core/office-urls.js';
import * as selectors from './selectors.js';

export const MAX_RANGE_CELLS = 10_000;
const EDITOR_TIMEOUT = 30_000;
const SELECTION_TIMEOUT = 5_000;
const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class ExcelActionResponse extends MCPResponse {
  constructor(data, summary, nextSteps = []) {
    super(nextSteps);
    this.data = data;
    this.summary = summary;
  }

  _getAdditionalFields() {
    return { data: this.data };
  }

  getTextSummary() {
    return this.summary;
  }
}

export function isAllowedExcelUrl(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (['excel.cloud.microsoft', 'excel.office.com', 'onedrive.live.com'].includes(url.hostname) ||
        isSharePointHost(url.hostname) ||
        isOfficeEditorHost(url.hostname))
    );
  } catch {
    return false;
  }
}

export function parseRange(value) {
  if (typeof value !== 'string') throw new Error('range must be an A1 cell or rectangular range');
  const match = /^\$?([A-Z]{1,3})\$?([1-9]\d{0,6})(?::\$?([A-Z]{1,3})\$?([1-9]\d{0,6}))?$/i.exec(
    value,
  );
  if (!match)
    throw new Error('range must be an A1 cell or rectangular range, without a sheet name');
  const columnIndex = (letters) =>
    [...letters.toUpperCase()].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0);
  const startColumn = columnIndex(match[1]);
  const endColumn = columnIndex(match[3] || match[1]);
  const startRow = Number(match[2]);
  const endRow = Number(match[4] || match[2]);
  if (
    startColumn > 16_384 ||
    endColumn > 16_384 ||
    startRow > 1_048_576 ||
    endRow > 1_048_576 ||
    endColumn < startColumn ||
    endRow < startRow
  ) {
    throw new Error('range is outside Excel worksheet bounds or has reversed endpoints');
  }
  const rowCount = endRow - startRow + 1;
  const columnCount = endColumn - startColumn + 1;
  if (rowCount * columnCount > MAX_RANGE_CELLS) {
    throw new Error(`range exceeds the ${MAX_RANGE_CELLS} cell limit; read smaller ranges`);
  }
  const first = `${match[1].toUpperCase()}${startRow}`;
  const last = `${(match[3] || match[1]).toUpperCase()}${endRow}`;
  return {
    address: first === last ? first : `${first}:${last}`,
    rowCount,
    columnCount,
  };
}

export async function findExcelEditor(page) {
  for (const frame of page.frames()) {
    let url;
    try {
      url = new URL(frame.url());
    } catch {
      continue;
    }
    if (!isAllowedExcelUrl(url.href)) continue;
    const state = await frame.evaluate((sel) => {
      const nameBox = document.querySelector(sel.NAME_BOX);
      const grid = document.querySelector(sel.GRID);
      if (!nameBox || !grid) return null;
      const rectangle = nameBox.getBoundingClientRect();
      return {
        visible: rectangle.width > 0 && rectangle.height > 0,
        mode: document.querySelector(sel.MODE)?.getAttribute('data-document-mode') || 'unknown',
      };
    }, selectors);
    if (state?.visible) return { frame, ...state };
  }
  return null;
}

export async function ensureExcelEditor(page, { url } = {}) {
  if (url !== undefined) {
    if (!isAllowedExcelUrl(url)) {
      throw new Error('url must be an HTTPS Excel, SharePoint, OneDrive, or Office Online URL');
    }
    if (page.url() !== url) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: EDITOR_TIMEOUT });
    }
  }
  if (isAuthenticationUrl(page.url())) return { status: 'authentication_required' };
  if (!isAllowedExcelUrl(page.url())) throw new Error('The page is not an approved Excel origin');
  const deadline = Date.now() + EDITOR_TIMEOUT;
  do {
    const editor = await findExcelEditor(page);
    if (editor) return { status: 'ready', ...editor };
    if (isAuthenticationUrl(page.url())) return { status: 'authentication_required' };
    await pause(200);
  } while (Date.now() < deadline);
  throw new Error(
    'Excel editor was not found; open a specific workbook rather than the Excel home page',
  );
}

export async function listWorksheets(frame) {
  const worksheets = await frame.evaluate((sel) => {
    return [...document.querySelectorAll(sel.SHEET_TABS)].map((tab) => ({
      name: tab.querySelector('[sheet-title]').getAttribute('sheet-title'),
      active: tab.getAttribute('aria-selected') === 'true',
    }));
  }, selectors);
  if (!worksheets.length || worksheets.filter((sheet) => sheet.active).length !== 1) {
    throw new Error('Excel worksheet tabs or the active worksheet could not be identified');
  }
  return worksheets;
}

export async function selectWorksheet(frame, name) {
  if (name !== undefined && (typeof name !== 'string' || !name.length)) {
    throw new Error('sheet must be a non-empty worksheet name');
  }
  const worksheets = await listWorksheets(frame);
  const target = name ?? worksheets.find((sheet) => sheet.active).name;
  if (!worksheets.some((sheet) => sheet.name === target)) {
    throw new Error('The requested worksheet tab was not found; use list_worksheets');
  }
  if (!worksheets.find((sheet) => sheet.name === target).active) {
    const point = await frame.evaluate(
      ({ sel, sheetName }) => {
        const tab = [...document.querySelectorAll(sel.SHEET_TABS)].find(
          (element) =>
            element.querySelector('[sheet-title]').getAttribute('sheet-title') === sheetName,
        );
        tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const rect = tab.getBoundingClientRect();
        return rect.width && rect.height
          ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
          : null;
      },
      { sel: selectors, sheetName: target },
    );
    if (!point) throw new Error('The requested worksheet tab is not visible');
    const page = frame.page();
    await page.bringToFront();
    await clickFramePoint(page, frame, point);
    const deadline = Date.now() + SELECTION_TIMEOUT;
    do {
      if ((await listWorksheets(frame)).some((sheet) => sheet.name === target && sheet.active)) {
        await pause(300);
        return target;
      }
      await pause(100);
    } while (Date.now() < deadline);
    throw new Error('Excel did not activate the requested worksheet');
  }
  return target;
}

export async function focusGrid(page, frame) {
  await page.bringToFront();
  const focused = await frame.evaluate((selector) => {
    const grid = document.querySelector(selector);
    grid.focus();
    return document.hasFocus() && document.activeElement === grid;
  }, selectors.GRID);
  if (!focused) throw new Error('The Excel grid could not be focused; no action was started');
}

export async function shortcut(page, frame, key) {
  const modifier = await frame.evaluate(() =>
    /Mac/i.test(navigator.platform) ? 'Meta' : 'Control',
  );
  await page.keyboard.down(modifier);
  try {
    await page.keyboard.press(key, { delay: 100 });
  } finally {
    await page.keyboard.up(modifier);
  }
  await pause(100);
}

export async function selectedAddress(frame) {
  const address = await frame.evaluate((sel) => {
    const field = document.querySelector(sel.NAME_BOX);
    if (!field || field.getAttribute('aria-invalid') === 'true') return null;
    if (document.activeElement === document.querySelector(sel.FORMULA_BAR)) return field.value;
    const grid = document.querySelector(sel.GRID);
    return (
      document
        .getElementById(grid?.getAttribute('aria-activedescendant'))
        ?.getAttribute('aria-label') || null
    );
  }, selectors);
  const cell = address?.match(/\b[A-Z]{1,3}[1-9]\d{0,6}\b/gi)?.at(-1);
  return cell ? parseRange(cell).address : null;
}

export async function requireSelection(frame, range, sheet) {
  const worksheets = await listWorksheets(frame);
  const address = await selectedAddress(frame);
  if (
    address !== range.address ||
    !worksheets.some((worksheet) => worksheet.name === sheet && worksheet.active)
  ) {
    throw new Error(
      `Excel selection changed (expected ${range.address}, observed ${address}); the requested cells could not be confirmed`,
    );
  }
}

export async function clickFramePoint(page, frame, point, options = {}) {
  for (let ancestor = frame; ancestor.parentFrame(); ancestor = ancestor.parentFrame()) {
    const element = await ancestor.frameElement();
    try {
      const offset = await element.evaluate((iframe) => {
        const rect = iframe.getBoundingClientRect();
        if (!rect.width || !rect.height || getComputedStyle(iframe).visibility !== 'visible') {
          throw new Error('The Excel editor frame is not visible');
        }
        return { x: rect.x + iframe.clientLeft, y: rect.y + iframe.clientTop };
      });
      point.x += offset.x;
      point.y += offset.y;
    } finally {
      await element.dispose();
    }
  }
  await page.mouse.move(point.x, point.y);
  await page.mouse.click(point.x, point.y, { delay: 100, ...options });
}

export async function selectRange(page, frame, range, sheet) {
  await selectWorksheet(frame, sheet);
  await page.bringToFront();
  const point = await frame.evaluate((selector) => {
    const field = document.querySelector(selector);
    const rect = field.getBoundingClientRect();
    if (!rect.width || !rect.height || field.getAttribute('aria-disabled') === 'true') return null;
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, selectors.NAME_BOX);
  if (!point) throw new Error('Excel Name Box is unavailable');
  // Name Box range entry is initialized by mousedown, not a synthetic DOM click.
  await clickFramePoint(page, frame, point);
  const focused = await frame.evaluate((selector) => {
    const field = document.querySelector(selector);
    field.select();
    return document.hasFocus() && document.activeElement === field;
  }, selectors.NAME_BOX);
  if (!focused) throw new Error('Excel Name Box could not be focused');
  await page.keyboard.type(range.address, { delay: 20 });
  await pause(200);
  await page.keyboard.press('Enter', { delay: 100 });
  await pause(500);
  await focusGrid(page, frame);
  const deadline = Date.now() + SELECTION_TIMEOUT;
  do {
    if ((await selectedAddress(frame)) === range.address) {
      await pause(200);
      await requireSelection(frame, range, sheet);
      return;
    }
    await pause(100);
  } while (Date.now() < deadline);
  await requireSelection(frame, range, sheet);
}
