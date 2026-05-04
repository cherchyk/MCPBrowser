# Contract — browser_execute_javascript action

## Request
- `url` (string, required): Target tab/page URL; must match an open session.
- `script` (string, required): JavaScript source to run within page context.
- `timeoutMs` (integer, optional): Max execution duration. Default 30000; max 60000 (clamped with notice).
- `returnType` (enum, optional): `json` | `text` | `void`. Default `json`.

## Response (success)
- `result`: Serialized output respecting `returnType`.
- `type` (string): Detected JS type (`string`, `number`, `boolean`, `object`, `array`, `null`, `undefined`, `dom-html`).
- `executionTimeMs` (integer): Time spent executing the script.
- `truncated` (boolean): True if `result` exceeded cap (~100KB) and was trimmed.
- `urlChanged` (boolean): True if page URL changed during execution.
- `currentUrl` (string): URL after execution.

## Response (error)
- `error`: Object with `name`, `message`, optional `stack` (redacted/cross-origin safe).
- `executionTimeMs`: Time until failure.
- `urlChanged`, `currentUrl`: Present to signal navigation side effects.
- `truncated`: True if error payload was capped (rare).

## Behavior Notes
- DOM nodes returned by the script are serialized to `outerHTML` and flagged as `dom-html` type.
- Functions, Symbols, and unserializable values are omitted; response remains JSON-safe.
- Timeout produces structured timeout error; script is aborted and no partial data is returned beyond metadata.
- No cookies or secrets are logged; script input is not echoed back in the response.

## Test Coverage Expectations
- Success path with simple JSON result.
- DOM return -> `dom-html` type.
- Thrown error -> structured error envelope.
- Timeout -> timeout error, no hang.
- Truncation -> `truncated=true`, capped payload.
- Navigation side effect -> `urlChanged=true`, `currentUrl` set.
