# Contract — browser_click_element with JS fallback

## Request
- Existing `browser_click_element` inputs (selector/text/xpath/coordinates, url/tab) remain unchanged.
- No new required fields; fallback is automatic when native click times out after element resolution.

## Response (success)
- `status`: `success`.
- `fallbackUsed` (boolean): True if native click timed out and JS fallback executed.
- `nativeAttempt`: `{ status, durationMs, error? }` describing the native click result.
- `fallbackAttempt` (present when `fallbackUsed`): `{ status, durationMs, error? }` describing JS click result.
- `postClickWait`: Result of readiness/wait logic (e.g., navigation or network idle).
- `currentUrl`: URL after click; compare against pre-click for navigation awareness.

## Response (error)
- `status`: `failed`.
- `fallbackUsed`: True if fallback was attempted.
- `nativeAttempt`: As above, including timeout/error details.
- `fallbackAttempt`: As above, including error when JS click fails.
- `currentUrl`: URL after attempts for traceability.
- `error`: Consolidated message summarizing both attempts.

## Behavior Notes
- Fallback triggers only when element is located and native click ends with timeout; other native errors surface without fallback unless explicitly safe to retry.
- Fallback uses `page.evaluate(el => el.click(), handle)` and then runs the same post-click readiness waits as native path.
- All responses remain structured and machine-parseable, with no PII or secrets logged.

## Test Coverage Expectations
- Native success (no fallback) — `fallbackUsed=false`.
- Native timeout -> fallback success — `fallbackUsed=true`, native `status=timeout`, fallback `status=success`.
- Dual failure — both attempts logged, `status=failed` with consolidated error.
- Post-click readiness still executed after fallback.
