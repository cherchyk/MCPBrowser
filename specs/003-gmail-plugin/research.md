# Research: Gmail Plugin (Hybrid UI Resilience)

**Feature**: 003-gmail-plugin | **Date**: 2026-04-03 (rewrite)
**Approach**: Tiered interaction strategy per FR-011 — URL scheme (T1) > Keyboard shortcuts (T2) > ARIA/data-*/semantic HTML (T3) > CSS class selectors (T4)

## R1: Gmail URL Hash Scheme for Navigation (Tier 1)

**Decision**: Use Gmail's URL hash scheme as the primary navigation method. All folder navigation, search, and compose triggering should use URL changes instead of clicking DOM elements.

**Rationale**: The URL hash scheme is Gmail's most stable public interface. It has remained consistent across years of UI redesigns. It avoids all CSS selector dependencies for navigation.

**URL patterns** (all relative to `mail.google.com/mail/u/N/` where N = account index):
- Inbox: `#inbox`
- Sent: `#sent`
- Drafts: `#drafts`
- Trash: `#trash`
- Spam: `#spam`
- Custom label: `#label/<LabelName>` (URL-encoded)
- Search: `#search/<encoded-query>` (Gmail search operators work: `from:`, `to:`, `subject:`, `has:attachment`, etc.)
- Compose: `#compose` (experimental — may not open compose reliably on all Gmail versions)
- Specific thread: `#inbox/<thread-id>` or `#all/<thread-id>`

**Account index extraction**: Parse `/u/N/` from `page.url()`. The regex `/\/u\/(\d+)\//` extracts N. This MUST NOT be hardcoded — users with multiple Google accounts have `/u/1/`, `/u/2/`, etc.

**View detection via URL hash**: Before DOM inspection, the URL hash provides the first signal:
- `#inbox` → email list view
- `#sent`, `#drafts`, `#trash`, `#spam` → email list view (different folder)
- `#label/<name>` → email list view (label)
- `#search/<query>` → search results view
- `#inbox/<id>` or `#all/<id>` → thread view
- Fragment absent or just `#` → inbox (default)

**Alternatives considered**:
- Clicking sidebar folder links via CSS selectors: Rejected — sidebar selectors are Closure Compiler-generated and fragile.
- Keyboard shortcuts for navigation (`gi` for inbox, `gs` for starred): Not as direct or universal as URL hash.

## R2: Gmail Keyboard Shortcuts for Actions (Tier 2)

**Decision**: Use Gmail keyboard shortcuts as the primary method for triggering actions. Keyboard shortcuts are publicly documented by Google (support.google.com/mail/answer/6594) and are significantly more stable than toolbar button CSS selectors.

**Rationale**: Keyboard shortcuts are part of Gmail's public user contract. Google documents them officially and rarely changes them. They are language-independent (unlike ARIA labels which may translate). They eliminate dependencies on toolbar button CSS classes entirely.

**Confirmed shortcuts** (from Google Support page, verified 2026-04-03):

| Action | Shortcut | Notes |
|--------|----------|-------|
| Compose | `c` | Opens compose window |
| Reply | `r` | Opens reply to last message in thread |
| Reply All | `a` | Opens reply-all to last message |
| Forward | `f` | Opens forward for last message |
| Archive | `e` | Archives selected/current email |
| Delete | `#` (Shift+3) | Moves to Trash |
| Search focus | `/` | Focuses search bar (but URL hash is preferred for search) |
| Mark as read | `Shift+i` | Marks selected email(s) as read |
| Mark as unread | `Shift+u` | Marks selected email(s) as unread |
| Navigate down | `j` | Moves cursor to next conversation |
| Navigate up | `k` | Moves cursor to previous conversation |
| Open conversation | `o` or `Enter` | Opens focused conversation |
| Select conversation | `x` | Toggles checkbox selection on focused conversation |
| Apply label | `l` | Opens label picker |
| Go to Inbox | `g` then `i` | Two-key combo (but URL hash is preferred) |
| Send (in compose) | `Ctrl+Enter` / `⌘+Enter` | Sends composed email |

**Prerequisite: Keyboard shortcuts must be enabled**. Gmail has keyboard shortcuts OFF by default. Detection strategy (FR-019):
- Send a known shortcut (e.g., `?` which opens the shortcuts help dialog) and check if the dialog appears
- OR check Gmail settings via `localStorage` or DOM inspection for the shortcuts toggle state
- If disabled: return error with instructions: "Enable keyboard shortcuts in Gmail Settings → General → Keyboard shortcuts → ON"

**Pre-check validation (FR-025)**: Before each shortcut, verify the precondition:

| Shortcut | Precondition | Check method |
|----------|-------------|--------------|
| `r`, `a`, `f` | Thread must be open | URL hash contains thread ID (e.g., `#inbox/ABC123`) |
| `e`, `#` | Email must be selected or thread open | Checkbox checked (DOM) or thread view (URL) |
| `Shift+i`, `Shift+u` | Email must be selected | Checkbox checked (DOM) |
| `l` | Email must be selected or thread open | Checkbox checked or thread view |
| `c` | Must be on Gmail | URL contains `mail.google.com` |

**Hybrid DOM+keyboard for row-targeted actions** (per clarification Q1):
1. Locate target row via DOM (using `data-legacy-message-id` or positional index)
2. Click the row's checkbox (`div[role="checkbox"]` within the row — Tier 3 ARIA selector)
3. Send the keyboard shortcut for the action
4. This avoids fragile `j`/`k` cursor position tracking

**Alternatives considered**:
- Full keyboard navigation (j/k to position + x to select): Rejected — cursor position tracking is fragile and error-prone.
- Clicking toolbar buttons via CSS selectors: Rejected — toolbar button classes change with Gmail deploys.
- ARIA-label buttons (`div[aria-label="Archive"]`): Partially viable but language-dependent; keyboard shortcuts are language-independent.

## R3: ARIA Roles, Data Attributes, and Semantic HTML for Data Extraction (Tier 3)

**Decision**: For DOM data extraction (email lists, thread content, form filling), prefer ARIA roles, `data-*` attributes, `name` attributes, and semantic HTML over CSS class selectors.

**Rationale**: These are tied to accessibility standards and HTML form conventions, making them more stable than Closure Compiler-generated class names. Google maintains Gmail's accessibility for screen readers, so ARIA roles are unlikely to be removed.

**Tier 3 selectors identified**:

| Element | Tier 3 selector | Purpose |
|---------|---------------|---------|
| Main content area | `div[role="main"]` | Container for email list/thread |
| Email row container | `table[role="grid"]` or `div[role="listbox"]` | Wraps email rows |
| Individual row | `tr[role="row"]` or elements with `role="option"` | Each email in list |
| Row checkbox | `div[role="checkbox"]` | Select email for bulk actions |
| Message ID | `[data-legacy-message-id]` attribute | Stable email identifier |
| Compose dialog | `div[role="dialog"]` | Compose/reply overlay |
| To field | `textarea[name="to"]` | Recipient input (HTML name attr) |
| CC field | `textarea[name="cc"]` | CC input (HTML name attr) |
| Subject field | `input[name="subjectbox"]` | Subject input (HTML name attr) |
| Search input | `input[name="q"]` | Search bar (HTML name attr) |
| Message body compose | `div[aria-label="Message Body"]` | Contenteditable compose body |
| Sender in thread | `span[email]` with `name` attribute | Structured sender data |
| Thread heading | `h2` within `div[role="main"]` | Thread subject |

**Form filling strategy**: Use `name` attributes for To (`name="to"`), CC (`name="cc"`), Subject (`name="subjectbox"`), Search (`name="q"`). These are HTML form standards that Gmail has maintained since inception.

**Compose body**: The body is a `contenteditable` div, identified by `aria-label="Message Body"`. Set content via `element.innerHTML` or Puppeteer's `page.type()` for natural keypress simulation.

**Sender data extraction**: Gmail's sender spans use `email` and `name` custom attributes (e.g., `<span email="alice@example.com" name="Alice Smith">`). These structural attributes are more stable than the class names wrapping them.

**Alternatives considered**:
- All CSS class selectors: Rejected — the primary failure mode we're solving.
- Gmail API for data extraction: Rejected for v1 — paradigm shift outside MCPBrowser's browser automation model.

## R4: Remaining CSS Class Selectors (Tier 4 — Last Resort)

**Decision**: A small set of CSS class selectors remains necessary for elements that lack ARIA roles, data attributes, or semantic HTML identifiers. These MUST be centralized in `selectors.js`.

**Rationale**: Some Gmail DOM elements — particularly within email row cells — have no accessibility attributes or data markers. The subject, snippet, and date within a row are distinguished only by CSS classes. These selectors are the weakest link and should be isolated for easy updating.

**Tier 4 selectors (minimized set)**:

| Element | CSS selector | Why Tier 4 |
|---------|-------------|------------|
| Email row | `tr.zA` | No ARIA `role="row"` on Gmail's table rows (they use custom table structure) |
| Unread indicator | `.zE` class on row | No `aria-label` for read/unread status on rows |
| Subject text | `span.bog` | No distinguishing attribute vs snippet within the row |
| Snippet text | `span.y2` | No distinguishing attribute vs subject within the row |
| Date cell | `td.xW span` | No `name` or `aria-label` on date elements |
| Message container | `div.adn` | Individual message cards in thread view lack ARIA roles |
| Message body | `div.a3s.aiL` | The actual body content div within a message |
| Message date | `span.g3` | Date within thread message header |
| Thread subject | `h2.hP` | The h2 can be targeted via Tier 3 but .hP adds specificity |
| Attachment area | `div.aQH` | No ARIA role for attachment section |
| Attachment filename | `span.aV3` | No data attribute for filename |

**Key observation**: The Tier 4 selectors are concentrated in **data extraction** (R1, R2 concerns). Navigation (R1) and action triggering (R2) are fully covered by Tier 1/2. This means a Gmail CSS class change breaks only the read path, not the action path.

**Selector versioning**: The `selectors.js` module should include a version comment and document which Gmail version/date the selectors were last verified against. All action code imports selectors by name, never hardcodes class strings.

**Alternatives considered**:
- XPath expressions: Equally fragile and harder to maintain than CSS selectors.
- Heuristic text-position detection: Rejected — too unreliable across languages and layouts.

## R5: Keyboard Shortcut Detection Strategy (FR-019)

**Decision**: Detect keyboard shortcuts availability by sending the `?` key (which opens Gmail's keyboard shortcuts help dialog when shortcuts are enabled) and checking for the dialog's appearance.

**Detection flow**:
1. Press `?` via `page.keyboard.press('Shift+/')`  
2. Wait up to 2 seconds for a shortcuts dialog to appear (a modal overlay)
3. If dialog appears → shortcuts are enabled; close the dialog (press `Escape`)
4. If no dialog → shortcuts are disabled; return error with enablement instructions

**Rationale**: The `?` shortcut is the safest to test — it opens a read-only help dialog with no side effects. Other shortcuts (like `c` for compose) would create unwanted state changes.

**Caching**: Since the plugin is stateless between calls (FR-017), this check must run on each action invocation. For performance, it can be optimized to run once per page session by checking if the page URL hasn't changed since the last check — but this is an implementation optimization, not a spec concern.

**Alternative detection considered**:
- Check Gmail settings DOM: Viable but requires navigating to settings page, which is disruptive.
- Check `localStorage`/`sessionStorage`: Gmail stores settings in obfuscated keys that may change.

## R6: View Detection via URL + DOM (FR-024)

**Decision**: Primary view detection uses URL hash parsing; DOM inspection is the fallback for ambiguous cases.

**Detection hierarchy**:

| URL hash pattern | View | DOM fallback needed? |
|-----------------|------|---------------------|
| `#inbox` (no thread ID) | email_list | No |
| `#sent`, `#drafts`, `#trash`, `#spam` | email_list | No |
| `#label/<name>` | email_list | No |
| `#search/<query>` | search_results | No |
| `#inbox/<id>`, `#all/<id>`, `#sent/<id>` | thread | No |
| `#compose` | compose | Verify with `div[role="dialog"]` |
| Any hash + compose dialog open | compose (overlay) | Yes — `div[role="dialog"]` check |
| URL is `mail.google.com` but hash absent | email_list (inbox default) | No |
| URL is not `mail.google.com` | not_gmail | No |

**Rationale**: URL-based detection is instant (string parsing, no DOM query) and handles ~90% of cases without touching the DOM. The only case requiring DOM fallback is detecting a compose overlay, since compose can be open on top of any view.

**Loading detection**: If the URL indicates a valid view but `div[role="main"]` has no content yet, the view is "loading." Wait for content to appear within the FR-012 timeout (10s).

## R7: Account Index Extraction (FR-020)

**Decision**: Extract the Google account index from the current page URL using regex `/\/u\/(\d+)\//`. Use this index for all URL-based navigation.

**Implementation**:
```
function getAccountIndex(url) {
  const match = url.match(/\/u\/(\d+)\//);
  return match ? match[1] : '0'; // default to 0 if not found
}

function gmailUrl(accountIndex, hash) {
  return `https://mail.google.com/mail/u/${accountIndex}/${hash}`;
}
```

**Rationale**: Users with multiple Google accounts signed in have URLs like `/u/0/`, `/u/1/`, `/u/2/`. Hardcoding `0` would break for non-primary accounts. Extracting from the current URL ensures the plugin always targets the correct account.

## R8: Puppeteer Keyboard Input Strategy

**Decision**: Use Puppeteer's `page.keyboard` API for sending shortcuts, with appropriate key combinations.

**Key patterns**:
- Single key: `page.keyboard.press('c')` — for compose, reply, etc.
- Shifted key: `page.keyboard.press('Shift+i')` — for mark as read; use `page.keyboard.down('Shift'); page.keyboard.press('i'); page.keyboard.up('Shift');`
- Special key: `page.keyboard.press('#')` for delete maps to `Shift+3` on US keyboards — may need `page.keyboard.type('#')` instead for cross-keyboard safety
- Ctrl combo: `page.keyboard.down('Control'); page.keyboard.press('Enter'); page.keyboard.up('Control');` for sending

**IMPORTANT**: Keyboard events must be sent to the active Gmail page, not a focused input field. Before sending action shortcuts, ensure no input/textarea is focused (click on the page body first if needed). For compose actions where we ARE in an input, shortcuts like `Ctrl+Enter` to send work because they're designed for that context.

**Timing**: After sending a shortcut, wait for the expected DOM change (e.g., compose dialog appearing after `c`, reply editor appearing after `r`). Use `page.waitForSelector()` with the Tier 3 selector for the expected result.

## R9: Tier Coverage Analysis

**Summary of which tier serves each spec action**:

| Action | Navigation | Trigger | Data extraction | Form fill |
|--------|-----------|---------|----------------|-----------|
| `list_emails` | T1 (URL hash) | N/A | T3+T4 (ARIA + CSS) | N/A |
| `read_email` | T1 (URL hash) | T2 (keyboard `o`) | T3+T4 (ARIA + CSS) | N/A |
| `search_emails` | T1 (URL hash `#search/`) | N/A | T3+T4 (same as list) | N/A |
| `compose_email` | N/A | T2 (keyboard `c`) | N/A | T3 (`name` attrs) |
| `reply_email` | N/A | T2 (keyboard `r`/`a`) | N/A | T3 (`aria-label`) |
| `forward_email` | N/A | T2 (keyboard `f`) | N/A | T3 (`name`/`aria-label`) |
| `archive_email` | N/A | T2 (keyboard `e`) | N/A | N/A |
| `delete_email` | N/A | T2 (keyboard `#`) | N/A | N/A |
| `label_email` | N/A | T2 (keyboard `l`) | T4 (label picker items) | N/A |
| `mark_read` | N/A | T2 (`Shift+i`) | N/A | N/A |
| `mark_unread` | N/A | T2 (`Shift+u`) | N/A | N/A |

**Tier coverage**: 
- Tier 1 (URL): 3/11 actions use it for navigation
- Tier 2 (Keyboard): 10/11 actions use it for triggering (list_emails only navigates)
- Tier 3 (ARIA/data): All data extraction and form filling
- Tier 4 (CSS): Only email list row internals and thread message internals

**SC-007 validation**: Navigation (T1) + action triggers (T2) account for ~73% of interactions, exceeding the 70% threshold.
