# MCPBrowser — Recommended Improvements

> Derived from real-world testing: navigating Gmail inbox, identifying emails, clicking into individual messages, and extracting content. These recommendations address specific friction points observed during multi-step browser automation workflows.

## Context

A typical task — "summarize the 6th email in my Gmail inbox" — required 10+ tool calls and multiple workarounds due to limitations in the current toolset. What should have been a 2–3 step operation (fetch inbox → click email → read content) became an error-prone chain of failed clicks, oversized HTML payloads, and manual thread ID extraction.

---

## P0 — Critical

### 1. `browser_execute_javascript` Action

**The single highest-impact improvement.** A tool that executes arbitrary JavaScript on the current page and returns the result.

**Problem it solves:**
- **Clicking:** Gmail rows have `jsaction` handlers — Puppeteer's CDP click times out, but `element.click()` via JS works instantly
- **Data extraction:** An LLM parsing 220KB of raw HTML to find 10 email subjects is wasteful; a 3-line `querySelectorAll` returns structured JSON directly
- **Modal dismissal:** Unexpected dialogs (e.g., Gmail's "Unsubscribe" popup) could be dismissed with one JS call
- **Navigation:** Extracting encoded thread IDs from `jslog` attributes required a subagent; JS does it in-page

**Example use cases:**
```javascript
// Extract inbox as structured data
[...document.querySelectorAll('tr.zA')].map((row, i) => ({
  index: i + 1,
  sender: row.querySelector('.zF,.yP')?.textContent,
  subject: row.querySelector('.bog')?.textContent,
}))

// Click a specific element (bypasses protocol timeouts)
document.querySelector('tr[id=":4i"]').click()

// Dismiss a modal
document.querySelector('[role="alertdialog"] button')?.click()

// Extract visible text from email body
document.querySelector('.a3s.aiL')?.innerText
```

**Safety considerations:** See [Design Notes](#design-notes-browser_execute_javascript) below.

**Estimated effort:** Medium  
**Impact:** Solves clicks, extraction, modals, navigation — covers ~80% of observed friction.

---

### 2. JS Click Fallback in `browser_click_element`

**Problem:** When `page.click()` (Puppeteer's native click) fails with a protocol timeout — the element is found but the click doesn't complete — the action returns an error. This happened consistently on Gmail.

**Proposed fix:** After the Puppeteer-native click fails, automatically retry with:
```javascript
await page.evaluate(el => el.click(), elementHandle);
```

This bypasses the CDP protocol round-trip that causes timeouts on heavy JS pages. The fallback should:
1. Only activate when the element **was found** but the click **timed out**
2. Log that it used the JS fallback (for debugging)
3. Still wait for page readiness after the JS click

**Estimated effort:** Low (localized change in `click-element.js`)  
**Impact:** Fixes the most common click failure mode on complex SPAs.

---

## P1 — High Value

### 3. `selector` Parameter on `browser_get_current_html`

**Problem:** Gmail inbox returned 220KB+ of HTML. The email list table was ~20KB. The LLM (or subagent) had to parse the entire page to find the relevant section.

**Proposed:** Add an optional `selector` parameter to `browser_get_current_html` (and `browser_fetch_webpage`):
```
browser_get_current_html({ url: "...", selector: "table.F.cf.zt" })
```

Returns only the HTML subtree matching the selector. If the selector matches multiple elements, return all of them. If no match, return the full page with a note.

**Estimated effort:** Low  
**Impact:** 10x+ reduction in HTML payload for targeted extraction.

---

### 4. `extract_text` Action

**Problem:** To read an email body, the LLM had to parse the full HTML (including Gmail's UI chrome) to find the email content. Most of the HTML was irrelevant structural markup.

**Proposed:** A tool that returns only visible text content, optionally scoped to a CSS selector:
```
extract_text({ url: "...", selector: ".a3s.aiL" })
```

Equivalent to `element.innerText` — returns rendered, visible text with whitespace normalized. No HTML tags.

**Estimated effort:** Low  
**Impact:** Direct content extraction without HTML parsing.

---

## P2 — Nice to Have

### 5. `get_page_structure` Action

**Problem:** Understanding a page's DOM structure required reading the full HTML. For Gmail, the LLM needed to discover that emails are `<tr class="zA">` inside a `<table class="F cf zt">` — information buried in 220KB of markup.

**Proposed:** A tool that returns a simplified DOM tree showing element types, IDs, classes, ARIA roles, and nesting — without text content:
```
table.F.cf.zt > tbody >
  tr.zA.zE#:2k > td.oZ-x3 + td.apU + td.yX + td.a4W > .bog
  tr.zA.yO#:2y > td.oZ-x3 + td.apU + td.yX + td.a4W > .bog
  ...
```

**Parameters:** `maxDepth` (default: 5), `selector` (scope), `includeText` (boolean).

**Estimated effort:** Medium  
**Impact:** Fast structural understanding without full HTML transfer.

---

### 6. Coordinate-Based Click

**Problem:** When both CSS selector clicks and text-based clicks fail, there's no fallback. A screenshot clearly shows where an element is, but there's no way to click at a pixel position.

**Proposed:** Add optional `x, y` parameters to `browser_click_element`:
```
browser_click_element({ url: "...", x: 450, y: 188 })
```

**Estimated effort:** Low  
**Impact:** Last-resort fallback when all other click methods fail.

---

### 7. Structured List Extraction

**Problem:** Pages with repeating elements (email lists, search results, product cards, tables) require the LLM to manually parse HTML to extract structured data.

**Proposed:** A tool that detects repeating patterns and returns structured JSON:
```
extract_list({ url: "...", selector: "tr.zA", fields: {
  sender: ".zF,.yP",
  subject: ".bog",
  date: ".xW span"
}})
```

Returns:
```json
[
  { "sender": "HackerRank Team", "subject": "Improve your coding...", "date": "10:40" },
  ...
]
```

**Estimated effort:** High  
**Impact:** Powerful for list-heavy pages, but `browser_execute_javascript` covers the same use case.

---

## Design Notes: `browser_execute_javascript`

### Safety Model

The `browser_execute_javascript` tool operates within the user's authenticated browser session — the same context as `browser_click_element` or `browser_type_text`. It does **not** introduce new capabilities beyond what existing tools provide (clicking buttons, typing text, reading HTML). It simply makes those operations more efficient and reliable.

However, arbitrary code execution requires safeguards:

| Concern | Mitigation |
|---------|------------|
| **Infinite loops / hangs** | Execution timeout (default 30s, max 60s) |
| **Excessive return data** | Truncate result to max size (e.g., 100KB) |
| **Page navigation side effects** | Warn if `location` changed after execution |
| **Multiple expressions** | Return result of last expression only |
| **Errors** | Catch and return error message + stack trace |

### Proposed Interface

```
browser_execute_javascript({
  url: string,           // required — which tab to execute in
  script: string,        // required — JavaScript to execute
  timeout?: number,      // optional — max execution time in ms (default: 30000)
  returnType?: string    // optional — 'json' | 'text' | 'void' (default: 'json')
})
```

### Response

```json
{
  "result": <serialized return value>,
  "type": "string | number | object | array | null | undefined",
  "executionTime": 45,
  "currentUrl": "https://mail.google.com/...",
  "urlChanged": false
}
```

### Implementation Approach

Use Puppeteer's `page.evaluate()` wrapped with:
1. **Timeout enforcement** via `Promise.race` with a timer
2. **Result serialization** — handle DOM elements (return `outerHTML`), circular refs, etc.
3. **Error boundary** — catch runtime errors, return structured error
4. **URL change detection** — compare `page.url()` before/after
5. **EULA gate** — same EULA acceptance required as other tools

---

## Priority Summary

| # | Improvement | Priority | Effort | Impact |
|---|-------------|----------|--------|--------|
| 1 | `browser_execute_javascript` action | **P0** | Medium | Solves 80%+ of friction |
| 2 | JS click fallback in `browser_click_element` | **P0** | Low | Fixes click failures on SPAs |
| 3 | `selector` param on `browser_get_current_html` | P1 | Low | 10x HTML reduction |
| 4 | `extract_text` action | P1 | Low | Direct text extraction |
| 5 | `get_page_structure` action | P2 | Medium | Fast DOM understanding |
| 6 | Coordinate-based click | P2 | Low | Fallback click method |
| 7 | Structured list extraction | P3 | High | Covered by #1 |
