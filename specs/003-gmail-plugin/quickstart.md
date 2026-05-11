# Quickstart: Gmail Plugin (Hybrid UI Resilience)

**Feature**: 003-gmail-plugin | **Date**: 2026-04-03 (rewrite)

## Prerequisites

- MCPBrowser with plugin system (feature 002-site-plugins) installed and functional
- A browser session with Gmail signed in (the plugin does not handle authentication)
- **Gmail keyboard shortcuts enabled** (Gmail Settings → General → Keyboard shortcuts → ON)
- `"gmail"` added to `plugins.json` `enabled` array

## Enable the Plugin

Edit `MCPBrowser/src/plugins.json`:

```json
{
  "enabled": ["gmail"]
}
```

Restart MCPBrowser. The plugin loader will load `plugins/gmail/index.js` and log:
```
[plugins] Loaded plugin: gmail v1.0.0
```

## Basic Usage Flow

### 1. Navigate to Gmail

```
browser_fetch_webpage({ url: "https://mail.google.com" })
```

Response includes plugin detection: `"Gmail plugin available — use browser_plugin_info for actions"`

### 2. Discover Available Actions

```
browser_plugin_info({ plugin: "gmail" })
```

Returns all 11 actions with their parameters.

### 3. List Inbox Emails

```
browser_plugin_action({ plugin: "gmail", action: "list_emails" })
```

Navigates to `#inbox` via URL hash (Tier 1). Returns up to 25 emails with sender, subject, date, snippet, and read/unread status.

### 4. Read an Email

```
browser_plugin_action({ plugin: "gmail", action: "read_email", params: { index: 0 } })
```

Opens the first email (via URL hash navigation to thread, or keyboard `o`). Returns the full thread with messages, recipients, and attachments.

### 5. Reply to the Email

```
browser_plugin_action({ plugin: "gmail", action: "reply_email", params: { body: "Thanks, I'll review this." } })
```

Pre-checks that a thread is open (via URL hash). Presses `r` keyboard shortcut (Tier 2) to open reply. Fills body via `aria-label="Message Body"` (Tier 3). Leaves as draft. Add `send: true` to send via `Ctrl+Enter`.

### 6. Search for Specific Emails

```
browser_plugin_action({ plugin: "gmail", action: "search_emails", params: { query: "from:boss@company.com has:attachment" } })
```

Navigates to `#search/from:boss@company.com+has:attachment` via URL hash (Tier 1). Extracts results using same data extraction as `list_emails`.

## File Structure

```
MCPBrowser/src/plugins/gmail/
├── index.js              # Plugin entry point (manifest, matchesPage, getActions, getInfo)
├── selectors.js          # Tier 4 CSS selectors ONLY (centralized, versioned per FR-023)
├── helpers.js            # Shared utilities:
│   │                     #   - detectView() — URL hash primary, DOM fallback (FR-024)
│   │                     #   - getAccountIndex() — extract /u/N/ from URL (FR-020)
│   │                     #   - gmailNavigate() — URL hash navigation with account index
│   │                     #   - checkKeyboardShortcuts() — verify shortcuts enabled (FR-019)
│   │                     #   - checkPrecondition() — validate state before shortcuts (FR-025)
│   │                     #   - selectEmailRow() — hybrid DOM+keyboard row targeting
│   │                     #   - waitForGmail() — content wait with timeout (FR-012)
│   │                     #   - extractEmailRows() — T3+T4 data extraction
│   │                     #   - GmailActionResponse — MCPResponse subclass
│   └
└── actions/
    ├── list-emails.js    # T1 navigation + T3/T4 extraction
    ├── read-email.js     # T1 navigation + T3/T4 extraction
    ├── search-emails.js  # T1 navigation + T3/T4 extraction
    ├── compose-email.js  # T2 keyboard (c) + T3 form fill
    ├── reply-email.js    # T2 keyboard (r/a) + T3 form fill
    ├── forward-email.js  # T2 keyboard (f) + T3 form fill
    ├── archive-email.js  # T3 row select + T2 keyboard (e)
    ├── delete-email.js   # T3 row select + T2 keyboard (#)
    ├── label-email.js    # T3 row select + T2 keyboard (l) + T4 picker
    ├── mark-read.js      # T3 row select + T2 keyboard (Shift+i)
    └── mark-unread.js    # T3 row select + T2 keyboard (Shift+u)
```

## Interaction Tier Summary

| Tier | What it covers | Fragility |
|------|---------------|-----------|
| **T1 — URL hash** | Navigation to folders, search, thread open | Very stable (public URL contract) |
| **T2 — Keyboard shortcuts** | Compose, reply, forward, archive, delete, label, mark | Stable (documented by Google) |
| **T3 — ARIA/data-*/name attrs** | Row checkboxes, form fields, compose body, sender data | Moderately stable (accessibility standards) |
| **T4 — CSS class selectors** | Email row internals (subject, snippet, date, unread status) | Fragile (Closure Compiler output) |

**~73% of interactions use T1/T2** — navigation + action triggers are CSS-free.

## Key Implementation Notes

- **Selectors minimized & centralized**: Only Tier 4 CSS selectors live in `selectors.js` — all action buttons and navigation are handled by URL/keyboard (FR-023, SC-008)
- **View detection via URL**: `detectView()` parses URL hash first, falls back to DOM only for compose overlay detection (FR-024)
- **Account-aware navigation**: `gmailNavigate()` extracts `/u/N/` from current URL — never hardcodes account index (FR-020)
- **Keyboard shortcut verification**: On first action, `checkKeyboardShortcuts()` sends `?` and checks for help dialog (FR-019)
- **Pre-check validation**: Before every keyboard shortcut, `checkPrecondition()` verifies required state via URL/DOM (FR-025)
- **Hybrid row targeting**: `selectEmailRow()` locates row via DOM, clicks checkbox, then action uses keyboard shortcut (per clarification Q1)
- **Content wait**: Every data extraction action calls `waitForGmail()` with 10s timeout (FR-012)
- **ID extraction**: `list_emails` and `search_emails` extract Gmail IDs from `data-legacy-message-id` when available (FR-016)
- **Send safety**: `compose_email`, `reply_email`, and `forward_email` default to draft mode (FR-015)

## Testing

```bash
# Unit tests (no browser needed)
node tests/plugins/gmail/gmail-plugin.test.js

# Browser integration tests (requires Gmail session)
node tests/plugins/gmail/gmail-browser.test.js
```
