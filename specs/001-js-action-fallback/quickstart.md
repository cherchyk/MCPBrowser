# Quickstart — P0 JavaScript execution and click fallback

## Prerequisites
- Node.js 18+ installed.
- MCPBrowser installed and configured with an authenticated browser profile (Chrome/Edge/Brave).
- EULA accepted via existing `accept-eula` flow.

## Running the server
```sh
cd MCPBrowser
npm install
npm run mcp
```

## Execute JavaScript on the active page
Example: list first 5 inbox rows with sender and subject.
```json
{
  "action": "execute_javascript",
  "url": "https://mail.google.com/",
  "script": "[...document.querySelectorAll('tr.zA')].slice(0,5).map((row,i)=>({index:i+1,sender:row.querySelector('.zF,.yP')?.textContent,subject:row.querySelector('.bog')?.textContent}))",
  "timeoutMs": 30000,
  "returnType": "json"
}
```
**What to expect**: Structured array result, `executionTimeMs`, `urlChanged`, and `truncated` flags. Large payloads are capped.

**Failure signals**: Structured `error` for thrown exceptions or timeouts (default 30s, max 60s); truncation flagged when payload exceeds ~100KB.

## Click with automatic JS fallback
No payload changes required; fallback is automatic when native click times out.
```json
{
  "action": "click_element",
  "url": "https://mail.google.com/",
  "selector": "tr.zA:nth-of-type(3)"
}
```
**What to expect**: Response includes `fallbackUsed` plus `nativeAttempt` and `fallbackAttempt` summaries. If both fail, errors for both attempts are returned.

## Error handling signals
- `error`: Structured envelope with `name`, `message`, optional `stack`.
- `truncated`: True when result capped (~100KB).
- `urlChanged`: True when navigation occurred during execution/click.
- `fallbackUsed`: True when JS retry path was taken after native timeout.

## Testing
- Unit tests: `cd MCPBrowser && node tests/run-unit.js`
- Full suite: `cd MCPBrowser && node tests/run-all.js`
- Tool selection regression: `cd MCPBrowser && node tests/tool-selection/run-tool-selection-tests.js`
