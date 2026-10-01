// ============================================================================
// SCROLLABLE AREA SCANNER (exported for reuse by fetch-page, click-element, etc.)
// ============================================================================

/**
 * Scan a page for scrollable containers and return structured data.
 * Lightweight (~20-50ms) — safe to call on every page load.
 *
 * Returns an array of scrollable areas sorted by visible area (largest first).
 * Each entry has a CSS selector the agent can pass to browser_scroll_page's
 * `container` parameter to target that specific area.
 *
 * @param {Object} page - Puppeteer page object
 * @returns {Promise<Array<{selector: string, scrollHeight: number, clientHeight: number, scrollTop: number, hiddenPixels: number, description: string}>>}
 */
export async function scanScrollableAreas(page) {
  return await page.evaluate(() => {
    const results = [];
    const minScrollable = 200; // ignore tiny scroll areas (dropdowns, etc.)

    // Check if the window/document itself scrolls
    const docEl = document.documentElement;
    const body = document.body;
    const windowScrollH = Math.max(docEl.scrollHeight, body.scrollHeight);
    const windowClientH = docEl.clientHeight;
    const htmlOverflow = getComputedStyle(docEl).overflowY;
    const bodyOverflow = getComputedStyle(body).overflowY;
    const windowBlocked = htmlOverflow === 'hidden' && bodyOverflow === 'hidden';

    if (!windowBlocked && windowScrollH > windowClientH + minScrollable) {
      results.push({
        selector: 'window',
        scrollHeight: windowScrollH,
        clientHeight: windowClientH,
        scrollTop: window.scrollY,
        hiddenPixels: windowScrollH - windowClientH - window.scrollY,
        description: 'Main page (window scroll)',
      });
    }

    // Scan for inner scrollable containers
    // Check common SPA wrappers + anything with overflow: auto/scroll
    const seen = new WeakSet();
    const candidates = document.querySelectorAll(
      'body > *, body > * > *, [class*="scroll"], [role="main"], [role="region"], ' +
        '#root > *, #app > *, #__next > *, [class*="content"], [class*="container"], ' +
        '[class*="panel"], [class*="feed"], [class*="list"], [data-is-scrollable]',
    );

    for (const el of candidates) {
      if (seen.has(el)) continue;
      seen.add(el);

      const overflow = el.scrollHeight - el.clientHeight;
      if (overflow < minScrollable) continue;

      const style = getComputedStyle(el);
      if (style.overflowY === 'hidden' || style.overflowY === 'visible') continue;
      // auto, scroll, overlay are all scrollable

      // Skip elements that are too small to be meaningful content areas
      if (el.clientWidth < 100 || el.clientHeight < 100) continue;

      // Build a stable selector
      let selector;
      if (el.id) {
        selector = '#' + CSS.escape(el.id);
      } else if (el.getAttribute('role')) {
        const role = el.getAttribute('role');
        const roleEls = document.querySelectorAll(`[role="${role}"]`);
        if (roleEls.length === 1) {
          selector = `[role="${role}"]`;
        }
      }
      if (!selector) {
        // Try class-based selector
        const classes = Array.from(el.classList).filter(
          (c) =>
            c.includes('scroll') ||
            c.includes('content') ||
            c.includes('main') ||
            c.includes('panel') ||
            c.includes('feed') ||
            c.includes('list') ||
            c.includes('container') ||
            c.includes('body') ||
            c.includes('region'),
        );
        if (classes.length > 0) {
          const candidate = '.' + CSS.escape(classes[0]);
          if (document.querySelectorAll(candidate).length === 1) {
            selector = candidate;
          }
        }
      }
      if (!selector) {
        // Use nth-child path as last resort
        const tag = el.tagName.toLowerCase();
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((s) => s.tagName === el.tagName);
          const idx = siblings.indexOf(el) + 1;
          const parentSel = parent.id ? '#' + CSS.escape(parent.id) : parent.tagName.toLowerCase();
          selector = `${parentSel} > ${tag}:nth-of-type(${idx})`;
        } else {
          selector = tag;
        }
      }

      // Build a human-readable description from ARIA, class, or tag
      let description = el.getAttribute('aria-label') || '';
      if (!description) {
        const meaningful = Array.from(el.classList)
          .filter((c) => !c.match(/^(bolt-|flex|ms-|css-|_|sc-)/i))
          .slice(0, 2)
          .join(' ');
        description = meaningful || el.tagName.toLowerCase();
      }

      results.push({
        selector,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
        hiddenPixels: el.scrollHeight - el.clientHeight - el.scrollTop,
        description,
      });
    }

    // Sort by visible area (largest containers first) and deduplicate nested
    results.sort((a, b) => {
      if (a.selector === 'window') return -1;
      if (b.selector === 'window') return 1;
      return b.clientHeight * 100 + b.scrollHeight - (a.clientHeight * 100 + a.scrollHeight);
    });

    // Cap at 5 most significant scrollable areas
    return results.slice(0, 5);
  });
}
