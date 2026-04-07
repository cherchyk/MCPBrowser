# Feature Specification: Gmail Plugin

**Feature Branch**: `003-gmail-plugin`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "As a first plugin I want to build a Gmail plugin. It has to have most common actions implemented in efficient way: using custom to Gmail JS and custom to Gmail selectors."
**Amended**: 2026-04-03 — Hybrid UI resilience approach: replace brittle CSS selectors with keyboard shortcuts for actions, URL scheme for navigation, ARIA/structural patterns for data extraction, and CSS selectors only as last-resort fallback.

## Clarifications

### Session 2026-04-03

- Q: What format should `read_email` return the email body in? → A: HTML preserved — return the original Gmail HTML body for full fidelity (formatting, links, inline images).
- Q: How should the plugin identify emails across actions? → A: Extract Gmail internal IDs where possible, fall back to positional index. Actions accept either an ID or an index, preferring IDs for stability across inbox changes.
- Q: Should the plugin track view state or detect it from the DOM each time? → A: DOM detection each time — inspect Gmail's DOM at action invocation to determine the current view (inbox list, email thread, compose, search results). No internal state tracking between calls.
- Q: Should `forward_email` be included as a P2/P3 action? → A: Include as P3 — forwarding is a natural complement to reply/compose with low incremental cost.
- Q: What timeout should actions use when waiting for Gmail's dynamic content to load? → A: 10 seconds — generous headroom for slow connections while failing fast enough to avoid hanging.

### Session 2026-04-03 (UI Resilience)

- Q: Gmail uses Closure Compiler-generated CSS class names (e.g., `tr.zA`, `span.bog`, `div.T-I.T-I-KE.L3`) that can change in any deploy. How should the plugin handle this fragility? → A: Adopt a hybrid layered strategy — use Gmail keyboard shortcuts for actions, URL hash navigation for folders/search, ARIA roles + `data-*` attributes + semantic HTML for data extraction, and CSS class selectors only as a versioned last-resort fallback.
- Q: Should the plugin use the Gmail REST API instead of browser automation for reading data? → A: No for v1 — the Gmail API requires OAuth2/API key setup and shifts the paradigm from browser automation to API client. The plugin should stay within MCPBrowser's browser automation model, but the architecture should not preclude a future API data source.
- Q: Gmail keyboard shortcuts require the user to have keyboard shortcuts enabled in Gmail settings. Should the plugin verify this? → A: Yes — the plugin should detect whether keyboard shortcuts are active and return a clear error with instructions if they are disabled.
- Q: How should index-targeted actions (archive, delete, label, mark) select a specific email row when using keyboard shortcuts for the action itself? → A: Hybrid DOM+keyboard — use DOM structure (Tier 3/4) to click/select the target email row, then use the keyboard shortcut for the action (e.g., `e` for archive). This avoids fragile cursor-position tracking while still using stable shortcuts for the action trigger.
- Q: How should `search_emails` execute the search: URL hash or keyboard shortcut? → A: URL hash navigation (Tier 1) — navigate to `mail.google.com/mail/u/N/#search/<encoded-query>` where `N` is the account index detected from the current page URL. The account index varies (`/u/0/`, `/u/1/`, `/u/2/`) depending on which Google account is active; the plugin must extract this from the current URL, never hardcode it.
- Q: What should the plugin do when a keyboard shortcut has no visible effect (e.g., shortcuts silently disabled, or action unavailable in current view)? → A: Pre-check — before sending the shortcut, verify the precondition via DOM/URL (e.g., thread is open for reply, row is selected for archive). Fail early with an actionable error if the precondition is not met, rather than relying on timing-dependent post-checks.

## Assumptions

- The plugin system from feature 002-site-plugins is implemented and available (plugin loader, registry, detection, `plugin_action`/`plugin_info` dispatch tools).
- The user is already authenticated into Gmail in the browser session managed by MCPBrowser before invoking plugin actions. The plugin does not handle Google account login.
- Gmail is accessed via the standard web interface at `mail.google.com` (not the basic HTML version or third-party clients).
- The plugin targets the default Gmail inbox layout (default, comfortable, or compact density). Split-pane or other experimental layouts are out of scope for v1.
- Gmail keyboard shortcuts are expected to be enabled in the user's Gmail settings (Settings → General → Keyboard shortcuts → ON). The plugin will verify this and provide remediation guidance if disabled.
- Gmail's URL hash scheme (`#inbox`, `#sent`, `#search/query`, `#compose`) and keyboard shortcuts are considered stable public interfaces that change far less frequently than internal CSS class names.
- Email content extraction focuses on the visible/rendered content. Attachments are reported as metadata (name, size, type) but binary download is out of scope for v1.
- The plugin operates on whatever Gmail account is currently signed in. Multi-account switching is out of scope.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - List Emails in a Folder (Priority: P1)

An AI agent navigates to Gmail and asks the plugin to list emails in the inbox (or another folder/label). The plugin uses Gmail-specific selectors to extract a structured list of emails including sender, subject, date, and snippet. The agent receives this data ready for summarization, triage, or further action.

**Why this priority**: Listing emails is the foundational read operation. Every other Gmail workflow (reading, replying, organizing) starts with knowing what emails exist. This also validates that the plugin's Gmail-specific selectors and detection work correctly end-to-end.

**Independent Test**: Navigate MCPBrowser to `mail.google.com`, invoke `plugin_action({ plugin: "gmail", action: "list_emails" })`, and verify structured email data is returned with sender, subject, date, and snippet for each visible email.

**Acceptance Scenarios**:

1. **Given** the browser is on the Gmail inbox with multiple emails, **When** the agent calls `list_emails` with no parameters, **Then** the plugin returns up to 25 emails (default limit) with sender, subject, date, snippet, and read/unread status for each.
2. **Given** the browser is on Gmail, **When** the agent calls `list_emails` with `{ folder: "sent" }`, **Then** the plugin navigates to the Sent folder and returns emails from that folder.
3. **Given** the browser is on Gmail, **When** the agent calls `list_emails` with `{ limit: 5 }`, **Then** exactly 5 or fewer emails are returned.
4. **Given** the browser is on a page that is not Gmail, **When** the agent calls `list_emails`, **Then** the plugin returns an error stating Gmail must be the active page and suggesting `fetch_webpage` to navigate there first.

---

### User Story 2 - Read a Specific Email (Priority: P1)

The agent selects an email from the list (or specifies one by subject/position) and asks the plugin to open and read its full content. The plugin clicks into the email thread using Gmail selectors and extracts the full message body, all participants, timestamps, and attachment metadata.

**Why this priority**: Reading email content is the core value proposition — the agent cannot summarize, analyze, or respond to emails without being able to read them. Combined with list_emails, this completes the essential read path.

**Independent Test**: After listing emails, invoke `plugin_action({ plugin: "gmail", action: "read_email", params: { index: 0 } })` and verify the full email body, sender, recipients, date, and attachment info are returned.

**Acceptance Scenarios**:

1. **Given** the inbox is displayed with emails listed, **When** the agent calls `read_email` with `{ index: 0 }`, **Then** the plugin opens the first email and returns the full message body, sender, all recipients (to/cc), date, subject, and attachment metadata (name, size, type if available).
2. **Given** the agent opens a multi-message thread, **When** `read_email` is called, **Then** all messages in the thread are returned in chronological order, each with its own sender, date, and body.
3. **Given** the agent calls `read_email` with an index that exceeds the visible email count, **Then** an error is returned indicating the index is out of range and suggesting `list_emails` to see available emails.

---

### User Story 3 - Search Emails (Priority: P1)

The agent asks the plugin to search Gmail for specific emails using Gmail's search functionality. The plugin enters the query into Gmail's search bar, waits for results, and extracts the matching emails as a structured list — identical in format to `list_emails`.

**Why this priority**: Search is essential for any realistic email workflow. Users rarely want to scan the entire inbox; they need to find specific emails by sender, subject, date, or keywords. Gmail's search is powerful and the plugin should leverage it fully.

**Independent Test**: Invoke `plugin_action({ plugin: "gmail", action: "search_emails", params: { query: "from:someone@example.com" } })` and verify matching emails are returned in the same structured format as `list_emails`.

**Acceptance Scenarios**:

1. **Given** the browser is on Gmail, **When** the agent calls `search_emails` with `{ query: "from:boss@company.com" }`, **Then** the plugin enters the query in Gmail's search bar, waits for results to load, and returns matching emails with sender, subject, date, and snippet.
2. **Given** a search query returns no results, **When** the agent calls `search_emails`, **Then** the plugin returns an empty list with a message indicating no emails matched the query.
3. **Given** a search query matches many results, **When** the agent calls `search_emails` with `{ limit: 10 }`, **Then** at most 10 results are returned.

---

### User Story 4 - Compose a New Email (Priority: P2)

The agent asks the plugin to compose and send a new email. The plugin opens Gmail's compose window, fills in the recipient(s), subject, and body using Gmail-specific selectors, and optionally sends it.

**Why this priority**: Composing email is the primary write operation. While reading is more common for AI agents, the ability to draft and send emails on behalf of the user is a high-value automation. It's P2 because read-path actions must work first.

**Independent Test**: Invoke `plugin_action({ plugin: "gmail", action: "compose_email", params: { to: "test@example.com", subject: "Hello", body: "Test message" } })` and verify the compose window is populated with the correct fields.

**Acceptance Scenarios**:

1. **Given** the browser is on Gmail, **When** the agent calls `compose_email` with `{ to: "user@example.com", subject: "Meeting", body: "Let's meet tomorrow." }`, **Then** the plugin opens the compose window and fills in the To, Subject, and Body fields.
2. **Given** the agent calls `compose_email` with `{ to: "user@example.com", subject: "Meeting", body: "Details attached.", cc: "manager@example.com", send: true }`, **Then** the plugin fills all fields, adds the CC recipient, and clicks Send.
3. **Given** the agent calls `compose_email` without the `send` flag (or `send: false`), **Then** the compose window is populated but the email is left as a draft for the user to review before sending.
4. **Given** the agent calls `compose_email` with an empty `to` field, **Then** an error is returned indicating that at least one recipient is required.

---

### User Story 5 - Reply to an Email (Priority: P2)

The agent is viewing an email thread and asks the plugin to reply. The plugin clicks Gmail's reply button, fills in the response body, and optionally sends it. The agent can choose between reply (to sender only) and reply-all (to all participants).

**Why this priority**: Replying is the second most common write operation after composing, and a natural follow-up to reading an email. Combined with read_email, this enables full conversational email workflows.

**Independent Test**: After reading an email, invoke `plugin_action({ plugin: "gmail", action: "reply_email", params: { body: "Thanks, noted." } })` and verify the reply window is populated and optionally sent.

**Acceptance Scenarios**:

1. **Given** the agent has an email thread open, **When** `reply_email` is called with `{ body: "Got it, thanks!" }`, **Then** the plugin clicks Reply, enters the body text, and leaves the reply as a draft.
2. **Given** the agent has an email thread open, **When** `reply_email` is called with `{ body: "Acknowledged.", replyAll: true, send: true }`, **Then** the plugin clicks Reply All, enters the body, and sends the reply.
3. **Given** no email thread is currently open, **When** `reply_email` is called, **Then** an error is returned indicating that an email must be open first, suggesting `read_email` to open one.

---

### User Story 6 - Forward, Archive, Delete, or Label an Email (Priority: P3)

The agent asks the plugin to perform organizational or forwarding actions on emails: forward to a new recipient, archive, delete (move to trash), or apply/remove a label. These actions work on the currently viewed email or on selected emails from the list.

**Why this priority**: Forwarding and organization actions complete the email management lifecycle but are lower priority than reading, searching, and composing. They're valuable for delegation workflows (forward) and inbox-zero workflows (archive, label, delete).

**Independent Test**: After reading an email, invoke `plugin_action({ plugin: "gmail", action: "forward_email", params: { to: "colleague@example.com" } })` and verify the forward compose window is populated with the original message and the new recipient.

**Acceptance Scenarios**:

1. **Given** the inbox is displayed, **When** the agent calls `archive_email` with `{ index: 0 }`, **Then** the first email is archived and is no longer visible in the inbox.
2. **Given** an email thread is open, **When** the agent calls `delete_email`, **Then** the email is moved to Trash and the agent is returned to the email list.
3. **Given** the inbox is displayed, **When** the agent calls `label_email` with `{ index: 0, label: "Work" }`, **Then** the "Work" label is applied to the first email.
4. **Given** the agent calls `label_email` with a label that doesn't exist, **Then** an error is returned listing available labels.
5. **Given** an email thread is open, **When** the agent calls `forward_email` with `{ to: "colleague@example.com" }`, **Then** the plugin clicks Forward, fills in the recipient, and leaves the forward as a draft.
6. **Given** an email thread is open, **When** the agent calls `forward_email` with `{ to: "colleague@example.com", body: "FYI see below.", send: true }`, **Then** the plugin forwards the email with the additional body text and sends it.

---

### User Story 7 - Mark Email as Read or Unread (Priority: P3)

The agent asks the plugin to toggle the read/unread status of an email from the email list view.

**Why this priority**: A convenience action for inbox management. Lower priority than core read/write/search operations.

**Independent Test**: Invoke `plugin_action({ plugin: "gmail", action: "mark_read", params: { index: 0 } })` on an unread email and verify its visual status changes.

**Acceptance Scenarios**:

1. **Given** the inbox is displayed with an unread email at index 0, **When** `mark_read` is called with `{ index: 0 }`, **Then** the email is marked as read.
2. **Given** the inbox is displayed with a read email at index 1, **When** `mark_unread` is called with `{ index: 1 }`, **Then** the email is marked as unread.

---

### Edge Cases

- What happens when Gmail's UI hasn't fully loaded (spinners, skeleton screens)? The plugin must wait for content to be ready before extracting data, with a timeout and clear error if the page doesn't stabilize.
- What happens when Gmail shows a CAPTCHA, security prompt, or "Confirm it's you" interstitial? The plugin should detect these states and return an error asking the user to resolve the prompt manually in the browser.
- What happens when the Gmail UI language is not English? The plugin should rely on structural selectors (CSS classes, data attributes, ARIA roles) rather than visible text labels to be language-agnostic where possible.
- What happens when Gmail rolls out a UI update that changes CSS class names? Because the plugin primarily uses keyboard shortcuts, URL navigation, and ARIA/structural selectors, most actions are unaffected by CSS class changes. For the remaining Tier 4 CSS selectors used in data extraction, the plugin should fail gracefully with descriptive errors identifying which selector failed and its tier level, making it easy to diagnose and update the centralized selectors module.
- What happens when the compose window is already open and `compose_email` is called? The plugin should detect an existing compose window and either reuse it or close it before opening a new one, warning the user if unsaved draft content would be lost.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The plugin MUST implement the standard MCPBrowser plugin interface (manifest, `matchesPage`, `getActions`, `getInfo`) as defined by feature 002-site-plugins.
- **FR-002**: The plugin MUST detect Gmail pages by matching against `mail.google.com` in the URL and verifying Gmail-specific DOM markers for confidence.
- **FR-003**: The plugin MUST provide a `list_emails` action that extracts visible emails from the current folder/view and returns structured data: sender name, sender email, subject line, date/time, snippet preview, and read/unread status.
- **FR-004**: The plugin MUST provide a `read_email` action that opens an email by index and extracts the full thread: individual messages with sender, all recipients (to, cc), date, HTML body (original formatting preserved), and attachment metadata (name, size, type).
- **FR-005**: The plugin MUST provide a `search_emails` action that uses Gmail's URL hash scheme (`#search/<encoded-query>`) to execute searches (Tier 1) and returns results in the same structured format as `list_emails`.
- **FR-006**: The plugin MUST provide a `compose_email` action that opens Gmail's compose window and fills in To, CC (optional), Subject, and Body fields, with an option to send immediately or leave as draft. If one or more compose windows are already open (`div[role="dialog"]`), the plugin MUST close them before opening a new one and log a warning that unsaved draft content may have been discarded.
- **FR-007**: The plugin MUST provide a `reply_email` action that replies to the currently open email thread, supporting both reply (sender only) and reply-all modes, with an option to send or leave as draft.
- **FR-008**: The plugin MUST provide `archive_email` and `delete_email` actions for removing emails from the inbox (archive) or moving them to trash (delete).
- **FR-009**: The plugin MUST provide a `label_email` action for applying a Gmail label to an email.
- **FR-010**: The plugin MUST provide `mark_read` and `mark_unread` actions for toggling email read status.
- **FR-011**: All actions MUST follow a tiered interaction strategy, preferring the most stable interface available for each operation:
  - **Tier 1 — URL scheme**: For navigation to folders (`#inbox`, `#sent`, `#drafts`, `#trash`, `#spam`, `#label/LabelName`) and search (`#search/query`). Most stable; part of Gmail's public URL contract. Note: `#compose` exists but is unreliable across Gmail versions — compose uses keyboard `c` (Tier 2) instead.
  - **Tier 2 — Keyboard shortcuts**: For actions (compose: `c`, reply: `r`, reply-all: `a`, forward: `f`, archive: `e`, delete: `#`, search focus: `/`, mark read: `Shift+i`, mark unread: `Shift+u`, navigate list: `j`/`k`, open: `o`/`Enter`, select: `x`, label: `l`, send: `Ctrl+Enter`/`⌘+Enter`). Stable; publicly documented by Google.
  - **Tier 3 — ARIA roles, `data-*` attributes, `name` attributes, and semantic HTML**: For data extraction and form filling (`role="main"`, `role="listbox"`, `role="row"`, `role="dialog"`, `data-legacy-message-id`, `name="q"`, `name="to"`, `name="subjectbox"`, `contenteditable` message body). Moderately stable; tied to accessibility and form standards.
  - **Tier 4 — CSS class selectors**: Only as a last resort for DOM elements that lack ARIA roles or data attributes (e.g., distinguishing subject from snippet within an email row). These selectors MUST be centralized in a single versioned selectors module for easy updating.
- **FR-012**: All actions MUST wait for Gmail's dynamic content to load before extracting data, with a maximum timeout of 10 seconds. If content does not stabilize within the timeout, the action MUST return a clear error indicating the page did not finish loading.
- **FR-019**: The plugin MUST detect whether Gmail keyboard shortcuts are enabled before relying on them. If shortcuts are disabled, the plugin MUST return an actionable error message explaining how to enable them (Gmail Settings → General → Keyboard shortcuts → ON).
- **FR-020**: The plugin MUST use Gmail's URL hash scheme for folder navigation (`#inbox`, `#sent`, `#drafts`, `#trash`, `#spam`, `#label/LabelName`) and search (`#search/query`) instead of clicking sidebar or search UI elements via CSS selectors. All URL-based navigation MUST preserve the current account index (`/u/N/`) extracted from the active page URL — the account index MUST NOT be hardcoded.
- **FR-021**: The plugin MUST use keyboard shortcuts for triggering Gmail actions (compose, reply, reply-all, forward, archive, delete, mark read/unread, label) instead of clicking toolbar buttons via CSS selectors.
- **FR-022**: For data extraction (reading email lists, thread content, attachment metadata), the plugin MUST prefer ARIA roles, `data-*` attributes, `name` attributes, and semantic HTML structure over CSS class selectors. CSS class selectors are permitted only for elements that cannot be identified by any higher-tier method.
- **FR-023**: All CSS class selectors (Tier 4) MUST be centralized in a single selectors module, versioned and documented, so that a Gmail UI update can be resolved by updating selector values in one place without modifying action logic.
- **FR-024**: The plugin MUST detect its current Gmail view by inspecting the URL hash (`#inbox`, `#search/`, `#compose`, `#label/`) as the primary signal, falling back to ARIA roles and DOM structure only when the URL is ambiguous.
- **FR-025**: Before sending any keyboard shortcut (Tier 2), the plugin MUST verify the required precondition via DOM or URL inspection (e.g., a thread must be open before pressing `r` for reply, a row must be selected before pressing `e` for archive). If the precondition is not met, the plugin MUST fail immediately with an actionable error message describing the required state and suggesting the corrective action, rather than sending the shortcut and relying on post-hoc outcome detection.
- **FR-013**: All actions MUST return structured responses using the MCPBrowser response format with contextual `nextSteps` guiding the agent to logical follow-up actions.
- **FR-014**: The plugin MUST return clear, actionable error messages when Gmail is not the active page, when an expected element is not found, or when a prerequisite action (like opening an email) hasn't been performed.
- **FR-015**: The `compose_email` action MUST NOT send email by default — sending requires an explicit `send: true` parameter to prevent accidental sends by the AI agent.
- **FR-016**: All actions that reference a specific email MUST accept either a Gmail internal ID (if previously returned by `list_emails` or `search_emails`) or a 0-based positional index as a fallback. When IDs are extractable from the DOM, `list_emails` and `search_emails` MUST include them in the response. For row-targeted actions (archive, delete, label, mark read/unread), the plugin MUST use a hybrid DOM+keyboard approach: locate and select the target row via DOM (Tier 3/4), then trigger the action via keyboard shortcut (Tier 2).
- **FR-017**: The plugin MUST be stateless between action calls — each action MUST detect the current Gmail view (inbox list, thread view, compose window, search results) by inspecting the DOM at invocation time, not by relying on internal state from previous calls.
- **FR-018**: The plugin MUST provide a `forward_email` action that forwards the currently open email thread to a new recipient, with an optional additional body text and `send: true` to send immediately (default: draft).

### Key Entities

- **Email Summary**: A lightweight representation of an email in a list view — sender name, sender email, subject, date, snippet, read/unread status. Used by `list_emails` and `search_emails`.
- **Email Thread**: A full email conversation — contains one or more individual messages, each with sender, recipients, date, body, and attachment metadata. Used by `read_email`.
- **Email Message**: A single message within a thread — sender, to-recipients, cc-recipients, date/time, HTML body (original formatting preserved), and list of attachments.
- **Attachment Metadata**: Information about an email attachment — file name, size, and MIME type. Binary content is not extracted.
- **Gmail Label**: A Gmail organizational label — name and optionally color. Used by `label_email`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An AI agent can list, search, and read Gmail emails in under 5 seconds per action on a standard connection, enabling real-time conversational email workflows.
- **SC-002**: The plugin correctly extracts email data (sender, subject, body, attachments) from at least 95% of standard Gmail emails without data loss or formatting corruption.
- **SC-003**: An AI agent can compose and send a new email through a single `compose_email` action call, with all fields correctly populated and the email appearing in the recipient's inbox.
- **SC-004**: All plugin actions provide contextual next-step guidance, enabling an AI agent to chain actions (list → read → reply) without requiring external documentation or user intervention.
- **SC-005**: When Gmail is not loaded or a prerequisite is missing, 100% of error responses include a specific remediation step the agent can follow to recover.
- **SC-006**: The plugin operates correctly regardless of Gmail's display language setting, relying on structural selectors rather than visible text.
- **SC-007**: At least 70% of plugin interactions (navigation + actions) use Tier 1 (URL) or Tier 2 (keyboard) methods that do not depend on any CSS class selectors, minimizing breakage risk from Gmail UI updates.
- **SC-008**: When a Gmail UI update does break CSS selectors, the fix requires changes only to the centralized selectors module — no action logic files need modification.
