# Architectural Improvement: Separating Navigation from HTML Extraction

## Problem

Previously, `fetch_webpage` performed **two distinct functions**:
1. **Navigate/load** a webpage (or reuse existing page)
2. **Extract HTML** from the DOM

This created inefficiency in interactive workflows:

```
User clicks button → wait for content → fetch_webpage (RELOADS page!) → extract HTML
                                              ↑
                                        UNNECESSARY!
```

After interactions like `click_element`, `type_text`, or `wait_for_element`, we don't need to **reload** the page - we just need the **updated DOM state**.

## Solution

Introduced a new function: **`get_current_html`**

### New Workflow

```
Initial load:     fetch_webpage(url)           → Navigate + Extract HTML
After interaction: click_element(selector)     → Click
                   wait_for_element(selector)  → Wait for content
                   get_current_html(url)       → Extract HTML ONLY (no navigation!)
```

### Benefits

1. **Performance**: No unnecessary page reloads
2. **Accuracy**: Captures exact DOM state after interaction
3. **Efficiency**: Faster response times
4. **State preservation**: Doesn't lose dynamic JavaScript state
5. **Better architecture**: Single Responsibility Principle

## API

### `get_current_html`

Gets HTML from an already-loaded page without navigation.

**Parameters:**
- `url` (required): URL of the page (for identifying which tab)
- `removeUnnecessaryHTML` (default: true): Clean HTML like fetch_webpage

**Returns:**
```json
{
  "success": true,
  "url": "https://mail.google.com/mail/u/0/#inbox/12345",
  "html": "<html>...</html>"
}
```

**Use after:**
- `click_element` - Get HTML after clicking
- `type_text` - Get HTML after form input
- `wait_for_element` - Get HTML after dynamic content loads

## Example Usage

### Old inefficient way:
```javascript
// Load Gmail
await fetch_webpage({ url: "https://mail.google.com" })

// Click first email
await click_element({ url: "...", selector: "tr:first-child" })

// Wait for content
await wait_for_element({ url: "...", selector: ".email-body" })

// Get updated HTML - PROBLEM: This reloads the page!
await fetch_webpage({ url: "..." })  // ❌ Wasteful!
```

### New efficient way:
```javascript
// Load Gmail
await fetch_webpage({ url: "https://mail.google.com" })

// Click first email
await click_element({ url: "...", selector: "tr:first-child" })

// Wait for content
await wait_for_element({ url: "...", selector: ".email-body" })

// Get updated HTML - Just extracts DOM, no navigation
await get_current_html({ url: "..." })  // ✅ Efficient!
```

## Implementation Details

- Reuses existing `extractAndProcessHtml` from `core/page.js`
- Uses same HTML cleaning/enrichment pipeline as `fetch_webpage`
- Requires page to be already loaded (returns error if not)
- No navigation, no waiting - just instant DOM extraction

## When to Use Each Function

### Use `fetch_webpage` when:
- Loading a page for the first time
- Navigating to a new URL
- Need to handle authentication flows

### Use `get_current_html` when:
- Getting updated content after interactions
- Page is already loaded and you just need current state
- Want faster response without navigation overhead

## Performance Impact

In typical workflows (initial load + 2-3 interactions), this saves:
- **Time**: 2-5 seconds per interaction (no page reload)
- **Network**: Unnecessary HTTP requests
- **Browser resources**: No DOM reconstruction

## Testing

Run test suite:
```bash
node tests/get-current-html.test.js
```

Verifies:
- HTML extraction without navigation works
- Content matches current page state
- Cleaning option functions correctly
