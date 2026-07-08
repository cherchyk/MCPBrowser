/**
 * Readable-content conversion for MCPBrowser.
 *
 * Turns (already cleaned + enriched) HTML into normalized visible text or
 * Markdown so an agent can consume page content directly instead of parsing
 * HTML. These are pure string functions — no DOM required — which keeps them
 * fast and unit-testable.
 *
 * Note: the input is expected to be the output of cleanHtml/enrichHtml, which
 * collapses whitespace. As a result, whitespace inside <pre>/<code> is not
 * preserved with full fidelity.
 */

// Common HTML named entities. Numeric entities (&#NN; / &#xNN;) are handled
// separately, so only truly named ones need to be listed here.
const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  mdash: '—', ndash: '–', hellip: '…', copy: '©', reg: '®', trade: '™',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·',
  laquo: '«', raquo: '»', deg: '°', plusmn: '±', times: '×', divide: '÷',
};

function fromCodePoint(cp) {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return '';
  }
}

/**
 * Decodes HTML entities (named + numeric) into their character equivalents.
 * Unknown named entities are left untouched.
 * @param {string} str
 * @returns {string}
 */
export function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (match, name) => {
      const key = name.toLowerCase();
      return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key) ? NAMED_ENTITIES[key] : match;
    });
}

/** Strips tags from a fragment and trims it (helper for inline content). */
function stripTags(fragment) {
  return fragment.replace(/<[^>]+>/g, '');
}

/** Final whitespace normalization shared by text and markdown output. */
function normalizeBlockText(str) {
  return str
    .replace(/[ \t\f\v]+/g, ' ')   // collapse runs of horizontal whitespace
    .replace(/ *\n */g, '\n')       // trim spaces around newlines
    .replace(/\n{3,}/g, '\n\n')    // at most one blank line
    .trim();
}

/**
 * Converts HTML to normalized visible text (like element.innerText).
 * Block elements and <br> become line breaks; all other tags are removed.
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  if (!html) return '';
  let s = html;

  // Defensive: drop any script/style that slipped through.
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Line breaks and block boundaries → newlines.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<hr\s*\/?>/gi, '\n');
  s = s.replace(
    /<\/(p|div|section|article|header|footer|nav|aside|main|h[1-6]|li|tr|ul|ol|table|thead|tbody|blockquote|pre|figure|figcaption)>/gi,
    '\n'
  );

  s = stripTags(s);
  s = decodeEntities(s);
  return normalizeBlockText(s);
}

/**
 * Converts HTML to Markdown, handling the elements agents care about most:
 * headings, emphasis, links, images, lists, blockquotes, code, tables and
 * horizontal rules. Best-effort — nested lists are flattened and complex
 * tables are linearized.
 * @param {string} html
 * @returns {string}
 */
export function htmlToMarkdown(html) {
  if (!html) return '';
  let s = html;

  // Defensive: drop any script/style that slipped through.
  s = s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

  // Fenced code blocks (before inline processing so inner tags survive as text).
  s = s.replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_, inner) => {
    const code = decodeEntities(stripTags(inner)).replace(/\n+$/, '');
    return `\n\n\`\`\`\n${code}\n\`\`\`\n\n`;
  });

  // Inline code.
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, inner) => {
    const code = decodeEntities(stripTags(inner)).replace(/`/g, '');
    return code ? '`' + code + '`' : '';
  });

  // Images → ![alt](src)
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const src = (tag.match(/\ssrc=["']([^"']*)["']/i) || [])[1] || '';
    const alt = (tag.match(/\salt=["']([^"']*)["']/i) || [])[1] || '';
    return src ? `![${alt}](${src})` : '';
  });

  // Links → [text](href)
  s = s.replace(/<a\b[^>]*\shref=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
    const text = stripTags(inner).trim();
    return text ? `[${text}](${href})` : href;
  });

  // Headings (h1..h6).
  for (let level = 6; level >= 1; level--) {
    const re = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, 'gi');
    s = s.replace(re, (_, inner) => {
      const text = stripTags(inner).trim();
      return text ? `\n\n${'#'.repeat(level)} ${text}\n\n` : '';
    });
  }

  // Bold / italic.
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => {
    const text = stripTags(inner).trim();
    return text ? `**${text}**` : '';
  });
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, inner) => {
    const text = stripTags(inner).trim();
    return text ? `*${text}*` : '';
  });

  // List items (nested lists are flattened).
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => {
    const text = stripTags(inner).trim();
    return text ? `\n- ${text}` : '';
  });
  s = s.replace(/<\/(ul|ol)>/gi, '\n\n');
  s = s.replace(/<(ul|ol)\b[^>]*>/gi, '\n');

  // Blockquotes.
  s = s.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
    const text = decodeEntities(stripTags(inner)).trim();
    if (!text) return '';
    return '\n\n' + text.split('\n').map((line) => `> ${line}`.trimEnd()).join('\n') + '\n\n';
  });

  // Table rows → pipe-delimited lines.
  s = s.replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (_, inner) => {
    const cells = [];
    inner.replace(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi, (__, ___, cell) => {
      cells.push(decodeEntities(stripTags(cell)).trim());
      return '';
    });
    return cells.length ? `\n| ${cells.join(' | ')} |` : '';
  });
  s = s.replace(/<\/(table|thead|tbody)>/gi, '\n');

  // Horizontal rule.
  s = s.replace(/<hr\s*\/?>/gi, '\n\n---\n\n');

  // Line breaks (markdown hard break).
  s = s.replace(/<br\s*\/?>/gi, '  \n');

  // Remaining block boundaries → paragraph breaks.
  s = s.replace(
    /<\/(p|div|section|article|header|footer|nav|aside|main|figure|figcaption)>/gi,
    '\n\n'
  );

  // Strip any remaining tags and decode entities.
  s = stripTags(s);
  s = decodeEntities(s);

  return normalizeBlockText(s);
}

/**
 * Converts HTML to the requested output format.
 * @param {string} html - Cleaned/enriched HTML
 * @param {'html'|'text'|'markdown'} format - Desired output format
 * @returns {string} The content in the requested format ('html' returns input as-is)
 */
export function formatContent(html, format) {
  if (format === 'text') return htmlToText(html);
  if (format === 'markdown') return htmlToMarkdown(html);
  return html;
}
