<!--
Sync Impact Report
- Version: 1.1.1 -> 1.1.2
- Modified principles: III. Test-First Coverage (explicit test planning and execution as completion gate); Development Workflow & Review Gates (implement step must run planned tests; completion defined by passing tests)
- Added principles: None
- Added sections: None
- Removed sections: None
- Templates: ✅ .specify/templates/plan-template.md (test planning directive added); ✅ .specify/templates/spec-template.md (no changes needed); ✅ .specify/templates/tasks-template.md (tests marked mandatory and run-in-implementation); ⚠️ No commands templates present in .specify/templates (none to update)
- Follow-up TODOs: None
-->

# MCPBrowser Constitution

## Core Principles

### I. User-Safe Browser Mediation (NON-NEGOTIABLE)
- All browsing runs through the user's real Chrome/Edge/Brave session; never capture credentials, 2FA codes, or sensitive cookies in logs or outputs.
- Require explicit user intent for risky actions (form submission, file upload, destructive clicks); default to the safest no-op when uncertain.
- Scope sessions to the minimum domains necessary and close tabs when finished to avoid lingering auth state.

### II. Deterministic MCP Tool Contracts
- Every MCP tool (browser_fetch_webpage, browser_click_element, browser_type_text, browser_get_current_html, browser_scroll_page, browser_take_screenshot, browser_close_tab) MUST have stable inputs/outputs documented in specs and tests before release.
- Structured responses are required: success payloads plus machine-parseable error shapes; include hostname/tab context for traceability.
- Backward-incompatible changes demand a contract version bump and migration notes in specs/ contracts/.

### III. Test-First Coverage
- Plans MUST enumerate test coverage (unit, integration, tool-selection) before implementation begins.
- Add or update tests before implementing changes: unit for core logic, integration for browser flows, and tool-selection regression where applicable.
- New MCP tool behaviors require deterministic fixtures (sample HTML, screenshot expectations) to prevent flaky regressions.
- Implementation steps MUST execute the planned tests; work is only considered complete when those tests pass.
- CI/PRs must fail on missing or brittle tests; red-green-refactor is the enforced loop.

### IV. Observability & Diagnostics
- Emit structured logs with correlation IDs per URL/hostname and clearly labeled error causes; redact secrets and PII.
- Capture diagnostics on failure paths (HTML snapshot or screenshot when size allows) while honoring redaction rules.
- Document expected latency budgets (e.g., fetch vs. browser_get_current_html) and surface timing in responses for tuning.

### V. Intent-Explicit Documentation
- Each file, class, and function MUST state its purpose/intent (why it exists, what it does) near its definition.
- Within functions, add brief rationale comments only where behavior is non-obvious or risk-prone; keep them current when logic changes.
- Specs, quickstarts, and README entries must stay in sync with shipped behavior; remove stale guidance promptly.

### VI. Dual-Project Independence
- The repo contains two products: the MCPBrowser npm package (server) and the VS Code extension. Keep build, release, and test flows isolated per project.
- Preserve test layout: MCPBrowser tests remain under MCPBrowser/tests; VS Code extension tests remain under VSCodeExtension/test. Do not merge or cross-wire harnesses.
- Changes in one project must not break the other; PRs should clarify scope (server vs extension) and include targeted tests accordingly.

## Runtime Constraints & Security
- Node.js 18+ and supported browsers are the only sanctioned runtime stack; avoid unvetted native modules or hidden binaries.
- Do not persist user secrets; profile directories must be user-controlled and discoverable; temporary artifacts are cleaned after runs.
- Handle third-party terms: respect robots.txt when appropriate, avoid automated abuse, and honor site rate/usage constraints.
- Size discipline: keep returned HTML trimmed unless explicitly requested; avoid excessive screenshots that risk PII leakage.

## Development Workflow & Review Gates
- Plan/spec/tasks derived from the templates must include a Constitution Check section that maps work to these principles before coding.
- PR review gates: verify tests exist and pass (including those specified in the plan), logs remain structured/redacted, contracts are versioned, documentation intent headers are present, dual-project test suites remain intact, and the four versioned files stay identical (root package.json, MCPBrowser/package.json, VSCodeExtension/package.json, server.json).
- Breaking contract changes require a migration note in specs/ contracts/ and a corresponding version bump per Governance.
- Implementation checklists must include a “run planned tests” step; completion is defined by passing results, not by code landing.
- Keep task grouping by user story to preserve independent delivery and testing; avoid cross-story coupling unless documented.

## Governance
- This constitution supersedes conflicting practices. Amendments require explicit diff in PR description, updated version tag, and rationale.
- Versioning: MAJOR for principle removals/redefinitions, MINOR for new principles or material expansions, PATCH for clarifications/typos.
- Ratification date reflects initial adoption; Last Amended updates with each merged change. Compliance is reviewed at PR and release time.
- Runtime guidance (README, docs/, specs/) must be updated alongside principle changes; omissions block merges.

**Version**: 1.1.2 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-03-03
