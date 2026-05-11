/**
 * cli/registry.js — Single source of truth for all CLI commands.
 *
 * To add a new CLI command:
 *   1. Import the MCP TOOL definition and action function
 *   2. Add an entry to CLI_REGISTRY below
 *   3. Done — help, routing, flag mapping, coercion all auto-update
 */

import { writeFileSync } from 'fs';

import { fetchPage, FETCH_WEBPAGE_TOOL } from '../actions/fetch-page.js';
import { clickElement, CLICK_ELEMENT_TOOL } from '../actions/click-element.js';
import { typeText, TYPE_TEXT_TOOL } from '../actions/type-text.js';
import { executeJavascript, EXECUTE_JAVASCRIPT_TOOL } from '../actions/execute-javascript.js';
import { getCurrentHtml, GET_CURRENT_HTML_TOOL } from '../actions/get-current-html.js';
import { takeScreenshot, TAKE_SCREENSHOT_TOOL } from '../actions/take-screenshot.js';
import { scrollPage, SCROLL_PAGE_TOOL } from '../actions/scroll-page.js';
import { navigateHistory, NAVIGATE_HISTORY_TOOL } from '../actions/navigate-history.js';
import { closeTab, CLOSE_TAB_TOOL } from '../actions/close-tab.js';

import { htmlToText, getStructured, getPrimaryText } from './utils.js';

// ---------------------------------------------------------------------------
// Factory for back/forward (deduplicated)
// ---------------------------------------------------------------------------

function makeHistoryCommand(direction) {
  return {
    cmd: direction,
    tool: NAVIGATE_HISTORY_TOOL,
    action: navigateHistory,
    requiresFetch: true,
    flagMap: { raw: '_raw' },
    flagDefaults: {},
    buildParams: (url, flags) => ({
      url,
      direction,
      returnHtml: true,
      removeUnnecessaryHTML: !flags.raw,
    }),
    formatOutput: (mcp, flags) => {
      const s = getStructured(mcp);
      const out = {};
      if (s.previousUrl || s.currentUrl) {
        out.stderr = `${s.previousUrl || '?'} → ${s.currentUrl || '?'}`;
      }
      if (s.html) out.stdout = flags.raw ? s.html : htmlToText(s.html);
      return out;
    },
    examples: [`mcpbrowser ${direction} https://example.com`],
  };
}

// ---------------------------------------------------------------------------
// CLI_REGISTRY
// ---------------------------------------------------------------------------

export const CLI_REGISTRY = [
  {
    cmd: 'fetch',
    tool: FETCH_WEBPAGE_TOOL,
    action: fetchPage,
    requiresFetch: false,
    flagMap: { wait: 'postLoadWait', raw: '_raw' },
    flagDefaults: {},
    buildParams: (url, flags) => ({
      url,
      browser: flags.browser || '',
      removeUnnecessaryHTML: !flags.raw,
      postLoadWait: flags.wait ? Number(flags.wait) : 0
    }),
    formatOutput: (mcp, flags) => {
      const html = getStructured(mcp).html || getPrimaryText(mcp);
      return { stdout: flags.raw ? html : htmlToText(html) };
    },
    examples: [
      'mcpbrowser fetch https://eng.ms/docs/my-page',
      'mcpbrowser fetch https://portal.azure.com --browser edge --wait 5000',
      'mcpbrowser fetch https://github.com --raw',
    ],
    cliNote: '--raw    Output full HTML instead of extracted text',
  },

  {
    cmd: 'screenshot',
    tool: TAKE_SCREENSHOT_TOOL,
    action: takeScreenshot,
    requiresFetch: true,
    autoFetch: true, // screenshot auto-fetches the page first
    flagMap: { 'full-page': 'fullPage' },
    buildParams: (url, flags) => ({
      url,
      fullPage: !!flags['full-page']
    }),
    formatOutput: (mcp, flags) => {
      const base64 = getStructured(mcp).screenshotBase64;
      if (!base64) return { error: 'No screenshot data returned' };
      const outFile = flags.output || 'screenshot.png';
      writeFileSync(outFile, Buffer.from(base64, 'base64'));
      return { stderr: `Screenshot saved to ${outFile}` };
    },
    examples: [
      'mcpbrowser screenshot https://example.com --output page.png',
      'mcpbrowser screenshot https://dashboard.corp.com --full-page',
    ],
    cliNote: '--output <path>    File path to save (default: screenshot.png)',
  },

  {
    cmd: 'click',
    tool: CLICK_ELEMENT_TOOL,
    action: clickElement,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => ({
      url,
      selector: flags.selector || undefined,
      text: flags.text || undefined,
      returnHtml: flags.returnHtml !== 'false',
      removeUnnecessaryHTML: true,
      postClickWait: flags.postClickWait ? Number(flags.postClickWait) : 1000,
    }),
    validate: (flags) => {
      if (!flags.selector && !flags.text) return '--selector or --text is required for click';
    },
    formatOutput: (mcp) => {
      const html = getStructured(mcp).html;
      return { stdout: html ? htmlToText(html) : getPrimaryText(mcp) };
    },
    examples: [
      'mcpbrowser click https://example.com --selector "#login-btn"',
      'mcpbrowser click https://example.com --text "Sign In"',
    ],
  },

  {
    cmd: 'type',
    tool: TYPE_TEXT_TOOL,
    action: typeText,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => ({
      url,
      fields: [{ selector: flags.selector, text: flags.text }],
      returnHtml: false
    }),
    validate: (flags) => {
      if (!flags.selector || !flags.text) return '--selector and --text are required for type';
    },
    formatOutput: (mcp) => ({ stdout: getPrimaryText(mcp) }),
    examples: [
      'mcpbrowser type https://example.com --selector "#search" --text "query"',
      'mcpbrowser type https://login.com --selector "input[name=email]" --text "user@corp.com"',
    ],
    cliNote: 'CLI shorthand: --selector + --text fills a single field',
  },

  {
    cmd: 'exec',
    tool: EXECUTE_JAVASCRIPT_TOOL,
    action: executeJavascript,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => ({
      url,
      script: flags.script,
      timeoutMs: flags.timeoutMs ? Number(flags.timeoutMs) : 30000,
      returnType: flags.returnType || 'json',
    }),
    validate: (flags) => {
      if (!flags.script) return '--script is required for exec';
    },
    formatOutput: (mcp) => {
      const r = getStructured(mcp).result;
      if (r !== undefined && r !== null) {
        return { stdout: typeof r === 'string' ? r : JSON.stringify(r, null, 2) };
      }
      return { stdout: getPrimaryText(mcp) };
    },
    examples: [
      'mcpbrowser exec https://example.com --script "document.title"',
      'mcpbrowser exec https://mail.google.com --script "[...document.querySelectorAll(\'.zA\')].map(r=>r.textContent)"',
    ],
  },

  {
    cmd: 'html',
    tool: GET_CURRENT_HTML_TOOL,
    action: getCurrentHtml,
    requiresFetch: true,
    flagMap: { raw: '_raw' },
    buildParams: (url, flags) => ({
      url,
      removeUnnecessaryHTML: !flags.raw,
    }),
    formatOutput: (mcp) => ({ stdout: getStructured(mcp).html || getPrimaryText(mcp) }),
    examples: [
      'mcpbrowser html https://example.com',
      'mcpbrowser html https://example.com --raw',
    ],
    cliNote: '--raw    Output raw HTML without cleanup',
  },

  {
    cmd: 'scroll',
    tool: SCROLL_PAGE_TOOL,
    action: scrollPage,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => {
      const params = { url };
      if (flags.selector) { params.selector = flags.selector; }
      else if (flags.x !== undefined || flags.y !== undefined) {
        if (flags.x !== undefined) params.x = Number(flags.x);
        if (flags.y !== undefined) params.y = Number(flags.y);
      } else {
        params.direction = flags.direction || 'down';
        if (flags.amount) params.amount = Number(flags.amount);
      }
      return params;
    },
    formatOutput: (mcp) => {
      const s = getStructured(mcp);
      return {
        stdout: JSON.stringify({
          scrollX: s.scrollX, scrollY: s.scrollY,
          pageWidth: s.pageWidth, pageHeight: s.pageHeight,
          viewportWidth: s.viewportWidth, viewportHeight: s.viewportHeight
        }, null, 2)
      };
    },
    examples: [
      'mcpbrowser scroll https://example.com --direction down --amount 1000',
      'mcpbrowser scroll https://example.com --selector "#footer"',
      'mcpbrowser scroll https://example.com --x 0 --y 0',
    ],
  },

  makeHistoryCommand('back'),
  makeHistoryCommand('forward'),

  {
    cmd: 'close',
    tool: CLOSE_TAB_TOOL,
    action: closeTab,
    requiresFetch: false,
    flagMap: {},
    buildParams: (url) => ({ url }),
    formatOutput: (mcp) => ({ stdout: getPrimaryText(mcp) }),
    examples: ['mcpbrowser close https://example.com'],
  },
];

// Lookup map for O(1) command resolution
export const CMD_MAP = new Map(CLI_REGISTRY.map(entry => [entry.cmd, entry]));
