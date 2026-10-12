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

import {
  InformationalResponse,
  HttpStatusResponse,
  ErrorResponse,
} from '../../src/core/responses.js';
import { ACTIONS as CORE_ACTIONS } from '../../src/actions/index.js';

const FETCH_WEBPAGE_ACTION = CORE_ACTIONS.find((action) => action.id === 'browser_fetch_webpage');
const CLICK_ELEMENT_ACTION = CORE_ACTIONS.find((action) => action.id === 'browser_click_element');
const CLOSE_TAB_ACTION = CORE_ACTIONS.find((action) => action.id === 'browser_close_tab');
const EXECUTE_JAVASCRIPT_ACTION = CORE_ACTIONS.find(
  (action) => action.id === 'browser_execute_javascript',
);
const GET_CURRENT_HTML_ACTION = CORE_ACTIONS.find(
  (action) => action.id === 'browser_get_current_html',
);
const NAVIGATE_HISTORY_ACTION = CORE_ACTIONS.find(
  (action) => action.id === 'browser_navigate_history',
);
const SCROLL_PAGE_ACTION = CORE_ACTIONS.find((action) => action.id === 'browser_scroll_page');
const TAKE_SCREENSHOT_ACTION = CORE_ACTIONS.find(
  (action) => action.id === 'browser_take_screenshot',
);
const TYPE_TEXT_ACTION = CORE_ACTIONS.find((action) => action.id === 'browser_type_text');

const FetchPageSuccessResponse = FETCH_WEBPAGE_ACTION.response;
const FETCH_WEBPAGE_TOOL = FETCH_WEBPAGE_ACTION.tool;
const ClickWithFallbackResponse = CLICK_ELEMENT_ACTION.response;
const CLICK_ELEMENT_TOOL = CLICK_ELEMENT_ACTION.tool;
const CloseTabSuccessResponse = CLOSE_TAB_ACTION.response;
const CLOSE_TAB_TOOL = CLOSE_TAB_ACTION.tool;
const ExecuteJavascriptResponse = EXECUTE_JAVASCRIPT_ACTION.response;
const EXECUTE_JAVASCRIPT_TOOL = EXECUTE_JAVASCRIPT_ACTION.tool;
const GetCurrentHtmlSuccessResponse = GET_CURRENT_HTML_ACTION.response;
const GET_CURRENT_HTML_TOOL = GET_CURRENT_HTML_ACTION.tool;
const NavigateHistorySuccessResponse = NAVIGATE_HISTORY_ACTION.response;
const NAVIGATE_HISTORY_TOOL = NAVIGATE_HISTORY_ACTION.tool;
const ScrollPageSuccessResponse = SCROLL_PAGE_ACTION.response;
const SCROLL_PAGE_TOOL = SCROLL_PAGE_ACTION.tool;
const TakeScreenshotSuccessResponse = TAKE_SCREENSHOT_ACTION.response;
const TAKE_SCREENSHOT_TOOL = TAKE_SCREENSHOT_ACTION.tool;
const TypeTextSuccessResponse = TYPE_TEXT_ACTION.response;
const TYPE_TEXT_TOOL = TYPE_TEXT_ACTION.tool;

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
    const extra = actual.filter((p) => !allowed.has(p));
    if (extra.length > 0) {
      throw new Error(
        toolName +
          ': extra properties: [' +
          extra.join(', ') +
          ']. Allowed: [' +
          [...allowed].join(', ') +
          ']',
      );
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
    if (schemaType === 'string' && typeof value !== 'string')
      throw new Error(toolName + '.' + key + ': expected string');
    if (schemaType === 'number' && typeof value !== 'number')
      throw new Error(toolName + '.' + key + ': expected number');
    if (schemaType === 'boolean' && typeof value !== 'boolean')
      throw new Error(toolName + '.' + key + ': expected boolean');
    if (schemaType === 'array' && !Array.isArray(value))
      throw new Error(toolName + '.' + key + ': expected array');
    if (schemaType === 'object' && (typeof value !== 'object' || Array.isArray(value)))
      throw new Error(toolName + '.' + key + ': expected object');
  }
}

// browser_fetch_webpage
test('browser_fetch_webpage: success response matches outputSchema', () => {
  const r = new FetchPageSuccessResponse('https://example.com', '<html></html>', ['next'], []);
  const m = r.toMcpFormat();
  assert.ok(m.structuredContent, 'Should have structuredContent');
  validateAgainstSchema(
    m.structuredContent,
    FETCH_WEBPAGE_TOOL.outputSchema,
    'browser_fetch_webpage',
  );
});

test('browser_fetch_webpage: with recommendedPlugins matches outputSchema', () => {
  const r = new FetchPageSuccessResponse(
    'https://mail.google.com',
    '<html></html>',
    ['next'],
    [{ name: 'gmail' }],
  );
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    FETCH_WEBPAGE_TOOL.outputSchema,
    'browser_fetch_webpage',
  );
});

test('browser_fetch_webpage: has all required fields', () => {
  const sc = new FetchPageSuccessResponse(
    'https://example.com',
    '<html></html>',
    ['next'],
    [],
  ).toMcpFormat().structuredContent;
  for (const f of FETCH_WEBPAGE_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// browser_click_element
test('browser_click_element: success response matches outputSchema', () => {
  const r = new ClickWithFallbackResponse({
    status: 'success',
    fallbackUsed: false,
    nativeAttempt: { status: 'success', durationMs: 150 },
    fallbackAttempt: null,
    postClickWait: { applied: true, waitedMs: 1000 },
    currentUrl: 'https://example.com',
    html: '<html></html>',
    message: 'Clicked',
    nextSteps: ['next'],
    recommendedPlugins: [],
  });
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    CLICK_ELEMENT_TOOL.outputSchema,
    'browser_click_element',
  );
});

test('browser_click_element: with fallback and plugins matches outputSchema', () => {
  const r = new ClickWithFallbackResponse({
    status: 'success',
    fallbackUsed: true,
    nativeAttempt: { status: 'timeout', durationMs: 5000, error: 'timeout' },
    fallbackAttempt: { status: 'success', durationMs: 50 },
    postClickWait: { applied: true, waitedMs: 1000 },
    currentUrl: 'https://mail.google.com',
    html: '<html></html>',
    message: 'Clicked',
    nextSteps: ['next'],
    recommendedPlugins: [{ name: 'gmail' }],
  });
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    CLICK_ELEMENT_TOOL.outputSchema,
    'browser_click_element',
  );
});

test('browser_click_element: has all required fields', () => {
  const r = new ClickWithFallbackResponse({
    status: 'success',
    fallbackUsed: false,
    nativeAttempt: { status: 'success', durationMs: 100 },
    fallbackAttempt: null,
    postClickWait: { applied: false, waitedMs: 0 },
    currentUrl: 'https://example.com',
    html: '<html></html>',
    message: 'Clicked',
    nextSteps: ['next'],
  });
  const sc = r.toMcpFormat().structuredContent;
  for (const f of CLICK_ELEMENT_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// browser_close_tab
test('browser_close_tab: success response matches outputSchema', () => {
  const r = new CloseTabSuccessResponse('Closed', 'example.com', ['next']);
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    CLOSE_TAB_TOOL.outputSchema,
    'browser_close_tab',
  );
});

test('browser_close_tab: has all required fields', () => {
  const sc = new CloseTabSuccessResponse('Closed', 'example.com', ['next']).toMcpFormat()
    .structuredContent;
  for (const f of CLOSE_TAB_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// browser_execute_javascript
test('browser_execute_javascript: success response matches outputSchema', () => {
  const r = new ExecuteJavascriptResponse({
    result: 42,
    type: 'number',
    executionTimeMs: 15,
    truncated: false,
    urlChanged: false,
    currentUrl: 'https://example.com',
    error: null,
    nextSteps: ['next'],
    recommendedPlugins: [],
  });
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    EXECUTE_JAVASCRIPT_TOOL.outputSchema,
    'browser_execute_javascript',
  );
});

test('browser_execute_javascript: with error matches outputSchema', () => {
  const r = new ExecuteJavascriptResponse({
    result: null,
    type: 'error',
    executionTimeMs: 5,
    truncated: false,
    urlChanged: false,
    currentUrl: 'https://example.com',
    error: { message: 'fail' },
    nextSteps: ['fix'],
    recommendedPlugins: [],
  });
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    EXECUTE_JAVASCRIPT_TOOL.outputSchema,
    'browser_execute_javascript',
  );
});

test('browser_execute_javascript: has all required fields', () => {
  const r = new ExecuteJavascriptResponse({
    result: 'hi',
    type: 'string',
    executionTimeMs: 10,
    truncated: false,
    urlChanged: false,
    currentUrl: 'https://example.com',
    error: null,
    nextSteps: ['next'],
  });
  const sc = r.toMcpFormat().structuredContent;
  for (const f of EXECUTE_JAVASCRIPT_TOOL.outputSchema.required)
    assert.ok(f in sc, 'missing: ' + f);
});

// browser_get_current_html
test('browser_get_current_html: success response matches outputSchema', () => {
  const r = new GetCurrentHtmlSuccessResponse('https://example.com', '<html></html>', ['next'], []);
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    GET_CURRENT_HTML_TOOL.outputSchema,
    'browser_get_current_html',
  );
});

test('browser_get_current_html: with plugins matches outputSchema', () => {
  const r = new GetCurrentHtmlSuccessResponse(
    'https://calendar.google.com',
    '<html></html>',
    ['next'],
    [{ name: 'gcal' }],
  );
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    GET_CURRENT_HTML_TOOL.outputSchema,
    'browser_get_current_html',
  );
});

test('browser_get_current_html: has all required fields', () => {
  const sc = new GetCurrentHtmlSuccessResponse(
    'https://example.com',
    '<html></html>',
    ['next'],
    [],
  ).toMcpFormat().structuredContent;
  for (const f of GET_CURRENT_HTML_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// browser_navigate_history
test('browser_navigate_history: success response matches outputSchema', () => {
  const r = new NavigateHistorySuccessResponse(
    'back',
    'https://a.com',
    'https://b.com',
    '<html></html>',
    ['next'],
  );
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    NAVIGATE_HISTORY_TOOL.outputSchema,
    'browser_navigate_history',
  );
});

test('browser_navigate_history: has all required fields', () => {
  const sc = new NavigateHistorySuccessResponse(
    'forward',
    'https://a.com',
    'https://b.com',
    '<html></html>',
    ['next'],
  ).toMcpFormat().structuredContent;
  for (const f of NAVIGATE_HISTORY_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// browser_scroll_page
test('browser_scroll_page: success response matches outputSchema', () => {
  const r = new ScrollPageSuccessResponse('https://example.com', 0, 500, 1920, 5000, 1920, 1080, [
    'next',
  ]);
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    SCROLL_PAGE_TOOL.outputSchema,
    'browser_scroll_page',
  );
});

test('browser_scroll_page: has all required fields', () => {
  const sc = new ScrollPageSuccessResponse('https://example.com', 0, 0, 1920, 1080, 1920, 1080, [
    'next',
  ]).toMcpFormat().structuredContent;
  for (const f of SCROLL_PAGE_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// browser_take_screenshot
test('browser_take_screenshot: success response matches outputSchema', () => {
  const r = new TakeScreenshotSuccessResponse('https://example.com', 'base64data', 'image/png', [
    'next',
  ]);
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    TAKE_SCREENSHOT_TOOL.outputSchema,
    'browser_take_screenshot',
  );
});

test('browser_take_screenshot: has all required fields', () => {
  const sc = new TakeScreenshotSuccessResponse('https://example.com', 'data', 'image/png', [
    'next',
  ]).toMcpFormat().structuredContent;
  for (const f of TAKE_SCREENSHOT_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// browser_type_text
test('browser_type_text: success response matches outputSchema', () => {
  const r = new TypeTextSuccessResponse('https://example.com', 'Typed hello', '<html></html>', [
    'next',
  ]);
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    TYPE_TEXT_TOOL.outputSchema,
    'browser_type_text',
  );
});

test('browser_type_text: with null html matches outputSchema', () => {
  const r = new TypeTextSuccessResponse('https://example.com', 'Typed', null, ['next']);
  validateAgainstSchema(
    r.toMcpFormat().structuredContent,
    TYPE_TEXT_TOOL.outputSchema,
    'browser_type_text',
  );
});

test('browser_type_text: has all required fields', () => {
  const sc = new TypeTextSuccessResponse('https://example.com', 'Typed', '<html></html>', [
    'next',
  ]).toMcpFormat().structuredContent;
  for (const f of TYPE_TEXT_TOOL.outputSchema.required) assert.ok(f in sc, 'missing: ' + f);
});

// Cross-cutting: non-success responses omit structuredContent
test('InformationalResponse omits structuredContent (avoids schema violations)', () => {
  const r = new InformationalResponse('Page not loaded', 'No page found', ['Fetch first']);
  const m = r.toMcpFormat();
  assert.strictEqual(m.isError, false);
  assert.strictEqual(
    m.structuredContent,
    undefined,
    'InformationalResponse must not have structuredContent',
  );
  assert.ok(m.content[0].text.includes('Page not loaded'));
});

test('HttpStatusResponse omits structuredContent (avoids schema violations)', () => {
  const r = new HttpStatusResponse('https://example.com', 404, 'Not Found', '<html></html>');
  const m = r.toMcpFormat();
  assert.strictEqual(m.isError, false);
  assert.strictEqual(
    m.structuredContent,
    undefined,
    'HttpStatusResponse must not have structuredContent',
  );
  assert.ok(m.content[0].text.includes('404'));
});

test('ErrorResponse omits structuredContent (per MCP spec)', () => {
  const r = new ErrorResponse('Something broke', ['Try again']);
  const m = r.toMcpFormat();
  assert.strictEqual(m.isError, true);
  assert.strictEqual(
    m.structuredContent,
    undefined,
    'ErrorResponse must not have structuredContent',
  );
});

// Summary
console.log();
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) process.exit(1);
