# Contract: Gmail Plugin Actions

**Feature**: 003-gmail-plugin | **Date**: 2026-04-03 (updated for hybrid UI resilience)

## Action Catalog

All actions are dispatched via `browser_plugin_action({ plugin: "gmail", action: "<name>", params: {...} })`.  
All actions return an MCPResponse subclass with `nextSteps` array.  
All actions detect the current Gmail view via URL hash (T1) with DOM fallback (T3) per FR-024.  
All actions wait up to 10 seconds for dynamic content to load (FR-012).  
All actions verify keyboard shortcut availability before using Tier 2 shortcuts (FR-019).  
All actions validate preconditions before sending keyboard shortcuts (FR-025).

## Interaction Tier Map

| Action | Navigation | Trigger | Data Extraction | Form Fill |
|--------|-----------|---------|----------------|----------|
| `list_emails` | T1 (URL hash `#inbox`, `#sent`, etc.) | N/A | T3+T4 (ARIA/data + CSS) | N/A |
| `read_email` | T1 (URL hash `#inbox/<id>`) | T2 (keyboard `o`) or T1 (URL) | T3+T4 (ARIA/data + CSS) | N/A |
| `search_emails` | T1 (URL hash `#search/<query>`) | N/A | T3+T4 (same as list) | N/A |
| `compose_email` | N/A | T2 (keyboard `c`) | N/A | T3 (`name` attrs) |
| `reply_email` | N/A | T2 (keyboard `r`/`a`) | N/A | T3 (`aria-label`) |
| `forward_email` | N/A | T2 (keyboard `f`) | N/A | T3 (`name`/`aria-label`) |
| `archive_email` | N/A | T2 (keyboard `e`) | N/A | N/A |
| `delete_email` | N/A | T2 (keyboard `#`) | N/A | N/A |
| `label_email` | N/A | T2 (keyboard `l`) | T4 (label picker items) | N/A |
| `mark_read` | N/A | T2 (`Shift+i`) | N/A | N/A |
| `mark_unread` | N/A | T2 (`Shift+u`) | N/A | N/A |

**Row targeting** (for `archive_email`, `delete_email`, `label_email`, `mark_read`, `mark_unread` when in list view): Hybrid DOM+keyboard — locate row via T3/T4, click checkbox (`div[role="checkbox"]`), then send T2 shortcut.

## Common Errors (all actions)

- **Keyboard shortcuts disabled**: Error with instructions to enable in Gmail Settings → General → Keyboard shortcuts → ON (FR-019)
- **Precondition not met**: Error describing required state and suggesting corrective action (FR-025)

---

### list_emails

**Description**: List visible emails from the current Gmail folder/view.  
**Tier strategy**: Navigate to folder via URL hash (T1: `#inbox`, `#sent`, `#drafts`, `#trash`, `#spam`, `#label/<name>`). Account index extracted from current URL. Data extraction via T3+T4 selectors.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `folder` | string | no | (current view) | Gmail folder to navigate to: `"inbox"`, `"sent"`, `"drafts"`, `"trash"`, `"spam"`, or a label name |
| `limit` | number | no | `25` | Maximum number of emails to return |

**Returns**: `{ emails: EmailSummary[], folder: string, totalVisible: number, nextSteps: string[] }`

**Errors**:
- Not on Gmail → error with `browser_fetch_webpage` guidance
- Timeout waiting for email list → error suggesting page reload

**nextSteps**: `["read_email to open a specific email", "search_emails to find specific messages", "compose_email to write a new email"]`

---

### read_email

**Description**: Open and read a specific email by index or ID.  
**Tier strategy**: Navigate to thread via URL hash (T1: `#inbox/<thread-id>`) when ID available, or locate row via DOM + keyboard `o` (T2). Extract thread data via T3+T4.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `index` | number | no* | — | 0-based position in current email list |
| `id` | string | no* | — | Gmail internal message/thread ID |

*At least one of `index` or `id` must be provided. `id` is preferred when available.

**Returns**: `{ thread: EmailThread, nextSteps: string[] }`

**Errors**:
- Index out of range → error with valid range and `list_emails` suggestion
- Not in email list view → error suggesting `list_emails` first
- Not on Gmail → error with `browser_fetch_webpage` guidance

**nextSteps**: `["reply_email to respond", "forward_email to forward", "archive_email to archive", "delete_email to remove", "list_emails to return to inbox"]`

---

### search_emails

**Description**: Search Gmail and return matching emails.  
**Tier strategy**: Navigate via URL hash (T1: `#search/<encoded-query>`). Account index preserved from current URL (FR-020). Data extraction identical to `list_emails`.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | yes | — | Gmail search query (supports Gmail search operators like `from:`, `to:`, `subject:`, `has:attachment`, etc.) |
| `limit` | number | no | `25` | Maximum results to return |

**Returns**: `{ emails: EmailSummary[], query: string, resultCount: number, nextSteps: string[] }`

**Errors**:
- Not on Gmail → error with `browser_fetch_webpage` guidance
- Empty query → error indicating query is required

**nextSteps**: `["read_email to open a specific result", "search_emails with a different query", "list_emails to return to inbox"]`

---

### compose_email

**Description**: Open Gmail's compose window and fill in email fields.  
**Tier strategy**: Trigger compose via keyboard `c` (T2). Fill fields via `name` attributes (T3: `name="to"`, `name="cc"`, `name="subjectbox"`). Body via `aria-label="Message Body"` (T3). Send via `Ctrl+Enter` (T2).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `to` | string | yes | — | Recipient email address |
| `subject` | string | no | `""` | Email subject |
| `body` | string | no | `""` | Email body text |
| `cc` | string | no | — | CC recipient email address |
| `send` | boolean | no | `false` | If `true`, click Send after filling fields. **Default is draft mode.** |

**Returns**: `{ status: "sent" | "draft", to: string, subject: string, nextSteps: string[] }`

**Errors**:
- Not on Gmail → error with `browser_fetch_webpage` guidance
- Empty `to` → error indicating recipient is required
- Existing compose window detected → warning, close and reopen

**nextSteps** (draft): `["Review and send the draft manually in Gmail", "compose_email with send:true to send immediately"]`  
**nextSteps** (sent): `["list_emails to return to inbox", "compose_email to write another email"]`

---

### reply_email

**Description**: Reply to the currently open email thread.  
**Tier strategy**: Pre-check thread is open via URL hash (T1). Trigger reply via keyboard `r` or reply-all via `a` (T2). Fill body via `aria-label="Message Body"` (T3). Send via `Ctrl+Enter` (T2).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `body` | string | yes | — | Reply body text |
| `replyAll` | boolean | no | `false` | If `true`, reply to all participants instead of sender only |
| `send` | boolean | no | `false` | If `true`, send the reply immediately. **Default is draft mode.** |

**Returns**: `{ status: "sent" | "draft", replyAll: boolean, nextSteps: string[] }`

**Errors**:
- No thread open → error suggesting `read_email` first
- Not on Gmail → error with `browser_fetch_webpage` guidance

**nextSteps** (draft): `["Review and send the reply manually in Gmail"]`  
**nextSteps** (sent): `["list_emails to return to inbox", "read_email to open another email"]`

---

### forward_email

**Description**: Forward the currently open email thread to a new recipient.  
**Tier strategy**: Pre-check thread is open via URL hash (T1). Trigger forward via keyboard `f` (T2). Fill To via `name="to"` (T3). Body via `aria-label="Message Body"` (T3). Send via `Ctrl+Enter` (T2).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `to` | string | yes | — | Recipient email address to forward to |
| `body` | string | no | `""` | Additional body text to prepend above the forwarded content |
| `send` | boolean | no | `false` | If `true`, send immediately. **Default is draft mode.** |

**Returns**: `{ status: "sent" | "draft", to: string, nextSteps: string[] }`

**Errors**:
- No thread open → error suggesting `read_email` first
- Not on Gmail → error with `browser_fetch_webpage` guidance
- Empty `to` → error indicating recipient is required

**nextSteps**: Same as `reply_email`

---

### archive_email

**Description**: Archive an email (remove from inbox, keep in All Mail).  
**Tier strategy**: In list view — select row via DOM checkbox (`div[role="checkbox"]`, T3) then keyboard `e` (T2). In thread view — keyboard `e` directly (T2). Pre-check: row selected or thread open (FR-025).

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `index` | number | no | — | 0-based index in email list (from list view) |
| `id` | string | no | — | Gmail message/thread ID |

*If in thread view, archives the current thread (no index/id needed). If in list view, `index` or `id` required.*

**Returns**: `{ archived: true, nextSteps: string[] }`

**Errors**:
- Not on Gmail → error with `browser_fetch_webpage` guidance
- In list view but no index/id provided → error

**nextSteps**: `["list_emails to see remaining emails", "search_emails to find other emails"]`

---

### delete_email

**Description**: Move an email to Trash.  
**Tier strategy**: Same as `archive_email` but keyboard `#` (Shift+3) instead of `e`.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `index` | number | no | — | 0-based index in email list (from list view) |
| `id` | string | no | — | Gmail message/thread ID |

*Same selection logic as `archive_email`.*

**Returns**: `{ deleted: true, nextSteps: string[] }`

**Errors**: Same as `archive_email`

**nextSteps**: `["list_emails to see remaining emails"]`

---

### label_email

**Description**: Apply a Gmail label to an email.  
**Tier strategy**: Select row via DOM checkbox (T3), then keyboard `l` (T2) to open label picker. Label picker items use T4 CSS selectors.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `index` | number | no | — | 0-based index in email list |
| `id` | string | no | — | Gmail message/thread ID |
| `label` | string | yes | — | Label name to apply |

*Same selection logic as `archive_email`.*

**Returns**: `{ labeled: true, label: string, nextSteps: string[] }`

**Errors**:
- Label not found → error listing available labels
- Same selection errors as `archive_email`

**nextSteps**: `["list_emails to see updated inbox", "label_email to apply another label"]`

---

### mark_read

**Description**: Mark an email as read from the email list view.  
**Tier strategy**: Select row via DOM checkbox (T3), then keyboard `Shift+i` (T2). Pre-check: email must be selected.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `index` | number | no | — | 0-based index in email list |
| `id` | string | no | — | Gmail message/thread ID |

**Returns**: `{ markedRead: true, nextSteps: string[] }`

**Errors**: Same selection errors as `archive_email`

**nextSteps**: `["list_emails to see updated status", "read_email to open the email"]`

---

### mark_unread

**Description**: Mark an email as unread from the email list view.  
**Tier strategy**: Select row via DOM checkbox (T3), then keyboard `Shift+u` (T2). Pre-check: email must be selected.

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `index` | number | no | — | 0-based index in email list |
| `id` | string | no | — | Gmail message/thread ID |

**Returns**: `{ markedUnread: true, nextSteps: string[] }`

**Errors**: Same selection errors as `archive_email`

**nextSteps**: `["list_emails to see updated status"]`
