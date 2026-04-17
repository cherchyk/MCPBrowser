/**
 * Output Schema Validation Tests
 * 
 * Validates that each action's Response class produces structuredContent
 * that conforms to its tool's outputSchema (especially additionalProperties: false).
 * 
 * This catches the MCP error:
 *   "Structured content does not match the tool's output schema: data must NOT have additional properties"
 */

import assert from 'assert';

// Response classes and tool definitions
import { FetchPageSuccessResponse, FETCH_WEBPAGE_TOOL } from '../../src/actions/fetch-page.js';
import { ClickWithFallbackResponse, CLICK_ELEMENT_TOOL } from '../../src/actions/click-element.js';
import { CloseTabSuccessResponse, CLOSE_TAB_TOOL } from '../../src/actions/close-tab.js';
import { ExecuteJavascriptResponse, EXECUTE_JAVASCRIPT_TOOL } from '../../src/actions/execute-javascript.js';
import { GetCurrentHtmlSuccessResponse, GET_CURRENT_HTML_TOOL } from '../../src/actions/get-current-html.js';
import { NavigateHistorySuccessResponse, NAVIGATE_HISTORY_TOOL } from '../../src/actions/navigate-history.js';
import { ScrollPageSuccessResponse, SCROLL_PAGE_TOOL } from '../../src/actions/scroll-page.js';
import { TakeScreenshotSuccessResponse, TAKE_SCREENSHOT_TOOL } from '../../src/actions/take-screenshot.js';
import { TypeTextSuccessResponse, TYPE_TEXT_TOOL } from '../../src/actions/type-text.js';
import { InformationalResponse, HttpStatusResponse, ErrorResponse } from '../../src/core/responses.js';

console.log('Testing Output Schema Validation (structuredContent vs outputSchema)');
console.log();

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('PASS: ' + name);
    passed++;
  } catch (err) {
    console.log('FAIL: ' + name);
    console.log('   ' + err.message);
    failed++;
  }
}

function validateAgainstSchema(structuredContent, outputSchema, toolName) {
  const schemaProps = outputSchema.properties || {};
  const required = outputSchema.required || [];
  if (outputSchema.additionalProperties === false) {
    const allowed = new Set(Object.keys(schemaProps));
    const actual = Object.keys(structuredContent);
    const extra = actual.filter(p => !allowed.has(p));
    if (extra.length > 0) {
      throw new Error(toolName + ': extra properties: [' + extra.join(', ') + ']. Allowed: [' + [...allowed].join(', ') + ']');
    }
  }
  for (const field of required) {
    if (!(field in structuredContent)) {
      throw new Error(toolName + ': missing required field ' + field);
    }
  }
  for (const [key, schemaDef] of Object.entries(schemaProps)) {
    if (!(key in structuredContent)) continue;
    const value = structuredContent[key];
    if (value === null || value === undefined) continue;
    const schemaType = Array.isArray(schemaDef.type) ? schemaDef.type[0] : schemaDef.type;
    if (schemaType === 'string' && typeof value !== 'string') throw new Error(toolName + '.' + key + ': expected string');
    if (schemaType === 'number' && typeof value !== 'number') throw new Error(toolName + '.' + key + ': expected number');
    if (schemaType === 'boolean' && typeof value !== 'boolean') throw new Error(toolName + '.' + key + ': expected boolean');
    if (schemaType === 'array' && !Array.isArray(value)) throw new Error(toolName + '.' + key + ': expected array');
    if (schemaType === 'object' && (typeof value !== 'object' || Array.isArray(value))) throw new Error(toolName + '.' + key + ': expected object');
  }
}

// fetch_webpage
test('fetch_webpage: success response matches outputSchema', () => {
  const r = new FetchPageSuccessResponse('https://example.com', '<html></html>', ['next'], []);
  const m = r.toMcpFormat();
  assert.ok(m.structuredContent, 'Should have structuredContent');
  validateAgainstSchema(m.structuredContent, FETCH_WEBPAGE_TOOL.outputSchema, 'fetch_webpage');
});

test('fetch_webpage: with recommendedPlugins matches outputSchema', () => {
  const r = new FetchPageSuccessResponse('https://mail.google.com', '<html></html>', ['next'], [{ name: 'gmail' }]);
  validateAgainstSchema(r.toMcpFormat().structuredContent, FETCH_WEBPAGE_TOOL.outputSchema, 'fetch_webpage');
});

test('fetch_webpage: has all required fields', () => {
  const sc = new FetchPageSuccessResponse('https://example.com', '<html></html>', ['next'], []).toMcpFormat().structuredContent;
  for (const f of FETCH_WEBPAGE_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// click_element
test('click_element: success response matches outputSchema', () => {
  const r = new ClickWithFallbackResponse({ status: 'success', fallbackUsed: false, nativeAttempt: { status: 'success', durationMs: 150 }, fallbackAttempt: null, postClickWait: { applied: true, waitedMs: 1000 }, currentUrl: 'https://example.com', html: '<html></html>', message: 'Clicked', nextSteps: ['next'], recommendedPlugins: [] });
  validateAgainstSchema(r.toMcpFormat().structuredContent, CLICK_ELEMENT_TOOL.outputSchema, 'click_element');
});

test('click_element: with fallback and plugins matches outputSchema', () => {
  const r = new ClickWithFallbackResponse({ status: 'success', fallbackUsed: true, nativeAttempt: { status: 'timeout', durationMs: 5000, error: 'timeout' }, fallbackAttempt: { status: 'success', durationMs: 50 }, postClickWait: { applied: true, waitedMs: 1000 }, currentUrl: 'https://mail.google.com', html: '<html></html>', message: 'Clicked', nextSteps: ['next'], recommendedPlugins: [{ name: 'gmail' }] });
  validateAgainstSchema(r.toMcpFormat().structuredContent, CLICK_ELEMENT_TOOL.outputSchema, 'click_element');
});

test('click_element: has all required fields', () => {
  const r = new ClickWithFallbackResponse({ status: 'success', fallbackUsed: false, nativeAttempt: { status: 'success', durationMs: 100 }, fallbackAttempt: null, postClickWait: { applied: false, waitedMs: 0 }, currentUrl: 'https://example.com', html: '<html></html>', message: 'Clicked', nextSteps: ['next'] });
  const sc = r.toMcpFormat().structuredContent;
  for (const f of CLICK_ELEMENT_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// close_tab
test('close_tab: success response matches outputSchema', () => {
  const r = new CloseTabSuccessResponse('Closed', 'example.com', ['next']);
  validateAgainstSchema(r.toMcpFormat().structuredContent, CLOSE_TAB_TOOL.outputSchema, 'close_tab');
});

test('close_tab: has all required fields', () => {
  const sc = new CloseTabSuccessResponse('Closed', 'example.com', ['next']).toMcpFormat().structuredContent;
  for (const f of CLOSE_TAB_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// execute_javascript
test('execute_javascript: success response matches outputSchema', () => {
  const r = new ExecuteJavascriptResponse({ result: 42, type: 'number', executionTimeMs: 15, truncated: false, urlChanged: false, currentUrl: 'https://example.com', error: null, nextSteps: ['next'], recommendedPlugins: [] });
  validateAgainstSchema(r.toMcpFormat().structuredContent, EXECUTE_JAVASCRIPT_TOOL.outputSchema, 'execute_javascript');
});

test('execute_javascript: with error matches outputSchema', () => {
  const r = new ExecuteJavascriptResponse({ result: null, type: 'error', executionTimeMs: 5, truncated: false, urlChanged: false, currentUrl: 'https://example.com', error: { message: 'fail' }, nextSteps: ['fix'], recommendedPlugins: [] });
  validateAgainstSchema(r.toMcpFormat().structuredContent, EXECUTE_JAVASCRIPT_TOOL.outputSchema, 'execute_javascript');
});

test('execute_javascript: has all required fields', () => {
  const r = new ExecuteJavascriptResponse({ result: 'hi', type: 'string', executionTimeMs: 10, truncated: false, urlChanged: false, currentUrl: 'https://example.com', error: null, nextSteps: ['next'] });
  const sc = r.toMcpFormat().structuredContent;
  for (const f of EXECUTE_JAVASCRIPT_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// get_current_html
test('get_current_html: success response matches outputSchema', () => {
  const r = new GetCurrentHtmlSuccessResponse('https://example.com', '<html></html>', ['next'], []);
  validateAgainstSchema(r.toMcpFormat().structuredContent, GET_CURRENT_HTML_TOOL.outputSchema, 'get_current_html');
});

test('get_current_html: with plugins matches outputSchema', () => {
  const r = new GetCurrentHtmlSuccessResponse('https://calendar.google.com', '<html></html>', ['next'], [{ name: 'gcal' }]);
  validateAgainstSchema(r.toMcpFormat().structuredContent, GET_CURRENT_HTML_TOOL.outputSchema, 'get_current_html');
});

test('get_current_html: has all required fields', () => {
  const sc = new GetCurrentHtmlSuccessResponse('https://example.com', '<html></html>', ['next'], []).toMcpFormat().structuredContent;
  for (const f of GET_CURRENT_HTML_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// navigate_history
test('navigate_history: success response matches outputSchema', () => {
  const r = new NavigateHistorySuccessResponse('back', 'https://a.com', 'https://b.com', '<html></html>', ['next']);
  validateAgainstSchema(r.toMcpFormat().structuredContent, NAVIGATE_HISTORY_TOOL.outputSchema, 'navigate_history');
});

test('navigate_history: has all required fields', () => {
  const sc = new NavigateHistorySuccessResponse('forward', 'https://a.com', 'https://b.com', '<html></html>', ['next']).toMcpFormat().structuredContent;
  for (const f of NAVIGATE_HISTORY_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// scroll_page
test('scroll_page: success response matches outputSchema', () => {
  const r = new ScrollPageSuccessResponse('https://example.com', 0, 500, 1920, 5000, 1920, 1080, ['next']);
  validateAgainstSchema(r.toMcpFormat().structuredContent, SCROLL_PAGE_TOOL.outputSchema, 'scroll_page');
});

test('scroll_page: has all required fields', () => {
  const sc = new ScrollPageSuccessResponse('https://example.com', 0, 0, 1920, 1080, 1920, 1080, ['next']).toMcpFormat().structuredContent;
  for (const f of SCROLL_PAGE_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// take_screenshot
test('take_screenshot: success response matches outputSchema', () => {
  const r = new TakeScreenshotSuccessResponse('https://example.com', 'base64data', 'image/png', ['next']);
  validateAgainstSchema(r.toMcpFormat().structuredContent, TAKE_SCREENSHOT_TOOL.outputSchema, 'take_screenshot');
});

test('take_screenshot: has all required fields', () => {
  const sc = new TakeScreenshotSuccessResponse('https://example.com', 'data', 'image/png', ['next']).toMcpFormat().structuredContent;
  for (const f of TAKE_SCREENSHOT_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// type_text
test('type_text: success response matches outputSchema', () => {
  const r = new TypeTextSuccessResponse('https://example.com', 'Typed hello', '<html></html>', ['next']);
  validateAgainstSchema(r.toMcpFormat().structuredContent, TYPE_TEXT_TOOL.outputSchema, 'type_text');
});

test('type_text: with null html matches outputSchema', () => {
  const r = new TypeTextSuccessResponse('https://example.com', 'Typed', null, ['next']);
  validateAgainstSchema(r.toMcpFormat().structuredContent, TYPE_TEXT_TOOL.outputSchema, 'type_text');
});

test('type_text: has all required fields', () => {
  const sc = new TypeTextSuccessResponse('https://example.com', 'Typed', '<html></html>', ['next']).toMcpFormat().structuredContent;
  for (const f of TYPE_TEXT_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// Cross-cutting: non-success responses omit structuredContent
test('InformationalResponse omits structuredContent (avoids schema violations)', () => {
  const r = new InformationalResponse('Page not loaded', 'No page found', ['Fetch first']);
  const m = r.toMcpFormat();
  assert.strictEqual(m.isError, false);
  assert.strictEqual(m.structuredContent, undefined, 'InformationalResponse must not have structuredContent');
  assert.ok(m.content[0].text.includes('Page not loaded'));
});

test('HttpStatusResponse omits structuredContent (avoids schema violations)', () => {
  const r = new HttpStatusResponse('https://example.com', 404, 'Not Found', '<html></html>');
  const m = r.toMcpFormat();
  assert.strictEqual(m.isError, false);
  assert.strictEqual(m.structuredContent, undefined, 'HttpStatusResponse must not have structuredContent');
  assert.ok(m.content[0].text.includes('404'));
});

test('ErrorResponse omits structuredContent (per MCP spec)', () => {
  const r = new ErrorResponse('Something broke', ['Try again']);
  const m = r.toMcpFormat();
  assert.strictEqual(m.isError, true);
  assert.strictEqual(m.structuredContent, undefined, 'ErrorResponse must not have structuredContent');
});

// Summary
console.log();
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
