<!--
Sync Impact Report
- Version: 1.1.0 -> 1.1.1
- Modified principles: VI. Dual-Project Independence (added version alignment gate in workflow); Development Workflow & Review Gates (added explicit version lock step)
- Added principles: None
- Added sections: None
- Removed sections: None
- Templates: ✅ .specify/templates/plan-template.md (aligned); ✅ .specify/templates/spec-template.md (aligned); ✅ .specify/templates/tasks-template.md (aligned); ⚠️ No commands templates present in .specify/templates (none to update)
- Follow-up TODOs: None
-->

# MCPBrowser Constitution

## Core Principles

### I. User-Safe Browser Mediation (NON-NEGOTIABLE)
- All browsing runs through the user's real Chrome/Edge/Brave session; never capture credentials, 2FA codes, or sensitive cookies in logs or outputs.
- Require explicit user intent for risky actions (form submission, file upload, destructive clicks); default to the safest no-op when uncertain.
- Scope sessions to the minimum domains necessary and close tabs when finished to avoid lingering auth state.

### II. Deterministic MCP Tool Contracts
- Every MCP tool (fetch_webpage, click_element, type_text, get_current_html, scroll_page, take_screenshot, close_tab) MUST have stable inputs/outputs documented in specs and tests before release.
- Structured responses are required: success payloads plus machine-parseable error shapes; include hostname/tab context for traceability.
- Backward-incompatible changes demand a contract version bump and migration notes in specs/ contracts/.

### III. Test-First Coverage
- Add or update tests before implementing changes: unit for core logic, integration for browser flows, and tool-selection regression where applicable.
- New MCP tool behaviors require deterministic fixtures (sample HTML, screenshot expectations) to prevent flaky regressions.
- CI/PRs must fail on missing or brittle tests; red-green-refactor is the enforced loop.

### IV. Observability & Diagnostics
- Emit structured logs with correlation IDs per URL/hostname and clearly labeled error causes; redact secrets and PII.
- Capture diagnostics on failure paths (HTML snapshot or screenshot when size allows) while honoring redaction rules.
- Document expected latency budgets (e.g., fetch vs. get_current_html) and surface timing in responses for tuning.

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
- PR review gates: verify tests exist and pass, logs remain structured/redacted, contracts are versioned, documentation intent headers are present, dual-project test suites remain intact, and the four versioned files stay identical (root package.json, MCPBrowser/package.json, VSCodeExtension/package.json, server.json).
- Breaking contract changes require a migration note in specs/ contracts/ and a corresponding version bump per Governance.
- Keep task grouping by user story to preserve independent delivery and testing; avoid cross-story coupling unless documented.

## Governance
- This constitution supersedes conflicting practices. Amendments require explicit diff in PR description, updated version tag, and rationale.
- Versioning: MAJOR for principle removals/redefinitions, MINOR for new principles or material expansions, PATCH for clarifications/typos.
- Ratification date reflects initial adoption; Last Amended updates with each merged change. Compliance is reviewed at PR and release time.
- Runtime guidance (README, docs/, specs/) must be updated alongside principle changes; omissions block merges.

**Version**: 1.1.1 | **Ratified**: 2026-03-03 | **Last Amended**: 2026-03-03
