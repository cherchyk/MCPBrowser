import { InformationalResponse } from '../../../core/responses.js';
import { ensureExcelEditor } from '../helpers.js';

export async function prepareEditor(page, params) {
  const result = await ensureExcelEditor(page, params);
  if (result.status === 'authentication_required') {
    return new InformationalResponse(
      'Microsoft authentication is required before Excel can be opened.',
      'authentication_required',
      ['Complete sign-in, MFA, or consent in the browser, then retry the Excel action.'],
    );
  }

  return result;
}

export async function prepareEditableEditor(page, params) {
  const editor = await prepareEditor(page, params);
  if (editor instanceof InformationalResponse) return editor;
  if (editor.mode !== 'Edit')
    throw new Error('The Excel workbook is not in confirmed editing mode; no change was started');
  return editor;
}

export const nameParam = {
  name: 'name',
  type: 'string',
  description: 'New unique worksheet name, using Excel worksheet naming rules (1–31 characters)',
  required: true,
};

export const urlParam = {
  name: 'url',
  type: 'string',
  description: 'Optional Excel Online workbook URL',
  required: false,
};
export const sheetParam = {
  name: 'sheet',
  type: 'string',
  description: 'Exact worksheet tab name; defaults to the active worksheet',
  required: false,
};
export const cellParam = {
  name: 'cell',
  type: 'string',
  description: 'Single A1 cell, such as B2',
  required: true,
};
