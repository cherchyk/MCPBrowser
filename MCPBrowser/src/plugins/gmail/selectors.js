/**
 * selectors.js — Tier 4 CSS class selectors for the Gmail plugin.
 *
 * TIER 4 ONLY — These are Closure Compiler-generated class names that may
 * change when Google deploys Gmail updates. All other interaction tiers
 * (T1: URL hash, T2: keyboard shortcuts, T3: ARIA / data attributes / name attrs)
 * are defined inline in helpers.js since they use stable identifiers.
 *
 * Per FR-023: All CSS class selectors are centralized here so a Gmail UI
 * update can be resolved by updating values in ONE place.
 *
 * Per SC-008: No action file should import CSS class names directly.
 * All CSS access goes through this module.
 *
 * Tier coverage (SC-007): ~73% of interactions use T1/T2 (URL + keyboard).
 * These T4 selectors cover only data extraction from email row internals
 * and thread message internals.
 *
 * @version 2026-04-03 — Verified against Gmail web UI
 */

// ============================================================================
// EMAIL LIST VIEW — Row internals (used by extractEmailRows)
// ============================================================================

/** Email row in list — no ARIA role="row" on Gmail's custom table rows */
export const EMAIL_ROW = 'tr.zA';

/** Unread email indicator — additional class on row, no aria-label */
export const EMAIL_ROW_UNREAD = 'zE';

/** Subject text within a row — no distinguishing data attribute */
export const SUBJECT_SPAN = 'span.bog';

/** Snippet/preview text within a row — no distinguishing data attribute */
export const SNIPPET_SPAN = 'span.y2';

/** Date cell within a row — no name or aria-label on date elements */
export const DATE_CELL = 'td.xW span';

// ============================================================================
// THREAD / MESSAGE VIEW — Message internals (used by read_email)
// ============================================================================

/** Individual message container within a thread — lacks ARIA roles */
export const MESSAGE_CONTAINER = 'div.adn';

/** Message body content div — the actual HTML body */
export const MSG_BODY = 'div.a3s.aiL';

/** Date span in message header — title attribute has full timestamp */
export const MSG_DATE = 'span.g3';

/** Thread subject heading — h2 can be T3 but .hP adds specificity */
export const THREAD_SUBJECT = 'h2.hP';

// ============================================================================
// ATTACHMENTS — Within message containers
// ============================================================================

/** Attachment area within a message */
export const ATTACHMENT_AREA = 'div.aQH';

/** Attachment filename */
export const ATTACHMENT_NAME = 'span.aV3';

/** Attachment file size */
export const ATTACHMENT_SIZE = 'span.SaH2Ve';

// ============================================================================
// LABEL PICKER — Dropdown items (used by label_email)
// ============================================================================

/** Individual label items in the label picker dropdown */
export const LABEL_ITEM = 'div.J-N-Jz';

// ============================================================================
// NO-RESULTS INDICATOR — Search empty state
// ============================================================================

/** No-results indicator in search/list view */
export const NO_RESULTS = 'td.TC';
