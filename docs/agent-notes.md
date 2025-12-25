# MCP Browser notes

## 🚨 DEPLOYMENT CHECKLIST (CRITICAL - DO ALWAYS)
When deploying ANY update to MCP Browser, follow these steps IN ORDER:

**⚠️ BEFORE STARTING DEPLOYMENT:**
- **ASK USER**: "Ready to deploy?" - Get explicit confirmation before proceeding with deployment steps
- **EXCEPTION**: Skip asking only if user explicitly requested deployment in their message (e.g., "deploy now", "publish this", "release version X")
- **DO NOT** automatically deploy just because changes were made - user may have additional changes planned

**DEPLOYMENT STEPS:**
0. **Verify Branch**:
   - **CRITICAL**: Deployment MUST be done from the `main` branch ONLY
   - Check current branch: `git branch --show-current`
   - **STOP DEPLOYMENT** if branch is not `main` - inform user and halt
   - **Changelog Rule**: In the change notes only include changes that are present in the `main` branch
   - If work is on feature branches, it must be merged to `main` first before deployment

1. **Run Tests**: 
   - **IMPORTANT**: Always run from project root directory (where the main package.json is located)
   - **Command**: `npm test` (runs all *.test.js files in tests/ folder)
   - **STOP DEPLOYMENT if ANY test fails**
   - Note: Integration tests require Chrome and manual authentication
   - All tests must pass before proceeding
2. **Version Bump**: Update version number in `package.json`, `server.json`, and `extension/package.json`
3. **Update ALL Descriptions - Two Sources of Truth**:
   - **SOURCE OF TRUTH #1 - MCP Server Purpose**: `extension/src/extension.js` 
     - Search for `config.servers.MCPBrowser` to find the `description` field
     - This describes WHEN and WHY to use the MCP server (for mcp.json configuration)
     - **Must propagate to**: ALL mcp.json samples in `README.md` - search for `"description"` in code blocks and ensure they match exactly
   
   - **SOURCE OF TRUTH #2 - Fetch Tool API**: `src/mcp-browser.js`
     - Search for `name: "fetch_webpage_protected"` to find the tool's `description` field
     - This describes HOW the fetch tool works (technical API documentation for MCP protocol)
     - This is different from #1 - it's for the tool API, not the server configuration
   
   - **Derived Descriptions** (should align with sources of truth but may be adapted for context):
     - `package.json` - main package description (search for `"description"` field)
     - `extension/package.json` - extension package description (search for `"description"` field)
     - `server.json` - registry description (search for `"description"` field)
     - `extension/README.md` - extension documentation opening paragraph
   
   - **Tip**: Use grep/search to find all `"description"` or `description:` fields, verify each matches appropriate source of truth
4. **Update Docs**: Update version numbers in ALL documentation files (`README.md`, `agent-notes.md`, etc.) - search for old version numbers in examples and update to current version
5. **Update Changelog**: Update `extension/CHANGELOG.md` with changes
5. **Git**: Commit all changes → `git push origin main`
6. **npm**: `npm publish`
7. **VS Code Marketplace**: `cd extension` → `vsce package` → `vsce publish`

**Critical**: ALL files must be updated and committed BEFORE publishing to npm/marketplace. Never deploy to just one platform - all three must be updated together to keep versions synchronized.

## What this project does
- Alternative web fetcher for GitHub Copilot when normal URL fetch fails due to authentication or anti-crawler restrictions
- **Use when**: Copilot's default fetch returns 401/403, requires login, triggers bot detection, or is blocked by crawler restrictions
- Uses Chrome DevTools Protocol (CDP) to reuse your logged-in Chrome session (no credentials stored)
- **Universal auth handling**: Works with Microsoft, GitHub, AWS, Google, corporate SSO, OAuth, SAML, etc.
- Auto-detects auth redirects by monitoring domain changes and common login URL patterns
- Copilot supplies the LLM; this tool only provides alternative fetch capability

## Distribution
MCP Browser is available through three channels:
1. **VS Code Extension**: [cherchyk.mcpbrowser](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser) v0.2.23 - One-click automated configuration
2. **npm**: [mcpbrowser](https://www.npmjs.com/package/mcpbrowser) v0.2.23 - Use with `npx mcpbrowser@latest`
3. **MCP Registry**: [io.github.cherchyk/browser](https://registry.modelcontextprotocol.io/) v0.2.23 - Discoverable in the official registry

All three methods configure the same underlying MCP server.

## Smart Confirmation
- **First fetch**: Copilot asks user confirmation when fetching a new domain for the first time - explains browser will open for authentication
- **Subsequent requests**: Automatic usage without prompting (browser session preserved for same domain)
- This provides better UX - one login per site, then seamless fetch

## Components
- `src/mcp-browser.js`: MCP server exposing `fetch_webpage_protected`; connects to Chrome via CDP and fetches web pages. Single implementation file.
- `extension/`: VS Code extension for automated mcp.json configuration
- `README.md`: Complete installation and usage guide.
- `server.json`: MCP Registry metadata file.

## Copilot integration concept
- GitHub Copilot in VS Code can attach MCP servers. This repo provides `npm run mcp` to start the server exposing the fetch tool.
- Configure VS Code (Copilot Chat) to attach the MCP server command `node src/mcp-browser.js`.
- **Configured to auto-trigger**: mcp.json description instructs Copilot to use this tool automatically on ANY auth barrier (401/403, login redirects, SSO, fetch denied)
- Copilot handles the LLM; this server only supplies the authenticated fetch tool.

## Auth flow usage
- **Default behavior**: Tabs stay open indefinitely and are reused for same-domain requests to preserve auth sessions.
- Use `keepPageOpen: true` (default) on the first call to leave the tab open and complete login.
- Set `keepPageOpen: false` to close the tab immediately after successful fetch.
- **Domain-aware tab reuse**: Same-domain requests reuse the existing tab; different domains automatically close the old tab and open a new one.
- Optional: `authWaitSelector` to wait for a post-login element (10 min timeout); on timeout the tab stays open so you can finish auth and retry.
- Optional: `waitForUrlPattern` to specify exact URL pattern for auth redirect completion.

## Chrome/auth assumptions
- MCP server will auto-launch Chrome/Edge with remote debugging if none is running (defaults: port 9222, `%LOCALAPPDATA%/ChromeAuthProfile`).
- If you start Chrome manually, use `--remote-debugging-port=9222 --user-data-dir=%LOCALAPPDATA%/ChromeAuthProfile` and ensure you are logged in to target sites.
- MCP fetch connects to that Chrome instance, so cookies/sessions are reused.

## Next improvements

### Persistent Retry Strategy for Authenticated Web Pages
**Priority**: High  
**Version**: Future (post-0.2.22)

**Current Behavior**:
- Tool description suggests "retry 2-3 times with delays"
- Copilot may give up after a few attempts and suggest alternatives

**Problem**:
If user explicitly requests an authenticated web page (e.g., "fetch https://eng.ms/docs/products/geneva"), giving up after 2-3 retries defeats the purpose. The requested web page is critical - skipping it or suggesting workarounds is not acceptable.

**Proposed Solution**:
- Change retry guidance from "2-3 times" to **persistent retry until success**
- Tool should keep retrying every 10-30 seconds until:
  - ✅ Authentication succeeds and content is retrieved, OR
  - ❌ Technical error occurs (timeout, network failure, etc.)

**Updated Guidance for Copilot**:
```
AUTHENTICATION FLOW:
1. First call with keepPageOpen=true may return login web page (EXPECTED)
2. Keep retrying the same URL every 10-30 seconds
3. DO NOT conclude "manual authentication required" - user IS authenticating
4. DO NOT suggest alternatives or give up - keep retrying the original request
5. Web page will eventually return content once authentication completes in background
```

**Benefits**:
- Honors user's explicit request for specific web page
- Leverages keepPageOpen=true to maintain authenticated session
- Prevents Copilot from prematurely falling back to local files or other workarounds
- Better user experience - tool actually delivers the requested content

**Implementation**:
- Update tool description in `src/mcp-browser.js`
- Update examples in README.md
- Add to CHANGELOG as next version

### Other Ideas
- Add Playwright fallback for non-Chrome or headless mode.
- Add selector-based chunking or readability extraction to reduce token usage.
- Add tests for the fetcher tool schema.

## Test Suite

### Unit Tests (Automated)
**File**: `tests/domain-tab-pooling.test.js`  
**Purpose**: Validate domain pooling logic without opening browser  
**Run**: `node tests/domain-tab-pooling.test.js`  
**Speed**: Fast (~100ms)  
**Requirements**: None - uses mock objects  
**Coverage**: 49 tests covering:
- Domain extraction from URLs
- Map-based domain management (add, reuse, clear)
- Tab reuse for same domain
- Creating new tabs for different domains
- Handling closed tabs
- URL pattern matching and extraction
- Multi-domain navigation scenarios

### Integration Tests (Manual)
**File**: `tests/integration.test.js`  
**Purpose**: Test real Chrome browser with actual authentication  
**Run**: `node tests/integration.test.js`  
**Speed**: Slow (requires network, auth, page loads)  
**Requirements**: 
- Chrome installed
- User interaction for authentication
- Network connectivity to eng.ms  
**Coverage**: 1 comprehensive test (12 assertions) covering full Copilot workflow:
- Step 1: Fetch eng.ms page with authentication waiting (detects redirect, waits for user login, returns actual content)
- Step 2: Extract links from HTML (no re-fetch - uses HTML from Step 1)
- Step 3: Load all extracted links using same tab (validates tab reuse for same domain)

**Workflow mirrors real Copilot usage**: Fetch once → Extract links from HTML → Load links with tab reuse

**Browser behavior**: Browser stays open after test completes for manual inspection. Test does not close browser automatically.

**Note**: Both unit tests AND integration tests are run during deployment. Integration tests require user interaction for authentication.
