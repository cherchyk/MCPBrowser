import { clickFramePoint, listWorksheets, selectWorksheet } from './helpers.js';
import { waitForSave } from './mutations.js';
import * as selectors from './selectors.js';

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const UI_TIMEOUT = 5_000;
const CHANGE_TIMEOUT = 30_000;
const RENAME_INPUT = '#inlineRenameInput';

export function validateWorksheetName(name) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 31 ||
    /[\\/:?*\[\]\x00-\x1f]/.test(name) ||
    name.startsWith("'") ||
    name.endsWith("'")
  ) {
    throw new Error('name must be a valid Excel worksheet name of 1–31 characters');
  }
  return name;
}

function requireAvailableName(worksheets, name, current) {
  if (
    worksheets.some(
      (sheet) => sheet.name !== current && sheet.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error('A worksheet with that name already exists; no change was started');
  }
}

async function clickSheetCommand(page, frame, sheet, command) {
  await selectWorksheet(frame, sheet);
  await page.bringToFront();
  const point = await frame.evaluate(
    ({ sel, name }) => {
      const tab = [...document.querySelectorAll(sel.SHEET_TABS)].find(
        (element) => element.querySelector('[sheet-title]').getAttribute('sheet-title') === name,
      );
      if (!tab) return null;
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const rect = tab.getBoundingClientRect();
      return rect.width && rect.height
        ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        : null;
    },
    { sel: selectors, name: sheet },
  );
  if (!point) throw new Error('The requested worksheet tab is not available');
  await clickFramePoint(page, frame, point, { button: 'right' });
  const deadline = Date.now() + UI_TIMEOUT;
  do {
    const commandPoint = await frame.evaluate((action) => {
      const item = document.querySelector(
        `[data-unique-id="ContextMenu-ContextMenu.${action}_Enabled"]`,
      );
      if (!item) return null;
      const rect = item.getBoundingClientRect();
      if (!rect.width || !rect.height || getComputedStyle(item).visibility === 'hidden')
        return null;
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    }, command);
    if (commandPoint) {
      await clickFramePoint(page, frame, commandPoint);
      return;
    }
    await pause(100);
  } while (Date.now() < deadline);
  await page.keyboard.press('Escape', { delay: 100 });
  throw new Error('The requested native worksheet command is unavailable or disabled');
}

export async function renameWorksheet(page, frame, sheet, name) {
  validateWorksheetName(name);
  const before = await listWorksheets(frame);
  if (!before.some((item) => item.name === sheet))
    throw new Error('The requested worksheet was not found');
  requireAvailableName(before, name, sheet);
  if (sheet === name) {
    await waitForSave(frame);
    return { sheet: name, previousName: sheet, changed: false, saved: true };
  }
  await clickSheetCommand(page, frame, sheet, 'RenameSheet');
  let submitted = false;
  try {
    const deadline = Date.now() + UI_TIMEOUT;
    let focused = false;
    do {
      focused = await frame.evaluate(
        ({ selector, current }) => {
          const input = document.querySelector(selector);
          if (
            !input ||
            input.value !== current ||
            input.closest('[sheet-title]')?.getAttribute('sheet-title') !== current
          )
            return false;
          const rect = input.getBoundingClientRect();
          if (!rect.width || !rect.height) return false;
          input.select();
          return document.hasFocus() && document.activeElement === input;
        },
        { selector: RENAME_INPUT, current: sheet },
      );
      if (focused) break;
      await pause(100);
    } while (Date.now() < deadline);
    if (!focused) throw new Error('The native worksheet rename input was not available');
    await page.keyboard.type(name, { delay: 20 });
    const ready = await frame.evaluate(
      ({ selector, expected }) =>
        document.activeElement === document.querySelector(selector) &&
        document.querySelector(selector)?.value === expected,
      { selector: RENAME_INPUT, expected: name },
    );
    if (!ready) throw new Error('The worksheet rename input changed before submission');
    submitted = true;
    await page.keyboard.press('Enter', { delay: 100 });
    const renameDeadline = Date.now() + CHANGE_TIMEOUT;
    do {
      const after = await listWorksheets(frame);
      if (
        after.length === before.length &&
        after.some((item) => item.name === name) &&
        !after.some((item) => item.name === sheet) &&
        before.every((item) => item.name === sheet || after.some((next) => next.name === item.name))
      ) {
        await waitForSave(frame);
        return { sheet: name, previousName: sheet, changed: true, saved: true };
      }
      await pause(100);
    } while (Date.now() < renameDeadline);
    throw new Error('The requested worksheet name was not confirmed');
  } catch (error) {
    if (!submitted) throw error;
    throw new Error(
      `Worksheet rename or persistence is unverified: ${error.message}. Inspect the worksheet list before retrying`,
      { cause: error },
    );
  } finally {
    await page.keyboard.press('Escape', { delay: 100 });
  }
}

export async function createWorksheet(page, frame, name) {
  validateWorksheetName(name);
  const before = await listWorksheets(frame);
  requireAvailableName(before, name);
  let created;
  try {
    await clickSheetCommand(page, frame, before.find((sheet) => sheet.active).name, 'InsertSheet');
    const deadline = Date.now() + CHANGE_TIMEOUT;
    do {
      const after = await listWorksheets(frame);
      const added = after.filter((sheet) => !before.some((old) => old.name === sheet.name));
      if (
        added.length === 1 &&
        after.length === before.length + 1 &&
        before.every((old) => after.some((sheet) => sheet.name === old.name))
      ) {
        created = added[0].name;
        break;
      }
      if (added.length > 1) throw new Error('More than one new worksheet appeared');
      await pause(100);
    } while (Date.now() < deadline);
    if (!created) throw new Error('The new worksheet could not be identified');
    await renameWorksheet(page, frame, created, name);
    await selectWorksheet(frame, name);
    return { sheet: name, created: true, saved: true };
  } catch (error) {
    throw new Error(
      `Worksheet creation or persistence is unverified: ${error.message}. A worksheet${created ? ` (${created})` : ''} may have been created; inspect the worksheet list before retrying`,
      { cause: error },
    );
  }
}

export async function deleteWorksheet(page, frame, sheet, confirmDelete) {
  if (confirmDelete !== true)
    throw new Error(
      'Deleting a worksheet requires confirmDelete: true after explicit user approval',
    );
  const before = await listWorksheets(frame);
  if (!before.some((item) => item.name === sheet))
    throw new Error('The requested worksheet was not found');
  if (before.length <= 1) throw new Error('The last visible worksheet cannot be deleted');
  const blocked = await frame.evaluate(() =>
    [...document.querySelectorAll('[role="dialog"],[role="alertdialog"]')].some((dialog) => {
      const rect = dialog.getBoundingClientRect();
      return rect.width && rect.height && getComputedStyle(dialog).visibility !== 'hidden';
    }),
  );
  if (blocked) throw new Error('An existing dialog must be resolved before deleting a worksheet');
  await clickSheetCommand(page, frame, sheet, 'DeleteSheet');
  let confirmed = false;
  try {
    const deadline = Date.now() + CHANGE_TIMEOUT;
    do {
      const after = await listWorksheets(frame);
      if (
        !after.some((item) => item.name === sheet) &&
        after.length === before.length - 1 &&
        before.every((old) => old.name === sheet || after.some((item) => item.name === old.name))
      ) {
        await waitForSave(frame);
        return { sheet, deleted: true, saved: true };
      }
      if (!confirmed) {
        const confirmation = await frame.evaluate(() => {
          const dialogs = [
            ...document.querySelectorAll('[role="dialog"],[role="alertdialog"]'),
          ].filter((dialog) => {
            const rect = dialog.getBoundingClientRect();
            return rect.width && rect.height && getComputedStyle(dialog).visibility !== 'hidden';
          });
          if (!dialogs.length) return { state: 'absent' };
          if (dialogs.length !== 1) return { state: 'unknown' };
          const dialog = dialogs[0];
          const title = document
            .getElementById(dialog.getAttribute('aria-labelledby'))
            ?.textContent.trim();
          const button = dialog.querySelector('button#DialogActionButton');
          if (
            title !== 'Do you want to delete this sheet?' ||
            !button ||
            !dialog.querySelector('button#DialogCancelButton') ||
            button.disabled
          )
            return { state: 'unknown' };
          const rect = button.getBoundingClientRect();
          if (!rect.width || !rect.height) return { state: 'unknown' };
          return {
            state: 'confirm',
            point: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
          };
        });
        if (confirmation.state === 'unknown')
          throw new Error('The deletion confirmation is not recognized; it was not accepted');
        if (confirmation.state === 'confirm') {
          await clickFramePoint(page, frame, confirmation.point);
          confirmed = true;
        }
      }
      await pause(100);
    } while (Date.now() < deadline);
    throw new Error('Worksheet removal was not confirmed');
  } catch (error) {
    throw new Error(
      `Worksheet deletion or persistence is unverified: ${error.message}. Inspect the worksheet list before retrying`,
      { cause: error },
    );
  }
}
