import assert from 'assert';
import { prepareHtml, cleanHtml, enrichHtml } from '../../src/core/html.js';

console.log('🧪 Testing HTML processing functions\n');

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✅ ${description}`);
    testsPassed++;
  } catch (err) {
    console.log(`❌ ${description}`);
    console.log(`   Error: ${err.message}`);
    testsFailed++;
  }
}

// Test 1: Remove HTML comments
test('Should remove HTML comments', () => {
  const html = '<div>Content<!-- This is a comment --></div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('<!--'), 'Should not contain comment start');
  assert(!result.includes('-->'), 'Should not contain comment end');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test 2: Remove script tags
test('Should remove script tags and their content', () => {
  const html = '<div>Keep this</div><script>alert("remove");</script><div>And this</div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('<script'), 'Should not contain script tag');
  assert(!result.includes('alert'), 'Should not contain script content');
  assert(result.includes('Keep this'), 'Should preserve content');
});

// Test 3: Remove style tags
test('Should remove style tags and their content', () => {
  const html = '<div>Content</div><style>.class { color: red; }</style>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('<style'), 'Should not contain style tag');
  assert(!result.includes('color: red'), 'Should not contain style content');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test 4: Remove meta tags
test('Should remove meta tags', () => {
  const html = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>Content</body>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('<meta'), 'Should not contain meta tags');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test 5: Convert relative URLs in href
test('Should convert relative href URLs to absolute', () => {
  const html = '<a href="/docs/page">Link</a>';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('href="https://example.com/docs/page"'), 'Should convert relative href to absolute');
});

// Test 6: Keep absolute URLs in href unchanged
test('Should keep absolute href URLs unchanged', () => {
  const html = '<a href="https://other.com/page">Link</a>';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('href="https://other.com/page"'), 'Should keep absolute href unchanged');
});

// Test 7: Convert relative URLs in src
test('Should convert relative src URLs to absolute', () => {
  const html = '<img src="/images/logo.png">';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('src="https://example.com/images/logo.png"'), 'Should convert relative src to absolute');
});

// Test 8: Keep absolute URLs in src unchanged
test('Should keep absolute src URLs unchanged', () => {
  const html = '<img src="https://cdn.example.com/logo.png">';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('src="https://cdn.example.com/logo.png"'), 'Should keep absolute src unchanged');
});

// Test 9: Handle anchor links (should not modify)
test('Should not modify anchor links', () => {
  const html = '<a href="#section">Jump</a>';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('href="#section"'), 'Should keep anchor links unchanged');
});

// Test 10: Handle mailto and tel links (should not modify)
test('Should not modify mailto and tel links', () => {
  const html = '<a href="mailto:test@example.com">Email</a><a href="tel:+1234567890">Call</a>';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('href="mailto:test@example.com"'), 'Should keep mailto unchanged');
  assert(result.includes('href="tel:+1234567890"'), 'Should keep tel unchanged');
});

// Test 11: Handle data URIs in src (should not modify)
test('Should not modify data URIs', () => {
  const html = '<img src="data:image/png;base64,iVBORw0KGg==">';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('src="data:image/png;base64,iVBORw0KGg=="'), 'Should keep data URI unchanged');
});

// Test 12: Handle protocol-relative URLs (should not modify)
test('Should not modify protocol-relative URLs', () => {
  const html = '<img src="//cdn.example.com/image.png">';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('src="//cdn.example.com/image.png"'), 'Should keep protocol-relative URL unchanged');
});

// Test 13: Handle empty or null HTML
test('Should handle empty HTML', () => {
  const result = prepareHtml('', 'https://example.com');
  assert.strictEqual(result, '', 'Should return empty string');
});

test('Should handle null HTML', () => {
  const result = prepareHtml(null, 'https://example.com');
  assert.strictEqual(result, '', 'Should return empty string for null');
});

// Test 14: Complex real-world example
test('Should handle complex HTML with multiple elements', () => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Test Page</title>
      <style>.test { color: blue; }</style>
      <script>console.log("test");</script>
    </head>
    <body>
      <!-- Main content -->
      <div>
        <a href="/page1">Page 1</a>
        <a href="https://external.com">External</a>
        <img src="/images/pic.jpg">
        <script>alert("inline");</script>
      </div>
    </body>
    </html>
  `;
  const result = prepareHtml(html, 'https://example.com/test/');
  
  // Should not contain removed elements
  assert(!result.includes('<meta'), 'Should remove meta');
  assert(!result.includes('<style'), 'Should remove style');
  assert(!result.includes('<script'), 'Should remove script');
  assert(!result.includes('<!--'), 'Should remove comments');
  
  // Should convert relative URLs
  assert(result.includes('href="https://example.com/page1"'), 'Should convert relative href');
  assert(result.includes('src="https://example.com/images/pic.jpg"'), 'Should convert relative src');
  
  // Should keep absolute URLs
  assert(result.includes('href="https://external.com"'), 'Should keep absolute href');
  
  // Should preserve content
  assert(result.includes('Page 1'), 'Should preserve content');
});

// Test 15: Verify script with attributes is removed
test('Should remove script tags with various attributes', () => {
  const html = '<script type="text/javascript" async defer src="/app.js">console.log("test");</script>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('<script'), 'Should remove script with attributes');
  assert(!result.includes('app.js'), 'Should remove script content');
});

// Test 16: Remove inline style attributes
test('Should remove inline style attributes', () => {
  const html = '<div style="color: red; font-size: 14px;">Content</div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('style='), 'Should remove style attribute');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test 17: Keep class attributes (needed for interaction)
test('Should keep class attributes', () => {
  const html = '<div class="container main-content">Text</div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('class="container main-content"'), 'Should keep class attribute');
  assert(result.includes('Text'), 'Should preserve content');
});

// Test 18: Keep id attributes (needed for interaction)
test('Should keep id attributes', () => {
  const html = '<div id="main-section">Content</div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('id="main-section"'), 'Should keep id attribute');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test 19: Remove data-* attributes except data-testid
test('Should remove data-* attributes except data-testid', () => {
  const html = '<div data-id="123" data-testid="submit-btn" data-value="test">Content</div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('data-id='), 'Should remove data-id');
  assert(!result.includes('data-value='), 'Should remove data-value');
  assert(result.includes('data-testid="submit-btn"'), 'Should keep data-testid');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test 20: Remove event handler attributes
test('Should remove event handler attributes', () => {
  const html = '<button onclick="handleClick()" onmouseover="hover()">Click</button>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('onclick='), 'Should remove onclick');
  assert(!result.includes('onmouseover='), 'Should remove onmouseover');
  assert(result.includes('Click'), 'Should preserve content');
});

// Test 21: Remove SVG tags
test('Should remove SVG tags and content', () => {
  const html = '<div>Text</div><svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('<svg'), 'Should remove svg tag');
  assert(!result.includes('circle'), 'Should remove svg content');
  assert(result.includes('Text'), 'Should preserve content');
});

// Test 22: Remove noscript tags
test('Should remove noscript tags and content', () => {
  const html = '<div>Content</div><noscript>JavaScript is disabled</noscript>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('<noscript'), 'Should remove noscript tag');
  assert(!result.includes('JavaScript is disabled'), 'Should remove noscript content');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test 23: Remove link tags
test('Should remove link tags', () => {
  const html = '<head><link rel="stylesheet" href="/style.css"><link rel="preload" as="script"></head>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('<link'), 'Should remove link tags');
});

// Test 24: Remove role attributes
test('Should remove role attributes', () => {
  const html = '<nav role="navigation">Menu</nav>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('role='), 'Should remove role attribute');
  assert(result.includes('Menu'), 'Should preserve content');
});

// Test 25: Remove aria-* attributes
test('Should remove aria-* attributes', () => {
  const html = '<button aria-label="Close" aria-pressed="false">X</button>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('aria-'), 'Should remove aria attributes');
  assert(result.includes('X'), 'Should preserve content');
});

// Test 26: Collapse whitespace
test('Should collapse multiple whitespace into single space', () => {
  const html = '<div>Line 1\n\n\n   Line 2\t\t\tLine 3</div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(!result.includes('\n\n'), 'Should remove multiple newlines');
  assert(!result.includes('   '), 'Should remove multiple spaces');
  assert(result.includes('Line 1'), 'Should preserve content');
});

// Test 26b: Remove hidden elements
test('Should remove elements with hidden attribute', () => {
  const html = '<div>Visible</div><div hidden>Hidden content</div><div>More visible</div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('Visible'), 'Should preserve visible content');
  assert(!result.includes('Hidden content'), 'Should remove hidden element content');
  assert(result.includes('More visible'), 'Should preserve other visible content');
});

// Test 26c: Remove elements with display:none
test('Should remove elements with display:none style', () => {
  const html = '<div>Visible</div><div style="display:none">Hidden</div><div>More visible</div>';
  const result = prepareHtml(html, 'https://example.com');
  assert(result.includes('Visible'), 'Should preserve visible content');
  assert(!result.includes('Hidden'), 'Should remove display:none element');
  assert(result.includes('More visible'), 'Should preserve other visible content');
});

// Test 27: Comprehensive test with all removals
test('Should handle HTML with all types of removals', () => {
  const html = `
    <div class="container" id="main" style="color: blue;" data-test="value" onclick="alert()">
      <svg width="100"><circle/></svg>
      <script>console.log("test");</script>
      <style>.test { color: red; }</style>
      <noscript>Enable JS</noscript>
      <link rel="stylesheet" href="/style.css">
      <div role="main" aria-label="content">
        <a href="/page">Link</a>
        <p>Text content</p>
      </div>
    </div>
  `;
  const result = prepareHtml(html, 'https://example.com/test/');
  
  // Should keep interaction-related attributes
  assert(result.includes('class='), 'Should keep class');
  assert(result.includes('id='), 'Should keep id');
  // Should remove style and event attributes
  assert(!result.includes('style="color: blue"'), 'Should remove inline style values');
  assert(!result.includes('onclick='), 'Should remove onclick');
  assert(!result.includes('role='), 'Should remove role');
  assert(!result.includes('aria-'), 'Should remove aria');
  
  // Should remove non-content elements
  assert(!result.includes('<svg'), 'Should remove svg');
  assert(!result.includes('<script'), 'Should remove script');
  assert(!result.includes('<style'), 'Should remove style');
  assert(!result.includes('<noscript'), 'Should remove noscript');
  assert(!result.includes('<link'), 'Should remove link');
  
  // Should preserve content and convert URLs
  assert(result.includes('href="https://example.com/page"'), 'Should convert relative URL');
  assert(result.includes('Text content'), 'Should preserve text');
});

// ==================================================
// cleanHtml Function Tests
// ==================================================

console.log('\n🧹 Testing cleanHtml function\n');

// Test cleanHtml 1: Remove HTML comments
test('cleanHtml: Should remove HTML comments', () => {
  const html = '<div>Content<!-- This is a comment --></div>';
  const result = cleanHtml(html);
  assert(!result.includes('<!--'), 'Should not contain comment start');
  assert(!result.includes('-->'), 'Should not contain comment end');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test cleanHtml 2: Remove script tags
test('cleanHtml: Should remove script tags and their content', () => {
  const html = '<div>Keep this</div><script>alert("remove");</script><div>And this</div>';
  const result = cleanHtml(html);
  assert(!result.includes('<script'), 'Should not contain script tag');
  assert(!result.includes('alert'), 'Should not contain script content');
  assert(result.includes('Keep this'), 'Should preserve content');
});

// Test cleanHtml 3: Remove style tags
test('cleanHtml: Should remove style tags and their content', () => {
  const html = '<div>Content</div><style>.class { color: red; }</style>';
  const result = cleanHtml(html);
  assert(!result.includes('<style'), 'Should not contain style tag');
  assert(!result.includes('color: red'), 'Should not contain style content');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test cleanHtml 4: Remove meta tags
test('cleanHtml: Should remove meta tags', () => {
  const html = '<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head><body>Content</body>';
  const result = cleanHtml(html);
  assert(!result.includes('<meta'), 'Should not contain meta tags');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test cleanHtml 5: Remove inline style attributes
test('cleanHtml: Should remove inline style attributes', () => {
  const html = '<div style="color: red; font-size: 14px;">Content</div>';
  const result = cleanHtml(html);
  assert(!result.includes('style='), 'Should remove style attribute');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test cleanHtml 6: Keep class attributes
test('cleanHtml: Should keep class attributes', () => {
  const html = '<div class="container main-content">Text</div>';
  const result = cleanHtml(html);
  assert(result.includes('class="container main-content"'), 'Should keep class attribute');
  assert(result.includes('Text'), 'Should preserve content');
});

// Test cleanHtml 7: Keep id attributes
test('cleanHtml: Should keep id attributes', () => {
  const html = '<div id="main-section">Content</div>';
  const result = cleanHtml(html);
  assert(result.includes('id="main-section"'), 'Should keep id attribute');
  assert(result.includes('Content'), 'Should preserve content');
});

// Test cleanHtml 8: Remove SVG tags
test('cleanHtml: Should remove SVG tags and content', () => {
  const html = '<div>Text</div><svg width="100" height="100"><circle cx="50" cy="50" r="40"/></svg>';
  const result = cleanHtml(html);
  assert(!result.includes('<svg'), 'Should remove svg tag');
  assert(!result.includes('circle'), 'Should remove svg content');
  assert(result.includes('Text'), 'Should preserve content');
});

// Test cleanHtml 9: Collapse whitespace
test('cleanHtml: Should collapse multiple whitespace into single space', () => {
  const html = '<div>Line 1\n\n\n   Line 2\t\t\tLine 3</div>';
  const result = cleanHtml(html);
  assert(!result.includes('\n\n'), 'Should remove multiple newlines');
  assert(!result.includes('   '), 'Should remove multiple spaces');
  assert(result.includes('Line 1'), 'Should preserve content');
});

// Test cleanHtml 10: Does NOT modify URLs (that's enrichHtml's job)
test('cleanHtml: Should NOT modify relative URLs', () => {
  const html = '<a href="/docs/page">Link</a><img src="/images/logo.png">';
  const result = cleanHtml(html);
  assert(result.includes('href="/docs/page"'), 'Should keep relative href unchanged');
  assert(result.includes('src="/images/logo.png"'), 'Should keep relative src unchanged');
});

// ==================================================
// enrichHtml Function Tests
// ==================================================

console.log('\n🔗 Testing enrichHtml function\n');

// Test enrichHtml 1: Convert relative href URLs
test('enrichHtml: Should convert relative href URLs to absolute', () => {
  const html = '<a href="/docs/page">Link</a>';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('href="https://example.com/docs/page"'), 'Should convert relative href to absolute');
});

// Test enrichHtml 2: Keep absolute href URLs unchanged
test('enrichHtml: Should keep absolute href URLs unchanged', () => {
  const html = '<a href="https://other.com/page">Link</a>';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('href="https://other.com/page"'), 'Should keep absolute href unchanged');
});

// Test enrichHtml 3: Convert relative src URLs
test('enrichHtml: Should convert relative src URLs to absolute', () => {
  const html = '<img src="/images/logo.png">';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('src="https://example.com/images/logo.png"'), 'Should convert relative src to absolute');
});

// Test enrichHtml 4: Keep absolute src URLs unchanged
test('enrichHtml: Should keep absolute src URLs unchanged', () => {
  const html = '<img src="https://cdn.example.com/logo.png">';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('src="https://cdn.example.com/logo.png"'), 'Should keep absolute src unchanged');
});

// Test enrichHtml 5: Handle anchor links
test('enrichHtml: Should not modify anchor links', () => {
  const html = '<a href="#section">Jump</a>';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('href="#section"'), 'Should keep anchor links unchanged');
});

// Test enrichHtml 6: Handle mailto and tel links
test('enrichHtml: Should not modify mailto and tel links', () => {
  const html = '<a href="mailto:test@example.com">Email</a><a href="tel:+1234567890">Call</a>';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('href="mailto:test@example.com"'), 'Should keep mailto unchanged');
  assert(result.includes('href="tel:+1234567890"'), 'Should keep tel unchanged');
});

// Test enrichHtml 7: Handle data URIs
test('enrichHtml: Should not modify data URIs', () => {
  const html = '<img src="data:image/png;base64,iVBORw0KGg==">';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('src="data:image/png;base64,iVBORw0KGg=="'), 'Should keep data URI unchanged');
});

// Test enrichHtml 8: Handle protocol-relative URLs
test('enrichHtml: Should not modify protocol-relative URLs', () => {
  const html = '<img src="//cdn.example.com/image.png">';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('src="//cdn.example.com/image.png"'), 'Should keep protocol-relative URL unchanged');
});

// Test enrichHtml 9: Does NOT remove elements (that's cleanHtml's job)
test('enrichHtml: Should NOT remove script or style tags', () => {
  const html = '<script>console.log("test");</script><style>.test{}</style>';
  const result = enrichHtml(html, 'https://example.com');
  assert(result.includes('<script'), 'Should keep script tag');
  assert(result.includes('<style'), 'Should keep style tag');
});

// ==================================================
// Combined cleanHtml + enrichHtml Tests
// ==================================================

console.log('\n🔄 Testing cleanHtml + enrichHtml combination\n');

// Test Combined 1: Clean then enrich
test('Combined: Should clean HTML then enrich URLs', () => {
  const html = '<div class="test" style="color:red"><a href="/page">Link</a><script>alert();</script></div>';
  const cleaned = cleanHtml(html);
  const enriched = enrichHtml(cleaned, 'https://example.com');
  
  // Should keep class, remove style and script
  assert(enriched.includes('class="test"'), 'Should keep class');
  assert(!enriched.includes('style='), 'Should not have style');
  assert(!enriched.includes('<script'), 'Should not have script');
  
  // Should have enriched URL
  assert(enriched.includes('href="https://example.com/page"'), 'Should have absolute URL');
  assert(enriched.includes('Link'), 'Should preserve content');
});

// Test Combined 2: Verify prepareHtml still works (backward compatibility)
test('Combined: prepareHtml should still work as before', () => {
  const html = '<div class="test"><a href="/page">Link</a><script>alert();</script></div>';
  const result = prepareHtml(html, 'https://example.com');
  
  // Should keep class, remove script
  assert(result.includes('class="test"'), 'Should keep class for interaction');
  assert(!result.includes('<script'), 'Should remove script');
  
  // Should enrich
  assert(result.includes('href="https://example.com/page"'), 'Should convert URL');
  assert(result.includes('Link'), 'Should preserve content');
});

// ==================================================
// Original prepareHtml Tests (for backward compatibility)
// ==================================================

console.log('\n📦 Testing prepareHtml (backward compatibility)\n');

console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
