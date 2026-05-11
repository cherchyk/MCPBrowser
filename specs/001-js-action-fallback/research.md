# Research Findings — P0 JavaScript execution and click fallback

## Decisions

1) Execution timeout policy
- Decision: Default 30s, user-configurable up to 60s; hard-stop with structured timeout error.
- Rationale: Matches spec safety guidance and keeps parity with observed Gmail latency while preventing hangs.
- Alternatives considered: Shorter default (10s) risks premature failure on heavy pages; unlimited rejected for safety.

2) Response size cap and truncation
- Decision: Cap serialized result at ~100KB; include `truncated: true` flag and note in metadata.
- Rationale: Avoids oversized LLM payloads (Gmail inbox 220KB) while still returning meaningful structured data.
- Alternatives considered: No cap rejected (PII risk + latency); smaller cap (20KB) rejected to preserve small lists.

3) Serialization strategy for `browser_execute_javascript`
- Decision: Use `page.evaluate` return value serialization with guards: primitives direct; plain objects/arrays via JSON-safe clone; DOM nodes converted to `outerHTML`; errors captured with message + stack; strip functions/symbols.
- Rationale: Keeps deterministic, MCP-safe payloads; avoids circular references and unsupported types.
- Alternatives considered: `JSON.stringify` on raw value (fails on DOM/Map/Set) or full structured clone (heavier, unnecessary for contract).

4) URL-change and navigation detection
- Decision: Capture `beforeUrl`/`afterUrl`; set `urlChanged` boolean in response; if navigation occurred, include new URL in metadata.
- Rationale: Users must know whether script-induced navigation occurred to plan subsequent steps.
- Alternatives considered: Omit URL check (hides navigation side effects).

5) JS fallback trigger for clicks
- Decision: Trigger fallback only when element was found and native click timed out; log `fallbackUsed: true`; reuse post-click readiness waits.
- Rationale: Minimizes accidental double-clicking and keeps flow deterministic; aligns with spec acceptance scenarios.
- Alternatives considered: Always double-attempt (native + JS) increases side effects; user-triggered fallback adds extra tool calls.

6) Diagnostics and observability
- Decision: Include `executionTimeMs`, `urlChanged`, `fallbackUsed`, `truncated` flags plus error envelope (type/message/stack) in responses; redact inputs from logs.
- Rationale: Satisfies Constitution IV observability while guarding sensitive content.
- Alternatives considered: Bare success/error strings rejected (non-deterministic, low debuggability).

7) Testing scope
- Decision: Unit + integration + tool-selection coverage: success path, timeout, truncation, thrown error, DOM element return, navigation flag, native-timeout -> fallback success, dual-failure reporting.
- Rationale: Meets Constitution III and ensures contracts are deterministic across runners.
- Alternatives considered: Unit-only rejected (misses browser timing edge cases).

## Outstanding Questions

- None. Specifications contain required parameters (timeout cap, size cap, fallback trigger). Any API surface changes will be captured in contracts and tests.
