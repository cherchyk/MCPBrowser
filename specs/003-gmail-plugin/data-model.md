# Data Model: Gmail Plugin (Hybrid UI Resilience)

**Feature**: 003-gmail-plugin | **Date**: 2026-04-03 (rewrite)
**Approach**: Tiered interaction — entities document which tier provides each field

## Entities

### Gmail Plugin Manifest

Exported from `plugins/gmail/index.js` as `manifest`.

| Field | Type | Value | Description |
|-------|------|-------|-------------|
| `name` | string | `"gmail"` | Plugin identifier (matches folder name) |
| `version` | string | `"1.0.0"` | Plugin version |
| `description` | string | `"Gmail plugin..."` | Human-readable description |
| `interfaceVersion` | integer | `1` | Plugin interface version |
| `urlPatterns` | string[] | `["mail.google.com"]` | URL patterns for detection |
| `domPatterns` | string[] | `["div[data-ogsr-up]", ".aH2"]` | Gmail-specific DOM markers for confidence |

### EmailSummary

Returned by `list_emails` and `search_emails` for each email in the list.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `index` | number | yes | 0-based position in current visible list |
| `id` | string | no | Gmail internal message/thread ID (T3: `[data-legacy-message-id]` attribute). Preferred for stable referencing. |
| `sender` | string | yes | Sender display name (T3: `span[name]` attribute → T4: CSS fallback) |
| `senderEmail` | string | yes | Sender email address (T3: `span[email]` attribute) |
| `subject` | string | yes | Email subject line (T4: CSS class `span.bog` — no ARIA/data alternative) |
| `snippet` | string | yes | Preview/snippet text (T4: CSS class `span.y2` — no ARIA/data alternative) |
| `date` | string | yes | Date string as displayed by Gmail (T4: CSS class `td.xW span`) |
| `isUnread` | boolean | yes | Whether the email is marked as unread (T4: CSS class `.zE` on row) |

### EmailThread

Returned by `read_email`. Represents a full email conversation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | no | Thread ID (T1: extracted from URL hash, e.g., `#inbox/<thread-id>`) |
| `subject` | string | yes | Thread subject (T3: `h2` within `div[role="main"]`, refined by T4: `.hP`) |
| `messageCount` | number | yes | Number of messages in thread |
| `messages` | EmailMessage[] | yes | Individual messages in chronological order |

### EmailMessage

A single message within an EmailThread.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sender` | string | yes | Sender display name (T3: `span[name]` attribute) |
| `senderEmail` | string | yes | Sender email address (T3: `span[email]` attribute) |
| `to` | string[] | yes | To-recipient email addresses (T3/T4) |
| `cc` | string[] | no | CC-recipient email addresses (empty array if none) |
| `date` | string | yes | Message date/time (T4: `span.g3[title]`) |
| `body` | string | yes | HTML body content (T4: `div.a3s.aiL`) |
| `attachments` | AttachmentMeta[] | yes | Attachment metadata (empty array if none) |

### AttachmentMeta

Metadata about an email attachment within a message.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | File name (T4: `span.aV3`) |
| `size` | string | no | File size as displayed (e.g., "2.3 MB") |
| `type` | string | no | MIME type or file extension if detectable |

### GmailLabel

Represents a Gmail label for `label_email` actions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Label display name |

### GmailViewContext (internal)

Detected at action invocation time per FR-017/FR-024. Not returned to the agent directly. URL hash is the primary detection signal (T1), with DOM fallback (T3) for ambiguous cases.

| Field | Type | Description |
|-------|------|-------------|
| `view` | enum | `"email_list"`, `"thread"`, `"compose"`, `"search_results"`, `"loading"`, `"not_gmail"` |
| `url` | string | Current page URL |
| `urlHash` | string | URL hash fragment (primary detection signal) |
| `accountIndex` | string | Account index extracted from `/u/N/` in URL |
| `hasComposeDialog` | boolean | Whether `div[role="dialog"]` compose overlay is present (T3 DOM fallback) |

## Relationships

```
Gmail Plugin (plugins/gmail/)
├── manifest → detection via matchesPage(url, html)
├── getInfo() → PluginInfo (action catalog for agent)
└── getActions() → ActionDescriptor[]
      ├── list_emails → EmailSummary[]
      ├── read_email → EmailThread { messages: EmailMessage[] { attachments: AttachmentMeta[] } }
      ├── search_emails → EmailSummary[]
      ├── compose_email → confirmation
      ├── reply_email → confirmation
      ├── forward_email → confirmation
      ├── archive_email → confirmation
      ├── delete_email → confirmation
      ├── label_email → confirmation (uses GmailLabel)
      ├── mark_read → confirmation
      └── mark_unread → confirmation
```

## State Transitions

```
Gmail View States (detected per action call via URL hash + DOM):
  
  [not_gmail] --browser_fetch_webpage(mail.google.com)--> [loading]
  [loading] --content renders--> [email_list] (inbox)
  [email_list] --read_email(index)--> [thread]  (URL: #inbox → #inbox/<id>)
  [email_list] --search_emails(query)--> [search_results]  (URL: #inbox → #search/<query>)
  [email_list/search_results] --list_emails(folder)--> [email_list]  (URL: → #sent, #drafts, etc.)
  [thread] --reply(r)/forward(f) keyboard--> [thread] (inline compose)
  [any gmail view] --compose(c) keyboard--> [compose] (overlay; URL unchanged)
  [thread] --archive(e)/delete(#) keyboard--> [email_list]
  [compose] --send(Ctrl+Enter)--> [email_list]
```
