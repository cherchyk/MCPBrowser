/**
 * Tests for detectForms action
 * Tests form discovery, field extraction, label resolution, and form type classification
 */

import assert from 'assert';
import { detectForms, fetchPage, executeJavascript, closeTab } from '../../src/mcp-browser.js';
import { ErrorResponse, InformationalResponse } from '../../src/core/responses.js';
import { DetectFormsResponse } from '../../src/actions/detect-forms.js';
import { runWithBrowsers } from '../browsers/browser-runner.js';

const browserParam = process.argv[2] || '';

console.log('🧪 Testing detectForms action\n');

let testsPassed = 0;
let testsFailed = 0;

const testUrl = 'about:blank';

function test(description, fn) {
  return new Promise((resolve) => {
    fn()
      .then(() => {
        console.log(`✅ ${description}`);
        testsPassed++;
        resolve();
      })
      .catch((err) => {
        console.log(`❌ ${description}`);
        console.log(`   Error: ${err.message}`);
        testsFailed++;
        resolve();
      });
  });
}

// ============================================================================
// detectForms Tests
// ============================================================================

await runWithBrowsers(async (browserType) => {
  console.log('\n📋 Testing detectForms()');

  // ------------------------------------------------------------------
  // Validation tests
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should require url parameter`, async () => {
    try {
      await detectForms({});
      throw new Error('Should have thrown an error');
    } catch (err) {
      assert.match(err.message, /url parameter is required/);
    }
  });

  await test(`[${browserType}] Should return informational response if page not loaded`, async () => {
    const result = await detectForms({ url: 'https://unloaded-domain-test-forms.com' });
    assert.strictEqual(result instanceof InformationalResponse, true, 'Should return InformationalResponse');
    assert.match(result.message, /No open page found/);
  });

  // ------------------------------------------------------------------
  // Load a blank page for all subsequent tests
  // ------------------------------------------------------------------
  await fetchPage({ url: testUrl, browser: browserType, removeUnnecessaryHTML: false });

  // ------------------------------------------------------------------
  // Login form detection
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should detect a login form`, async () => {
    await executeJavascript({
      url: testUrl,
      script: `
        document.body.innerHTML = \`
          <form id="login-form" action="/login" method="POST">
            <label for="username">Username</label>
            <input id="username" name="username" type="text" required placeholder="Enter username">
            <label for="password">Password</label>
            <input id="password" name="password" type="password" required>
            <button type="submit">Log In</button>
          </form>
        \`;
      `
    });

    const result = await detectForms({ url: testUrl });
    assert.strictEqual(result instanceof DetectFormsResponse, true, 'Should return DetectFormsResponse');
    assert.strictEqual(result.forms.length, 1, 'Should find 1 form');

    const form = result.forms[0];
    assert.strictEqual(form.formType, 'login', 'Should classify as login');
    assert.strictEqual(form.method, 'POST');
    assert.strictEqual(form.fields.length, 2, 'Should have 2 visible fields');
    assert.ok(form.submitButton, 'Should find submit button');
    assert.match(form.submitButton.text, /Log In/);
    assert.strictEqual(result.totalFieldCount, 2);
  });

  // ------------------------------------------------------------------
  // Search form detection
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should detect a search form`, async () => {
    await executeJavascript({
      url: testUrl,
      script: `
        document.body.innerHTML = \`
          <form id="search-form" action="/search" method="GET">
            <input type="search" name="q" placeholder="Search...">
            <button type="submit">Search</button>
          </form>
        \`;
      `
    });

    const result = await detectForms({ url: testUrl });
    assert.strictEqual(result.forms.length, 1);
    assert.strictEqual(result.forms[0].formType, 'search');
    assert.strictEqual(result.forms[0].fields.length, 1);
  });

  // ------------------------------------------------------------------
  // Orphaned SPA fields
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should detect orphaned SPA fields`, async () => {
    await executeJavascript({
      url: testUrl,
      script: `
        document.body.innerHTML = \`
          <div id="spa-app">
            <input id="spa-input" name="query" type="text" placeholder="SPA field">
            <select id="spa-select"><option>A</option><option>B</option></select>
          </div>
        \`;
      `
    });

    const result = await detectForms({ url: testUrl });
    assert.strictEqual(result.forms.length, 0, 'No <form> elements');
    assert.ok(result.orphanedFields.length >= 2, `Should find orphaned fields, got ${result.orphanedFields.length}`);
    assert.strictEqual(result.totalFieldCount, result.orphanedFields.length);
  });

  // ------------------------------------------------------------------
  // Hidden field filtering
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should exclude hidden fields by default`, async () => {
    await executeJavascript({
      url: testUrl,
      script: `
        document.body.innerHTML = \`
          <form id="hidden-test">
            <input type="hidden" name="csrf" value="abc123">
            <input type="text" name="visible" placeholder="Visible">
            <button type="submit">Go</button>
          </form>
        \`;
      `
    });

    const result = await detectForms({ url: testUrl, includeHidden: false });
    assert.strictEqual(result.forms[0].fields.length, 1, 'Should exclude hidden field');
    assert.strictEqual(result.forms[0].fields[0].name, 'visible');
  });

  await test(`[${browserType}] Should include hidden fields when includeHidden=true`, async () => {
    // Same HTML as above still loaded
    const result = await detectForms({ url: testUrl, includeHidden: true });
    assert.strictEqual(result.forms[0].fields.length, 2, 'Should include hidden field');
    const hiddenField = result.forms[0].fields.find(f => f.name === 'csrf');
    assert.ok(hiddenField, 'Should find csrf hidden field');
    assert.strictEqual(hiddenField.type, 'hidden');
  });

  // ------------------------------------------------------------------
  // Label resolution
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should resolve labels with correct priority`, async () => {
    await executeJavascript({
      url: testUrl,
      script: `
        document.body.innerHTML = \`
          <form id="label-test">
            <label for="field-explicit">Explicit Label</label>
            <input id="field-explicit" name="explicit" type="text">

            <label>Wrapping Label <input id="field-wrap" name="wrap" type="text"></label>

            <input id="field-aria" name="aria" type="text" aria-label="Aria Label">

            <span id="ref-label">Referenced Label</span>
            <input id="field-labelledby" name="labelledby" type="text" aria-labelledby="ref-label">

            <input id="field-placeholder" name="placeholder" type="text" placeholder="Placeholder Label">

            <button type="submit">Submit</button>
          </form>
        \`;
      `
    });

    const result = await detectForms({ url: testUrl });
    const fields = result.forms[0].fields;

    const explicit = fields.find(f => f.name === 'explicit');
    assert.strictEqual(explicit.label, 'Explicit Label', 'Should resolve <label for>');

    const wrap = fields.find(f => f.name === 'wrap');
    assert.strictEqual(wrap.label, 'Wrapping Label', 'Should resolve parent <label>');

    const aria = fields.find(f => f.name === 'aria');
    assert.strictEqual(aria.label, 'Aria Label', 'Should resolve aria-label');

    const labelledby = fields.find(f => f.name === 'labelledby');
    assert.strictEqual(labelledby.label, 'Referenced Label', 'Should resolve aria-labelledby');

    const placeholder = fields.find(f => f.name === 'placeholder');
    assert.strictEqual(placeholder.label, 'Placeholder Label', 'Should resolve placeholder');
  });

  // ------------------------------------------------------------------
  // Multiple forms
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should detect multiple forms with correct types`, async () => {
    await executeJavascript({
      url: testUrl,
      script: `
        document.body.innerHTML = \`
          <form id="login" action="/login" method="POST">
            <input name="user" type="text" placeholder="User">
            <input name="pass" type="password">
            <button type="submit">Login</button>
          </form>
          <form id="search" action="/search">
            <input name="q" type="search" placeholder="Search...">
            <button type="submit">Go</button>
          </form>
        \`;
      `
    });

    const result = await detectForms({ url: testUrl });
    assert.strictEqual(result.forms.length, 2, 'Should find 2 forms');
    assert.strictEqual(result.forms[0].formType, 'login');
    assert.strictEqual(result.forms[1].formType, 'search');
    assert.strictEqual(result.totalFieldCount, 3, '2 login + 1 search');
  });

  // ------------------------------------------------------------------
  // Summary string
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should produce a meaningful summary`, async () => {
    // Still has the 2-form HTML from above
    const result = await detectForms({ url: testUrl });
    assert.ok(result.summary.includes('Found 2 form'), `Summary should mention form count, got: ${result.summary}`);
    assert.ok(result.summary.includes('login'), 'Summary should mention login');
    assert.ok(result.summary.includes('search'), 'Summary should mention search');
  });

  // ------------------------------------------------------------------
  // Validation constraints extraction
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should extract field validation constraints`, async () => {
    await executeJavascript({
      url: testUrl,
      script: `
        document.body.innerHTML = \`
          <form id="validation-test">
            <input id="constrained" name="constrained" type="number"
              required min="1" max="100" pattern="[0-9]+" maxlength="5">
            <button type="submit">Submit</button>
          </form>
        \`;
      `
    });

    const result = await detectForms({ url: testUrl });
    const field = result.forms[0].fields[0];
    assert.strictEqual(field.required, true, 'Should be required');
    assert.strictEqual(field.validation.min, '1');
    assert.strictEqual(field.validation.max, '100');
    assert.strictEqual(field.validation.pattern, '[0-9]+');
    assert.strictEqual(field.validation.maxLength, 5);
  });

  // ------------------------------------------------------------------
  // Empty page (no forms)
  // ------------------------------------------------------------------

  await test(`[${browserType}] Should handle page with no forms`, async () => {
    await executeJavascript({
      url: testUrl,
      script: `document.body.innerHTML = '<h1>No forms here</h1>';`
    });

    const result = await detectForms({ url: testUrl });
    assert.strictEqual(result instanceof DetectFormsResponse, true);
    assert.strictEqual(result.forms.length, 0);
    assert.strictEqual(result.orphanedFields.length, 0);
    assert.strictEqual(result.totalFieldCount, 0);
    assert.ok(result.summary.includes('No forms'), 'Summary should indicate no forms');
  });

  // ------------------------------------------------------------------
  // Real-world test: w3schools HTML forms page
  // ------------------------------------------------------------------

  const realUrl = 'https://www.w3schools.com/html/html_forms.asp';

  await test(`[${browserType}] Should detect forms on w3schools forms page`, async () => {
    await fetchPage({ url: realUrl, browser: browserType, removeUnnecessaryHTML: false });
    const result = await detectForms({ url: realUrl });
    assert.strictEqual(result instanceof DetectFormsResponse, true, 'Should return DetectFormsResponse');
    assert.ok(result.forms.length >= 1, `Should find at least 1 form, got ${result.forms.length}`);
    assert.ok(result.totalFieldCount >= 1, `Should find fields, got ${result.totalFieldCount}`);
    console.log(`      → Found ${result.forms.length} forms, ${result.totalFieldCount} total fields, ${result.orphanedFields.length} orphaned`);
    console.log(`      → Summary: ${result.summary}`);

    // Verify every form has a valid formType
    for (const form of result.forms) {
      assert.ok(
        ['login', 'search', 'registration', 'contact', 'checkout', 'other'].includes(form.formType),
        `Form type should be valid, got "${form.formType}"`
      );
    }

    // Verify fields have selectors (usable for type_text/click_element)
    const allFields = result.forms.flatMap(f => f.fields).concat(result.orphanedFields);
    for (const field of allFields) {
      assert.ok(field.selector, `Field "${field.name || field.id}" should have a selector`);
      assert.ok(field.tag, `Field "${field.name || field.id}" should have a tag`);
    }

    // Verify nextSteps are populated
    assert.ok(result.nextSteps.length > 0, 'Should have nextSteps');

    await closeTab({ url: realUrl });
  });

  await test(`[${browserType}] Should detect forms with includeHidden on w3schools`, async () => {
    await fetchPage({ url: realUrl, browser: browserType, removeUnnecessaryHTML: false });

    const withoutHidden = await detectForms({ url: realUrl, includeHidden: false });
    const withHidden = await detectForms({ url: realUrl, includeHidden: true });

    console.log(`      → Without hidden: ${withoutHidden.totalFieldCount} fields`);
    console.log(`      → With hidden: ${withHidden.totalFieldCount} fields`);

    // With hidden should have >= fields than without
    assert.ok(
      withHidden.totalFieldCount >= withoutHidden.totalFieldCount,
      `includeHidden should return >= fields (${withHidden.totalFieldCount} vs ${withoutHidden.totalFieldCount})`
    );

    await closeTab({ url: realUrl });
  });

}, browserParam);

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
