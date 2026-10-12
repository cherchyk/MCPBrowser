/**
 * detect-forms.js - Auto Form Discovery
 * Scans the current page and returns structured JSON of all forms,
 * their fields, submit buttons, and orphaned inputs (common in SPAs).
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import { CoreAction } from '../core/actions.js';
import logger from '../core/logger.js';
import { scanPageForms } from '../core/form-scanner.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful detect_forms operations
 */
class DetectFormsResponse extends MCPResponse {
  /**
   * @param {Object} params
   * @param {Array} params.forms - Array of form objects
   * @param {Array} params.orphanedFields - Fields not inside any <form>
   * @param {number} params.totalFieldCount - Total number of fields found
   * @param {string} params.summary - Human-readable summary
   * @param {string[]} params.nextSteps - Suggested next actions
   */
  constructor({ forms, orphanedFields, totalFieldCount, summary, nextSteps = [] }) {
    super(nextSteps);

    if (!Array.isArray(forms)) {
      throw new TypeError('forms must be an array');
    }
    if (!Array.isArray(orphanedFields)) {
      throw new TypeError('orphanedFields must be an array');
    }
    if (typeof totalFieldCount !== 'number') {
      throw new TypeError('totalFieldCount must be a number');
    }
    if (typeof summary !== 'string') {
      throw new TypeError('summary must be a string');
    }

    this.forms = forms;
    this.orphanedFields = orphanedFields;
    this.totalFieldCount = totalFieldCount;
    this.summary = summary;
  }

  _getAdditionalFields() {
    return {
      forms: this.forms,
      orphanedFields: this.orphanedFields,
      totalFieldCount: this.totalFieldCount,
      summary: this.summary,
    };
  }

  getTextSummary() {
    return this.summary;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
const DETECT_FORMS_TOOL = {
  name: 'browser_detect_forms',
  title: 'Detect Forms',
  description:
    'Scan a browser-loaded page and return all forms as structured JSON — fields, types, validation rules, submit buttons, and orphaned inputs. Use when: you need to understand a form before filling it, discover what fields exist on a page, or map form structure for automation. PREREQUISITE: Page must be loaded with browser_fetch_webpage first.',
  inputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL of the already-loaded page' },
      // includeHidden: { type: "boolean", default: false, description: "Include hidden fields (type=hidden). Useful for understanding form state." }
    },
    required: ['url'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: {
      forms: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            formSelector: { type: 'string' },
            action: { type: 'string' },
            method: { type: 'string' },
            formType: { type: 'string' },
            fields: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  selector: { type: 'string' },
                  name: { type: 'string' },
                  id: { type: 'string' },
                  tag: { type: 'string' },
                  type: { type: 'string' },
                  required: { type: 'boolean' },
                  placeholder: { type: 'string' },
                  currentValue: { type: 'string' },
                  label: { type: 'string' },
                  validation: {
                    type: 'object',
                    properties: {
                      min: { type: 'string' },
                      max: { type: 'string' },
                      pattern: { type: 'string' },
                      maxLength: { type: 'number' },
                    },
                  },
                },
              },
            },
            submitButton: {
              type: 'object',
              properties: {
                selector: { type: 'string' },
                text: { type: 'string' },
                type: { type: 'string' },
              },
            },
          },
        },
        description: 'Array of detected forms with fields and metadata',
      },
      orphanedFields: {
        type: 'array',
        items: { type: 'object' },
        description: 'Input/select/textarea elements not inside any <form>',
      },
      totalFieldCount: { type: 'number', description: 'Total number of fields found' },
      summary: { type: 'string', description: 'Human-readable summary of detected forms' },
      nextSteps: {
        type: 'array',
        items: { type: 'string' },
        description: 'Suggested next actions',
      },
    },
    required: ['forms', 'orphanedFields', 'totalFieldCount', 'summary', 'nextSteps'],
    additionalProperties: false,
  },
  annotations: {
    title: 'Detect Forms',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
};

export const DETECT_FORMS_ACTION = new CoreAction({
  tool: DETECT_FORMS_TOOL,
  response: DetectFormsResponse,
  handler: detectForms,
});

// ============================================================================
// ACTION FUNCTION
// ============================================================================

/**
 * Detect all forms on the current page
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page to scan
 * @param {boolean} [params.includeHidden=false] - Whether to include hidden fields
 * @returns {Promise<DetectFormsResponse|InformationalResponse>}
 */
async function detectForms({ url, includeHidden = false }) {
  logger.info(`browser_detect_forms called: url=${url}, includeHidden=${includeHidden}`);

  if (!url) {
    throw new Error('url parameter is required');
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Ensure browser connection
  try {
    await getBrowser();
  } catch (err) {
    logger.error(`browser_detect_forms: Failed to connect to browser: ${err.message}`);
    return new InformationalResponse(
      `Browser connection failed: ${err.message}`,
      'The browser must be running with remote debugging enabled.',
      [
        'Ensure the browser is installed and running',
        'Check that remote debugging is enabled (--remote-debugging-port)',
        'Try restarting the MCP server',
      ],
    );
  }

  // Validate page exists and is usable
  const { page, error: pageError } = await getValidatedPage(hostname);

  if (!page) {
    const isConnectionLost = pageError && pageError.includes('connection');
    logger.debug(`browser_detect_forms: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost
        ? `Page connection lost for ${hostname}`
        : `No open page found for ${hostname}`,
      isConnectionLost
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can detect forms',
      [
        "Use MCPBrowser's browser_fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's browser_detect_forms with the same URL",
      ],
    );
  }

  try {
    const raw = await scanPageForms(page, includeHidden);

    // Build summary
    const summary = buildSummary(raw.forms, raw.orphanedFields, raw.totalFieldCount);

    logger.info(`browser_detect_forms completed: ${summary}`);

    // Build next steps based on discovered forms
    const nextSteps = buildNextSteps(raw.forms, raw.orphanedFields);

    return new DetectFormsResponse({
      forms: raw.forms,
      orphanedFields: raw.orphanedFields,
      totalFieldCount: raw.totalFieldCount,
      summary,
      nextSteps,
    });
  } catch (err) {
    logger.error(`browser_detect_forms failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to detect forms: ${err.message}`,
      'Could not scan the page for forms. The page may have navigated away or the connection was lost.',
      [
        "Try MCPBrowser's browser_fetch_webpage to reload the page",
        "Use MCPBrowser's browser_close_tab and start fresh if needed",
      ],
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a human-readable summary of detected forms
 */
function buildSummary(forms, orphanedFields, totalFieldCount) {
  if (forms.length === 0 && orphanedFields.length === 0) {
    return 'No forms or input fields found on this page';
  }

  const parts = [];
  if (forms.length > 0) {
    const formDescriptions = forms.map((f) => {
      const fieldCount = f.fields.length;
      return `1 ${f.formType} form (${fieldCount} field${fieldCount !== 1 ? 's' : ''})`;
    });
    parts.push(formDescriptions.join(', '));
  }
  if (orphanedFields.length > 0) {
    parts.push(
      `${orphanedFields.length} orphaned field${orphanedFields.length !== 1 ? 's' : ''} (not in any form)`,
    );
  }

  return `Found ${forms.length} form${forms.length !== 1 ? 's' : ''}: ${parts.join('; ')}. Total fields: ${totalFieldCount}`;
}

/**
 * Build contextual next steps based on what was found
 */
function buildNextSteps(forms, orphanedFields) {
  const steps = [];

  if (forms.length > 0) {
    const primaryForm = forms[0];
    if (primaryForm.fields.length > 0) {
      const firstField = primaryForm.fields[0];
      steps.push(
        `Use MCPBrowser's browser_type_text to fill form fields (e.g., selector: '${firstField.selector}')`,
      );
    }
    if (primaryForm.submitButton) {
      steps.push(
        `Use MCPBrowser's browser_click_element to submit the form (selector: '${primaryForm.submitButton.selector}')`,
      );
    }
  }

  if (orphanedFields.length > 0) {
    steps.push(
      "Use MCPBrowser's browser_type_text for orphaned fields (SPA inputs not inside a <form>)",
    );
  }

  steps.push(
    "Use MCPBrowser's browser_take_screenshot with fullPage=true if form layout is unclear from the data",
  );
  steps.push("Use MCPBrowser's browser_get_current_html to see full page HTML");

  return steps;
}
