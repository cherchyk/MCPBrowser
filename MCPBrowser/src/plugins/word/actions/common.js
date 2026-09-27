import { ErrorResponse, InformationalResponse } from '../../../core/responses.js';
import { ensureWordEditor } from '../helpers.js';

export async function prepareEditor(page, params, defaultMode) {
  const result = await ensureWordEditor(page, {
    url: params?.url,
    mode: params?.mode ?? defaultMode
  });
  if (result.status === 'ready') return result;
  if (result.status === 'user_action_required') {
    return new InformationalResponse(
      'Microsoft authentication is required before Word can be opened.',
      result.reason,
      ['Complete sign-in, MFA, or consent in the browser window, then retry the Word action.']
    );
  }
  const messages = {
    launch_form_missing: 'No Word Online launch form was found. Open a specific Word document rather than the Word home page.',
    unexpected_editor_origin: 'The document did not navigate to an approved Microsoft Office Online editor origin.',
    read_only: 'The document is read-only or the requested edit mode is unavailable.',
    editor_missing: 'The Word document editing surface did not appear before the timeout.',
    editor_not_visible: 'The Word document editing surface is present but not visible.'
  };
  return new ErrorResponse(
    messages[result.status] || `Word editor preparation failed: ${result.status}`,
    ['Verify the document URL and permissions, then retry.', 'Use browser_fetch_webpage to inspect the current page if the UI changed.']
  );
}

export function isPreparationResponse(value) {
  return value instanceof ErrorResponse || value instanceof InformationalResponse;
}
