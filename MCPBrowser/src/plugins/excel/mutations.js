import { clickFramePoint, focusGrid, requireSelection, selectRange, shortcut } from './helpers.js';
import * as selectors from './selectors.js';

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
export const MAX_CELL_INPUT_CHARACTERS = 32_767;

export function validateCellInput(value) {
  if (typeof value !== 'string' || value.length > MAX_CELL_INPUT_CHARACTERS) {
    throw new Error(`input must be a string of at most ${MAX_CELL_INPUT_CHARACTERS} characters`);
  }
  if (value.includes('\0')) throw new Error('input must not contain null characters');
  return value.replace(/\r\n?/g, '\n');
}

export function cellInputsEqual(left, right) {
  const canonical = (input) => {
    if (!input.startsWith('=')) return input;
    let quote = null;
    let result = '';
    for (let index = 0; index < input.length; index++) {
      const character = input[index];
      if ((character === '"' || character === "'") && (!quote || quote === character)) {
        result += character;
        if (quote && input[index + 1] === quote) {
          result += input[++index];
        } else {
          quote = quote ? null : character;
        }
      } else {
        result += quote === '"' ? character : character.toUpperCase();
      }
    }
    return result;
  };
  return canonical(left) === canonical(right);
}

async function enterCellEdit(page, frame, range, sheet) {
  if (range.rowCount !== 1 || range.columnCount !== 1) {
    throw new Error('Cell editing requires a single A1 cell');
  }
  const input = await readCellInput(page, frame, range, sheet);
  const point = await frame.evaluate((selector) => {
    const editor = document.querySelector(selector);
    const rect = editor.getBoundingClientRect();
    return rect.width && rect.height
      ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      : null;
  }, selectors.FORMULA_BAR);
  if (!point) throw new Error('The native formula-bar editor is not visible');
  await clickFramePoint(page, frame, point);
  await frame.evaluate(
    (selector) => document.querySelector(selector).focus(),
    selectors.FORMULA_BAR,
  );
  await pause(300);
  await requireSelection(frame, range, sheet);
  const editable = await frame.evaluate((selector) => {
    const grid = document.querySelector(selector);
    return (
      document.hasFocus() &&
      document.activeElement === grid &&
      grid.getAttribute('contenteditable') === 'true'
    );
  }, selectors.FORMULA_BAR);
  if (!editable) throw new Error('Excel cell editor lost focus or is not editable');
  return input;
}

export async function readCellInput(page, frame, range, sheet) {
  await selectRange(page, frame, range, sheet);
  const input = await frame.evaluate((selector) => {
    const bar = document.querySelector(selector);
    if (!bar) return null;
    return bar.classList.contains('ql-blank') ? '' : bar.innerText.replace(/\r\n?/g, '\n');
  }, selectors.FORMULA_BAR);
  if (typeof input !== 'string') throw new Error('Excel native cell input is not exposed');
  await requireSelection(frame, range, sheet);
  return input;
}

export async function getSaveState(frame) {
  return frame.evaluate((selector) => {
    const button = document.querySelector(selector);
    if (!button) return 'unknown';
    const label = (button.getAttribute('aria-label') || '').toLowerCase();
    if (/\b(save failed|unable to save|couldn['\u2019]t save|upload failed)\b/.test(label))
      return 'error';
    if (button.querySelector('[data-icon-name^="CloudCheckmark"]')) return 'saved';
    return /\bsaving\b/.test(label) ? 'saving' : 'unknown';
  }, selectors.SAVE_STATUS);
}

export async function waitForSave(frame, timeoutMs = 30_000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 60_000) {
    throw new Error('timeoutMs must be an integer between 500 and 60000');
  }
  const deadline = Date.now() + timeoutMs;
  let stable = 0;
  let state = 'unknown';
  do {
    state = await getSaveState(frame);
    if (state === 'error') throw new Error('Excel reports a save error');
    stable = state === 'saved' ? stable + 1 : 0;
    if (stable >= 2) return { saved: true };
    await pause(250);
  } while (Date.now() < deadline);
  throw new Error(
    `Excel save could not be confirmed (${state}); do not assume the edit is persisted`,
  );
}

export async function replaceCellInput(page, frame, range, sheet, input, expectedInput) {
  const before = await readCellInput(page, frame, range, sheet);
  if (expectedInput !== undefined && before !== expectedInput) {
    throw new Error('Cell input did not match expectedInput; no change was started');
  }
  if (cellInputsEqual(before, input)) {
    await waitForSave(frame);
    return {
      sheet,
      cell: range.address,
      input: before,
      changed: false,
      verified: true,
      saved: true,
    };
  }

  let mutationAttempted = false;
  try {
    const current = await enterCellEdit(page, frame, range, sheet);
    if (current !== before)
      throw new Error('Cell input changed before editing; no change was started');
    await shortcut(page, frame, 'a');
    const selectionIsInCell = await frame.evaluate(
      ({ selector, expected }) => {
        const grid = document.querySelector(selector);
        const selection = window.getSelection();
        return (
          document.hasFocus() &&
          document.activeElement === grid &&
          selection?.rangeCount === 1 &&
          grid.contains(selection.anchorNode) &&
          grid.contains(selection.focusNode) &&
          selection.toString().replace(/\r\n?/g, '\n') === expected
        );
      },
      { selector: selectors.FORMULA_BAR, expected: current },
    );
    if (!selectionIsInCell) throw new Error('Excel did not select the cell editor text');
    await requireSelection(frame, range, sheet);
    mutationAttempted = true;
    if (input === '') {
      await page.keyboard.press('Backspace', { delay: 100 });
    } else {
      await page.keyboard.sendCharacter(input);
    }
    await pause(200);
    const entered = await frame.evaluate((selector) => {
      const editor = document.querySelector(selector);
      return document.activeElement === editor ? editor.innerText.replace(/\r\n?/g, '\n') : null;
    }, selectors.FORMULA_BAR);
    if (typeof entered !== 'string' || !cellInputsEqual(entered, input))
      throw new Error('The native formula-bar editor did not retain the complete requested input');
    await requireSelection(frame, range, sheet);
    await page.keyboard.press('Enter', { delay: 100 });
    await page.keyboard.press('Escape', { delay: 100 });
    await focusGrid(page, frame);
    await pause(300);

    const deadline = Date.now() + 5_000;
    let after;
    do {
      after = await readCellInput(page, frame, range, sheet);
      if (cellInputsEqual(after, input)) break;
      await pause(200);
    } while (Date.now() < deadline);
    if (!cellInputsEqual(after, input))
      throw new Error('The cell input did not match the requested text or formula');
    await waitForSave(frame);
    return { sheet, cell: range.address, input: after, changed: true, verified: true, saved: true };
  } catch (error) {
    if (!mutationAttempted) throw error;
    throw new Error(
      `Excel edit outcome or persistence is unverified: ${error.message}. The cell may have changed; inspect it before retrying`,
      { cause: error },
    );
  } finally {
    await page.keyboard.press('Escape', { delay: 100 });
    await focusGrid(page, frame);
  }
}
