/**
 * HTML processing functions for MCPBrowser
 */

/**
 * Removes non-content elements and attributes from HTML:
 * 1. Removing non-content elements (scripts, styles, meta tags, comments)
 * 2. Removing code-related attributes (class, id, style, data-*, event handlers)
 * 3. Removing SVG graphics and other non-text elements
 * 4. Collapsing excessive whitespace
 * @param {string} html - The HTML to clean
 * @returns {string} The cleaned HTML
 */
export function cleanHtml(html) {
  if (!html) return "";
  
  let cleaned = html;
  
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove script tags and their content
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove style tags and their content
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  
  // Remove noscript tags and their content
  cleaned = cleaned.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  
  // Remove SVG tags and their content (often large, not useful for text)
  cleaned = cleaned.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');
  
  // Remove meta tags
  cleaned = cleaned.replace(/<meta\b[^>]*>/gi, '');
  
  // Remove link tags (stylesheets, preload, etc.)
  cleaned = cleaned.replace(/<link\b[^>]*>/gi, '');
  
  // Remove inline style attributes
  cleaned = cleaned.replace(/\s+style=["'][^"']*["']/gi, '');
  
  // Remove class attributes
  cleaned = cleaned.replace(/\s+class=["'][^"']*["']/gi, '');
  
  // Remove id attributes
  cleaned = cleaned.replace(/\s+id=["'][^"']*["']/gi, '');
  
  // Remove data-* attributes
  cleaned = cleaned.replace(/\s+data-[a-z0-9-]+=["'][^"']*["']/gi, '');
  
  // Remove event handler attributes (onclick, onload, etc.)
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove role attributes
  cleaned = cleaned.replace(/\s+role=["'][^"']*["']/gi, '');
  
  // Remove aria-* attributes
  cleaned = cleaned.replace(/\s+aria-[a-z0-9-]+=["'][^"']*["']/gi, '');
  
  // Collapse multiple whitespace/newlines into single space
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Remove spaces between tags
  cleaned = cleaned.replace(/>\s+</g, '><');
  
  return cleaned;
}

/**
 * Enriches HTML by converting relative URLs to absolute URLs
 * @param {string} html - The HTML to enrich
 * @param {string} baseUrl - The base URL for resolving relative URLs
 * @returns {string} The enriched HTML
 */
export function enrichHtml(html, baseUrl) {
  if (!html) return "";
  
  let enriched = html;
  
  // Convert relative URLs to absolute in href attributes
  enriched = enriched.replace(/href=["']([^"']+)["']/gi, (match, url) => {
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('#') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      return match;
    }
    try {
      const absoluteUrl = new URL(url, baseUrl).href;
      return `href="${absoluteUrl}"`;
    } catch {
      return match;
    }
  });
  
  // Convert relative URLs to absolute in src attributes
  enriched = enriched.replace(/src=["']([^"']+)["']/gi, (match, url) => {
    if (!url || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//') || url.startsWith('data:')) {
      return match;
    }
    try {
      const absoluteUrl = new URL(url, baseUrl).href;
      return `src="${absoluteUrl}"`;
    } catch {
      return match;
    }
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
