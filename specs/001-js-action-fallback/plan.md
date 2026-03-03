# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

# Implementation Plan: P0 JavaScript execution and click fallback

**Branch**: `001-js-action-fallback` | **Date**: 2026-03-03 | **Spec**: [specs/001-js-action-fallback/spec.md](specs/001-js-action-fallback/spec.md)
**Input**: Feature specification from `/specs/001-js-action-fallback/spec.md`

## Summary

Deliver two P0 capabilities: (1) an `execute_javascript` action that runs user-supplied scripts in the active page with enforced timeout, size caps, metadata, and structured errors; (2) a `click_element` fallback that retries timed-out native clicks via JavaScript and reports the fallback path. Both aim to cut inbox-style flows from 10+ calls to 1–2, while improving reliability on SPA-heavy pages (e.g., Gmail).

## Technical Context

**Language/Version**: Node.js 18+ (ESM)  
**Primary Dependencies**: `puppeteer-core@^23.4.1`, `@modelcontextprotocol/sdk@^1.25.1`  
**Storage**: N/A (in-memory process state only)  
**Testing**: Node-based runners in `MCPBrowser/tests` (`run-unit.js`, tool-selection tests, integration flows)  
**Target Platform**: MCP server running headful Chrome/Edge/Brave via DevTools protocol  
**Project Type**: MCP server/CLI package (no extension changes)  
**Performance Goals**: JS execution response <5s typical; fallback clicks succeed in ≥90% of prior timeout cases; responses remain within 100KB cap  
**Constraints**: Execution timeout default 30s (max 60s); structured responses; deterministic contracts; redact PII; maintain dual-project isolation  
**Scale/Scope**: Single MCP server package; no multi-service coordination; tests confined to MCPBrowser project

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. User-Safe Browser Mediation: enforce truncation/timeout, avoid logging secrets, keep tab scoping and EULA gate unchanged. ✅
- II. Deterministic MCP Tool Contracts: define structured inputs/outputs for `execute_javascript` and fallback result flags; add contract tests. ✅
- III. Test-First Coverage: add unit/integration + tool-selection cases covering success, timeout, truncation, fallback hit/miss. ✅
- IV. Observability & Diagnostics: include execution timing, URL-change flag, fallback-used flag; structured error payloads. ✅
- V. Intent-Explicit Documentation: update spec/quickstart/contracts; add rationale comments only where behavior is non-obvious. ✅
- VI. Dual-Project Independence: scope changes to MCPBrowser only; no VSCodeExtension impacts. ✅
- Runtime & Workflow Gates: stay on Node 18+, keep version-lock files aligned, avoid breaking contracts without version bump. ✅

## Project Structure

### Documentation (this feature)

```text
specs/001-js-action-fallback/
├── plan.md          # this plan
├── research.md      # Phase 0
├── data-model.md    # Phase 1
├── quickstart.md    # Phase 1
├── contracts/       # Phase 1
└── tasks.md         # Phase 2 (via /speckit.tasks)
```

### Source Code (repository root)

```text
MCPBrowser/
├── src/
│   ├── actions/               # click-element, fetch-page, etc.
│   ├── browsers/              # browser drivers (Chrome/Edge/Brave)
│   ├── core/                  # auth, page, responses, logger, html helpers
│   └── mcp-browser.js         # entrypoint/command wiring
└── tests/
    ├── actions/               # action-specific tests
    ├── browsers/              # browser harness helpers
    ├── core/                  # core unit tests
    ├── tool-selection/        # deterministic tool selection tests
    └── run-*.js               # runners (unit, all, tool-selection)
```

**Structure Decision**: Single MCP server package; no frontend/backend split. Changes live in `MCPBrowser/src/actions`, `MCPBrowser/src/core/responses` (if schema touches), with matching tests under `MCPBrowser/tests/actions` and `MCPBrowser/tests/tool-selection` as needed.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
