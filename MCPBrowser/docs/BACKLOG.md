# MCPBrowser Backlog

## Future Features

### 1. Immediate Auth Feedback Response
**Priority:** Medium  
**Status:** Planned for v2

**Description:**  
When a page requires authentication, return an immediate response to the agent/user instead of blocking for up to 10-20 minutes waiting for manual auth.

**Current behavior:**
- Auto-auth check (5 seconds)
- If auto-auth fails → blocks and waits for manual auth (up to 10-20 minutes)
- Returns HTML only after auth completes or timeout

**Proposed behavior:**
- Auto-auth check (5 seconds)
- If auto-auth fails → return `AuthPendingResponse` immediately with:
  - `status: 'waiting_for_auth'`
  - `authUrl`: current auth page URL
  - `originalUrl`: originally requested URL
  - `isLoginPage`: whether login form was detected
  - `indicators`: login page indicators found (password field, login button, etc.)
  - `timeoutMinutes`: how long the browser will keep the tab open
  - Suggested next steps for the user
- User completes auth in browser
- User calls `fetch_webpage` again with same URL → gets the content

**Benefits:**
- Agent gets instant feedback that auth is needed
- Agent can inform user immediately (no hanging request)
- User experience is clearer
- Follows request-response pattern better

**Implementation notes:**
- Add `AuthPendingResponse` class in `fetch-page.js`
- Modify auth flow to return immediately after auto-auth fails
- Detect login page with `detectLoginPage()` to provide rich feedback
