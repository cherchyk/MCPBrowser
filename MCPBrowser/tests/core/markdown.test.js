import assert from 'assert';
import { htmlToText, htmlToMarkdown, formatContent, decodeEntities } from '../../src/core/markdown.js';

console.log('🧪 Testing content conversion (markdown.js)\n');

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

// ==================================================
// decodeEntities
// ==================================================
console.log('🔤 decodeEntities()\n');

test('Should decode named entities', () => {
  assert.strictEqual(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot;'), 'a & b <c> "d"');
});

test('Should decode numeric and hex entities', () => {
  assert.strictEqual(decodeEntities('&#39;x&#39; &#x2014; y'), "'x' — y");
});

test('Should leave unknown entities untouched', () => {
  assert.strictEqual(decodeEntities('&notareal; kept'), '&notareal; kept');
});

// ==================================================
// htmlToText
// ==================================================
console.log('\n📄 htmlToText()\n');

test('Should return empty string for empty input', () => {
  assert.strictEqual(htmlToText(''), '');
  assert.strictEqual(htmlToText(null), '');
});

test('Should strip tags and keep text', () => {
  const result = htmlToText('<div><p>Hello <strong>world</strong></p></div>');
  assert.ok(result.includes('Hello world'), 'Should keep text content');
  assert.ok(!result.includes('<'), 'Should not contain tags');
});

test('Should turn block boundaries into newlines', () => {
  const result = htmlToText('<p>One</p><p>Two</p>');
  assert.ok(/One\nTwo/.test(result), 'Paragraphs should be on separate lines');
});

test('Should turn <br> into newlines', () => {
  const result = htmlToText('Line1<br>Line2');
  assert.strictEqual(result, 'Line1\nLine2');
});

test('Should decode entities in text', () => {
  assert.strictEqual(htmlToText('<p>A &amp; B</p>'), 'A & B');
});

test('Should drop script/style content defensively', () => {
  const result = htmlToText('<p>Keep</p><script>alert(1)</script><style>.x{}</style>');
  assert.ok(result.includes('Keep'), 'Should keep content');
  assert.ok(!result.includes('alert'), 'Should drop script');
  assert.ok(!result.includes('.x'), 'Should drop style');
});

// ==================================================
// htmlToMarkdown
// ==================================================
console.log('\n📝 htmlToMarkdown()\n');

test('Should return empty string for empty input', () => {
  assert.strictEqual(htmlToMarkdown(''), '');
});

test('Should convert headings', () => {
  assert.ok(htmlToMarkdown('<h1>Title</h1>').includes('# Title'));
  assert.ok(htmlToMarkdown('<h3>Sub</h3>').includes('### Sub'));
});

test('Should convert bold and italic', () => {
  const result = htmlToMarkdown('<p><strong>bold</strong> and <em>italic</em></p>');
  assert.ok(result.includes('**bold**'), 'Should render bold');
  assert.ok(result.includes('*italic*'), 'Should render italic');
});

test('Should convert links', () => {
  const result = htmlToMarkdown('<a href="https://example.com/x">click</a>');
  assert.strictEqual(result, '[click](https://example.com/x)');
});

test('Should convert images with alt text', () => {
  const result = htmlToMarkdown('<img src="https://example.com/a.png" alt="A pic">');
  assert.strictEqual(result, '![A pic](https://example.com/a.png)');
});

test('Should convert unordered list items', () => {
  const result = htmlToMarkdown('<ul><li>one</li><li>two</li></ul>');
  assert.ok(result.includes('- one'), 'Should render first item');
  assert.ok(result.includes('- two'), 'Should render second item');
});

test('Should convert blockquotes', () => {
  const result = htmlToMarkdown('<blockquote>quoted text</blockquote>');
  assert.ok(result.includes('> quoted text'), 'Should prefix with >');
});

test('Should convert inline code', () => {
  const result = htmlToMarkdown('<p>run <code>npm test</code></p>');
  assert.ok(result.includes('`npm test`'), 'Should render inline code');
});

test('Should convert fenced code blocks', () => {
  const result = htmlToMarkdown('<pre>const x = 1;</pre>');
  assert.ok(result.includes('```'), 'Should include code fences');
  assert.ok(result.includes('const x = 1;'), 'Should keep code content');
});

test('Should convert table rows to pipe rows', () => {
  const result = htmlToMarkdown('<table><tr><td>a</td><td>b</td></tr></table>');
  assert.ok(result.includes('| a | b |'), 'Should render pipe-delimited row');
});

test('Should convert horizontal rules', () => {
  assert.ok(htmlToMarkdown('<p>a</p><hr><p>b</p>').includes('---'), 'Should render hr');
});

test('Should flatten nested tags inside links', () => {
  const result = htmlToMarkdown('<a href="https://x.com"><span>deep</span> text</a>');
  assert.strictEqual(result, '[deep text](https://x.com)');
});

test('Should decode entities in markdown output', () => {
  assert.strictEqual(htmlToMarkdown('<p>A &amp; B</p>'), 'A & B');
});

test('Should produce clean multi-element document', () => {
  const html = '<article><h1>Guide</h1><p>Intro <a href="https://x.com">link</a>.</p><ul><li>a</li><li>b</li></ul></article>';
  const result = htmlToMarkdown(html);
  assert.ok(result.includes('# Guide'), 'heading');
  assert.ok(result.includes('[link](https://x.com)'), 'link');
  assert.ok(result.includes('- a'), 'list');
  assert.ok(!result.includes('<'), 'no tags remain');
});

// ==================================================
// formatContent
// ==================================================
console.log('\n🔀 formatContent()\n');

test('Should return HTML unchanged for format=html', () => {
  const html = '<p>Hi</p>';
  assert.strictEqual(formatContent(html, 'html'), html);
});

test('Should return text for format=text', () => {
  assert.strictEqual(formatContent('<p>Hi</p>', 'text'), 'Hi');
});

test('Should return markdown for format=markdown', () => {
  assert.ok(formatContent('<h1>Hi</h1>', 'markdown').includes('# Hi'));
});

// ==================================================
// Summary
// ==================================================
console.log('\n==================================================');
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log('==================================================\n');

process.exit(testsFailed > 0 ? 1 : 0);
