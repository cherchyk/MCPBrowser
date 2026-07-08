/**
 * HTML processing functions for MCPBrowser
 */

/**
 * Removes non-informative markup to shrink HTML for agent consumption while
 * preserving what an agent needs to understand and interact with the page.
 *
 * Removes: executable script, style and noscript blocks, svg, comments, most
 * meta and link tags, inline style and event-handler attributes, and most
 * "data-" and "aria-" attributes.
 * Keeps: class, id, role, data-testid, a whitelist of "aria-" attributes
 * (accessible name and widget state), JSON-LD and application/json data
 * scripts, and description and OpenGraph meta tags.
 *
 * Note: visibility-based pruning (hidden attribute, display:none) happens during
 * DOM extraction (see extractAndProcessHtml in page.js), not here — regex
 * removal of nested elements is unreliable and corrupts structure.
 * @param {string} html - The HTML to clean
 * @returns {string} The cleaned HTML
 */
export function cleanHtml(html) {
  if (!html) return "";
  
  let cleaned = html;

  // Remove spaces between tags
  cleaned = cleaned.replace(/>\s+</g, '><');
  
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove <script> tags, but preserve data-carrying scripts (JSON-LD and
  // application/json) — these hold structured page data valuable to an agent.
  cleaned = cleaned.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, attrs) =>
    /type\s*=\s*["'](?:application\/ld\+json|application\/json)["']/i.test(attrs) ? match : ''
  );
  
  // Remove style tags and their content
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove noscript tags and their content
  cleaned = cleaned.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  
  // Remove SVG tags and their content (often large, not useful for text)
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  
  // Hidden elements (hidden attribute / display:none) are pruned from the live
  // DOM during extraction (see extractAndProcessHtml), not via regex here.

  // Remove <meta> tags, but keep the description and OpenGraph (og:*) tags —
  // they provide a concise, agent-friendly summary of the page.
  cleaned = cleaned.replace(/<meta\b([^>]*)>/gi, (match, attrs) =>
    /name\s*=\s*["']description["']|property\s*=\s*["']og:[^"']*["']/i.test(attrs) ? match : ''
  );
  
  // Remove link tags (stylesheets, preload, etc.)
  cleaned = cleaned.replace(/<link\b[^>]*>/gi, '');
  
  // Remove inline style attributes
  cleaned = cleaned.replace(/\s+style=["'][^"']*["']/gi, '');
  
  // Keep class and id attributes for element selection
  // cleaned = cleaned.replace(/\s+class=["'][^"']*["']/gi, '');
  // cleaned = cleaned.replace(/\s+id=["'][^"']*["']/gi, '');
  
  // Preserve data-testid (commonly used for automation), then remove other data-* attributes
  const testIds = [];
  cleaned = cleaned.replace(/\s+(data-testid=["'][^"']*["'])/gi, (match, attr) => {
    const placeholder = `__TESTID_${testIds.length}__`;
    testIds.push(attr);
    return ` ${placeholder}`;
  });
  
  // Remove all other data-* attributes
  cleaned = cleaned.replace(/\s+data-[a-z0-9-]+=["'][^"']*["']/gi, '');
  
  // Restore data-testid attributes
  testIds.forEach((attr, index) => {
    cleaned = cleaned.replace(`__TESTID_${index}__`, attr);
  });
  
  // Remove event handler attributes (onclick, onload, etc.)
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi, '');
  
  // Keep role attributes — they're semantically valuable for LLM understanding
  // and enable stable selectors like [role="main"], [role="navigation"]
  // cleaned = cleaned.replace(/\s+role=["'][^"']*["']/gi, '');
  
  // Remove aria-* attributes, but keep the ones carrying an element's accessible
  // name or interaction state — essential for identifying icon-only controls
  // (e.g. aria-label) and understanding widget state (expanded/selected/checked).
  const ARIA_KEEP = new Set([
    'aria-label', 'aria-labelledby', 'aria-describedby',
    'aria-expanded', 'aria-selected', 'aria-checked',
    'aria-current', 'aria-hidden'
  ]);
  cleaned = cleaned.replace(/\s+(aria-[a-z0-9-]+)=["'][^"']*["']/gi, (match, name) =>
    ARIA_KEEP.has(name.toLowerCase()) ? match : ''
  );
  
  // Collapse multiple whitespace/newlines into single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  return cleaned;
}

/**
 * Enriches HTML by resolving relative URLs to absolute ones so an agent always
 * sees fully-qualified links. Handles href, src, poster, srcset and <form>
 * action attributes, and honors a <base href> when the document declares one.
 * @param {string} html - The HTML to enrich
 * @param {string} baseUrl - The document URL used to resolve relative URLs
 * @returns {string} The enriched HTML
 */
export function enrichHtml(html, baseUrl) {
  if (!html) return "";

  // Honor <base href> if present — browsers resolve relative URLs against it
  // rather than the document URL.
  let effectiveBase = baseUrl;
  const baseMatch = html.match(/<base\b[^>]*\shref=["']([^"']*)["']/i);
  if (baseMatch && baseMatch[1]) {
    try {
      effectiveBase = new URL(baseMatch[1], baseUrl).href;
    } catch {
      // Malformed <base href> — fall back to the document URL.
    }
  }

  // URLs that are already absolute or non-resolvable (anchors, data/blob URIs,
  // mailto/tel/javascript schemes) are left untouched.
  const shouldSkip = (url) =>
    !url || /^(?:https?:|\/\/|data:|blob:|mailto:|tel:|javascript:|#)/i.test(url);

  const toAbsolute = (url) => {
    try {
      return new URL(url, effectiveBase).href;
    } catch {
      return null;
    }
  };

  let enriched = html;

  // Single-URL attributes: href, src, poster. Anchored on leading whitespace so
  // substrings like xlink:href or data-src are never matched.
  enriched = enriched.replace(/(\s(?:href|src|poster)=)["']([^"']+)["']/gi, (match, prefix, url) => {
    if (shouldSkip(url)) return match;
    const abs = toAbsolute(url);
    return abs ? `${prefix}"${abs}"` : match;
  });

  // <form action>: scoped to the form tag so custom attributes such as
  // data-action are never rewritten.
  enriched = enriched.replace(/(<form\b[^>]*?\saction=)["']([^"']+)["']/gi, (match, prefix, url) => {
    if (shouldSkip(url)) return match;
    const abs = toAbsolute(url);
    return abs ? `${prefix}"${abs}"` : match;
  });

  // srcset: a comma-separated list of "url [descriptor]" candidates.
  enriched = enriched.replace(/(\ssrcset=)["']([^"']+)["']/gi, (match, prefix, value) => {
    const converted = value
      .split(',')
      .map((candidate) => candidate.trim())
      .filter(Boolean)
      .map((candidate) => {
        const spaceIdx = candidate.search(/\s/);
        const url = spaceIdx === -1 ? candidate : candidate.slice(0, spaceIdx);
        const descriptor = spaceIdx === -1 ? '' : candidate.slice(spaceIdx).trim();
        const resolved = shouldSkip(url) ? url : (toAbsolute(url) || url);
        return descriptor ? `${resolved} ${descriptor}` : resolved;
      })
      .join(', ');
    return `${prefix}"${converted}"`;
  });

  return enriched;
}

/**
 * Prepares HTML for consumption by cleaning and enriching it.
 * @deprecated Use cleanHtml and enrichHtml separately for better control
 * @param {string} html - The HTML to prepare
 * @param {string} baseUrl - The base URL for resolving relative URLs
 * @returns {string} The prepared HTML
 */
export function prepareHtml(html, baseUrl) {
  if (!html) return "";
  const cleaned = cleanHtml(html);
  return enrichHtml(cleaned, baseUrl);
}
