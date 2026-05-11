# Data Model — P0 JavaScript execution and click fallback

## Entities

### Action Request
- `url` (string, required): Active tab URL to target; used for routing and validation.
- `script` (string, required): JavaScript source executed via `page.evaluate` in page context.
- `timeoutMs` (integer, optional): Max execution time; default 30000; max 60000.
- `returnType` (enum, optional): `json` | `text` | `void`; default `json`; influences post-processing/truncation.

### Action Response
- `result` (any): Serialized return value (JSON-safe clone); omitted when `returnType` is `void` or on error.
- `type` (string): Detected JS type of `result` (string | number | boolean | object | array | null | undefined | dom-html).
- `executionTimeMs` (integer): Duration of script execution (excluding transport).
- `truncated` (boolean): Indicates the payload was capped at the size limit.
- `urlChanged` (boolean): Whether page URL changed during execution.
- `currentUrl` (string): URL after execution for traceability.
- `error` (object, optional): When failures occur; includes `name`, `message`, `stack` (stack optional on cross-origin limitations).

### Click Attempt
- `nativeAttempt` (object): Result of Puppeteer native click; fields `status` (success|timeout|error), `durationMs`, `error` (optional message/stack).
- `fallbackAttempt` (object): Result of JS `element.click()` retry; same shape as `nativeAttempt`.
- `fallbackUsed` (boolean): True when native click timed out and fallback was invoked.
- `finalStatus` (string): success|failed; reflects combined outcome.
- `postClickWait` (object): Outcome of readiness waits after the successful attempt (if any).
- `targetInfo` (object, optional): Selector/text/xpath/handle metadata used to locate the element (no PII, redacted as needed).

## Relationships
- `Action Response` embeds `Click Attempt` details when the action is `browser_click_element`.
- `Action Request` maps 1:1 to `Action Response`; metadata (timings, urlChanged, truncated) accompanies every response for observability.

## Validation Rules
- `timeoutMs` must be >0 and ≤60000; values above cap are clamped with a note in response metadata.
- `script` must be non-empty; empty scripts return a validation error without attempting execution.
- Size cap applies to `result`; truncation sets `truncated=true` and may omit trailing data.
- Fallback is invoked only when the element was resolved and native click status is `timeout`.

## State Considerations
- Execution is stateless beyond current page context; no data persisted between calls.
- Navigation during execution is surfaced via `urlChanged` and `currentUrl` to allow callers to realign state.
