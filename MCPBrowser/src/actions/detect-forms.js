/**
 * detect-forms.js - Auto Form Discovery
 * Scans the current page and returns structured JSON of all forms,
 * their fields, submit buttons, and orphaned inputs (common in SPAs).
 */

import { getBrowser, getValidatedPage } from '../core/browser.js';
import { MCPResponse, InformationalResponse } from '../core/responses.js';
import logger from '../core/logger.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// RESPONSE CLASS
// ============================================================================

/**
 * Response for successful detect_forms operations
 */
export class DetectFormsResponse extends MCPResponse {
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
      summary: this.summary
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
export const DETECT_FORMS_TOOL = {
  name: "detect_forms",
  title: "Detect Forms",
  description: "**AUTO FORM DISCOVERY** - Scans the current page and returns structured JSON of all forms: fields (name, type, required, placeholder, current value, validation constraints), submit buttons, and orphaned inputs not inside any <form> (common in SPAs). Use this BEFORE filling forms to understand what fields exist and how to interact with them.\n\n**PREREQUISITE**: Page MUST be loaded with fetch_webpage first.",
  inputSchema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL of the already-loaded page" },
      includeHidden: { type: "boolean", default: false, description: "Include hidden fields (type=hidden). Useful for understanding form state." }
    },
    required: ["url"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      forms: {
        type: "array",
        items: {
          type: "object",
          properties: {
            formSelector: { type: "string" },
            action: { type: "string" },
            method: { type: "string" },
            formType: { type: "string" },
            fields: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  selector: { type: "string" },
                  name: { type: "string" },
                  id: { type: "string" },
                  tag: { type: "string" },
                  type: { type: "string" },
                  required: { type: "boolean" },
                  placeholder: { type: "string" },
                  currentValue: { type: "string" },
                  label: { type: "string" },
                  validation: {
                    type: "object",
                    properties: {
                      min: { type: "string" },
                      max: { type: "string" },
                      pattern: { type: "string" },
                      maxLength: { type: "number" }
                    }
                  }
                }
              }
            },
            submitButton: {
              type: ["object", "null"],
              properties: {
                selector: { type: "string" },
                text: { type: "string" },
                type: { type: "string" }
              }
            }
          }
        },
        description: "Array of detected forms with fields and metadata"
      },
      orphanedFields: {
        type: "array",
        items: { type: "object" },
        description: "Input/select/textarea elements not inside any <form>"
      },
      totalFieldCount: { type: "number", description: "Total number of fields found" },
      summary: { type: "string", description: "Human-readable summary of detected forms" },
      nextSteps: {
        type: "array",
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["forms", "orphanedFields", "totalFieldCount", "summary", "nextSteps"],
    additionalProperties: false
  }
};

// ============================================================================
// PAGE EVALUATION FUNCTION
// ============================================================================

/**
 * Runs inside the browser context via page.evaluate().
 * Scans all forms and orphaned fields, resolves labels, classifies form types.
 * @param {boolean} includeHidden - Whether to include hidden fields
 * @returns {Object} Raw form data
 */
function buildScanFunction(includeHidden) {
  return (includeHidden) => {
    /**
     * Build a CSS selector for an element
     */
    function buildSelector(el) {
      if (el.id) return `#${CSS.escape(el.id)}`;
      if (el.name) {
        const tag = el.tagName.toLowerCase();
        const sel = `${tag}[name="${CSS.escape(el.name)}"]`;
        if (document.querySelectorAll(sel).length === 1) return sel;
      }
      // Fallback: nth-of-type relative to parent
      const parent = el.parentElement;
      if (!parent) return el.tagName.toLowerCase();
      const tag = el.tagName.toLowerCase();
      const siblings = Array.from(parent.children).filter(c => c.tagName === el.tagName);
      if (siblings.length === 1) return `${buildSelector(parent)} > ${tag}`;
      const idx = siblings.indexOf(el) + 1;
      return `${buildSelector(parent)} > ${tag}:nth-of-type(${idx})`;
    }

    /**
     * Resolve label text for a field element
     * Priority: <label for> → parent <label> → aria-label → aria-labelledby → placeholder
     */
    function resolveLabel(el) {
      // 1. Explicit <label for="id">
      if (el.id) {
        const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (label) return label.textContent.trim();
      }
      // 2. Parent <label> wrapping the input
      const parentLabel = el.closest('label');
      if (parentLabel) {
        // Get text content excluding the input itself
        const clone = parentLabel.cloneNode(true);
        clone.querySelectorAll('input, select, textarea').forEach(c => c.remove());
        const text = clone.textContent.trim();
        if (text) return text;
      }
      // 3. aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();
      // 4. aria-labelledby
      const ariaLabelledBy = el.getAttribute('aria-labelledby');
      if (ariaLabelledBy) {
        const refEl = document.getElementById(ariaLabelledBy);
        if (refEl) return refEl.textContent.trim();
      }
      // 5. placeholder
      const placeholder = el.getAttribute('placeholder');
      if (placeholder) return placeholder.trim();
      return '';
    }

    /**
     * Extract field info from an input/select/textarea element
     */
    function extractField(el) {
      const tag = el.tagName.toLowerCase();
      const type = el.getAttribute('type') || (tag === 'select' ? 'select' : tag === 'textarea' ? 'textarea' : 'text');
      return {
        selector: buildSelector(el),
        name: el.name || '',
        id: el.id || '',
        tag,
        type,
        required: el.required || el.getAttribute('aria-required') === 'true',
        placeholder: el.getAttribute('placeholder') || '',
        currentValue: el.value || '',
        label: resolveLabel(el),
        validation: {
          min: el.getAttribute('min') || '',
          max: el.getAttribute('max') || '',
          pattern: el.getAttribute('pattern') || '',
          maxLength: el.maxLength >= 0 ? el.maxLength : null
        }
      };
    }

    /**
     * Find the submit button for a form
     */
    function findSubmitButton(form) {
      // Explicit submit button
      const submit = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submit) {
        return {
          selector: buildSelector(submit),
          text: (submit.textContent || submit.value || '').trim(),
          type: submit.getAttribute('type') || 'submit'
        };
      }
      // Fallback: first <button> without type (default is submit)
      const btn = form.querySelector('button:not([type])');
      if (btn) {
        return {
          selector: buildSelector(btn),
          text: btn.textContent.trim(),
          type: 'submit'
        };
      }
      return null;
    }

    /**
     * Classify form type via heuristics
     */
    function classifyForm(fields, form) {
      const visibleFields = fields.filter(f => f.type !== 'hidden');
      const hasPassword = visibleFields.some(f => f.type === 'password');
      const hasEmail = visibleFields.some(f => f.type === 'email' || f.name.includes('email') || f.id.includes('email'));
      const hasTextarea = visibleFields.some(f => f.tag === 'textarea');
      const hasSearch = visibleFields.some(f => f.type === 'search');

      // Check for credit card patterns
      const cardPatterns = /card|cc[-_]?num|cvv|cvc|expir|ccv/i;
      const hasCardFields = visibleFields.some(f =>
        cardPatterns.test(f.name) || cardPatterns.test(f.id) || cardPatterns.test(f.label)
      );

      if (hasCardFields) return 'checkout';
      if (hasPassword && visibleFields.length <= 3) return 'login';
      if (hasPassword && hasEmail && visibleFields.length > 3) return 'registration';
      if (hasSearch) return 'search';
      if (hasTextarea && hasEmail && !hasPassword) return 'contact';

      // Check form action/class for search hints
      const formAction = (form.getAttribute('action') || '').toLowerCase();
      const formClass = (form.getAttribute('class') || '').toLowerCase();
      const formRole = (form.getAttribute('role') || '').toLowerCase();
      if (formRole === 'search' || formAction.includes('search') || formClass.includes('search')) return 'search';

      // Single text input with submit = likely search
      if (visibleFields.length === 1 && (visibleFields[0].type === 'text' || visibleFields[0].type === 'search')) return 'search';

      return 'other';
    }

    const fieldSelector = 'input, select, textarea';
    const forms = [];

    // Process each <form> element
    document.querySelectorAll('form').forEach((form, index) => {
      const fieldElements = Array.from(form.querySelectorAll(fieldSelector));
      let fields = fieldElements.map(extractField);

      // Filter hidden fields unless includeHidden
      if (!includeHidden) {
        fields = fields.filter(f => f.type !== 'hidden');
      }

      forms.push({
        formSelector: buildSelector(form),
        action: form.getAttribute('action') || '',
        method: (form.getAttribute('method') || 'GET').toUpperCase(),
        formType: classifyForm(fields, form),
        fields,
        submitButton: findSubmitButton(form)
      });
    });

    // Collect orphaned fields (not inside any <form>)
    const allFields = Array.from(document.querySelectorAll(fieldSelector));
    let orphanedFields = allFields
      .filter(el => !el.closest('form'))
      .map(extractField);

    if (!includeHidden) {
      orphanedFields = orphanedFields.filter(f => f.type !== 'hidden');
    }

    const totalFieldCount = forms.reduce((sum, f) => sum + f.fields.length, 0) + orphanedFields.length;

    return { forms, orphanedFields, totalFieldCount };
  };
}

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
export async function detectForms({ url, includeHidden = false }) {
  logger.info(`detect_forms called: url=${url}, includeHidden=${includeHidden}`);

  if (!url) {
    throw new Error("url parameter is required");
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
    logger.error(`detect_forms: Failed to connect to browser: ${err.message}`);
    return new InformationalResponse(
      `Browser connection failed: ${err.message}`,
      'The browser must be running with remote debugging enabled.',
      [
        'Ensure the browser is installed and running',
        'Check that remote debugging is enabled (--remote-debugging-port)',
        'Try restarting the MCP server'
      ]
    );
  }

  // Validate page exists and is usable
  const { page, error: pageError } = await getValidatedPage(hostname);

  if (!page) {
    const isConnectionLost = pageError && pageError.includes('connection');
    logger.debug(`detect_forms: ${pageError || 'No page found for ' + hostname}`);
    return new InformationalResponse(
      isConnectionLost ? `Page connection lost for ${hostname}` : `No open page found for ${hostname}`,
      isConnectionLost
        ? 'The browser tab was closed or the connection was lost. The page needs to be reloaded.'
        : 'The page must be loaded before you can detect forms',
      [
        "Use MCPBrowser's fetch_webpage tool to load the page first",
        "Then retry MCPBrowser's detect_forms with the same URL"
      ]
    );
  }

  try {
    const scanFn = buildScanFunction(includeHidden);
    const raw = await page.evaluate(scanFn, includeHidden);

    // Build summary
    const summary = buildSummary(raw.forms, raw.orphanedFields, raw.totalFieldCount);

    logger.info(`detect_forms completed: ${summary}`);

    // Build next steps based on discovered forms
    const nextSteps = buildNextSteps(raw.forms, raw.orphanedFields);

    return new DetectFormsResponse({
      forms: raw.forms,
      orphanedFields: raw.orphanedFields,
      totalFieldCount: raw.totalFieldCount,
      summary,
      nextSteps
    });
  } catch (err) {
    logger.error(`detect_forms failed: ${err.message}`);
    return new InformationalResponse(
      `Failed to detect forms: ${err.message}`,
      'Could not scan the page for forms. The page may have navigated away or the connection was lost.',
      [
        "Try MCPBrowser's fetch_webpage to reload the page",
        "Use MCPBrowser's close_tab and start fresh if needed"
      ]
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
    const formDescriptions = forms.map(f => {
      const fieldCount = f.fields.length;
      return `1 ${f.formType} form (${fieldCount} field${fieldCount !== 1 ? 's' : ''})`;
    });
    parts.push(formDescriptions.join(', '));
  }
  if (orphanedFields.length > 0) {
    parts.push(`${orphanedFields.length} orphaned field${orphanedFields.length !== 1 ? 's' : ''} (not in any form)`);
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
      steps.push(`Use MCPBrowser's type_text to fill form fields (e.g., selector: '${firstField.selector}')`);
    }
    if (primaryForm.submitButton) {
      steps.push(`Use MCPBrowser's click_element to submit the form (selector: '${primaryForm.submitButton.selector}')`);
    }
  }

  if (orphanedFields.length > 0) {
    steps.push("Use MCPBrowser's type_text for orphaned fields (SPA inputs not inside a <form>)");
  }

  steps.push("Use MCPBrowser's take_screenshot if form layout is unclear from the data");
  steps.push("Use MCPBrowser's get_current_html to see full page HTML");

  return steps;
}
