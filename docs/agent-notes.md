# MCP Browser notes

## Project Structure

**Key Files:**
- `src/mcp-browser.js` - MCP server implementation (fetch tool)
- `extension/src/extension.js` - VS Code extension for auto-configuration
- `package.json` - npm package metadata and version
- `extension/package.json` - VS Code extension metadata and version
- `server.json` - MCP Registry metadata
- `README.md` - User documentation
- `extension/README.md` - Extension documentation

**Distribution Platforms:**
1. npm registry - `npm publish`
2. VS Code Marketplace - `vsce publish`
3. MCP Registry - via server.json (auto-indexed)

## Test Suite

**Command:** `npm test` (from project root)

**Unit Tests:** `tests/domain-tab-pooling.test.js`
- Fast (~100ms), no browser needed
- 49 tests for domain pooling logic

**Integration Tests:** `tests/integration.test.js`
- Requires Chrome + manual authentication
- Tests real browser workflow with eng.ms
- Browser stays open after completion

---

# ⚠️ CRITICAL: READ THIS FIRST BEFORE ANY DEPLOYMENT ⚠️

## 🛑 DEPLOYMENT RULE #1 - NEVER SKIP THIS STEP
**ALWAYS ASK FIRST**: "Ready to deploy?"
- Ask this question FIRST, before checking branches, running tests, or making ANY changes
- Wait for explicit "yes" or "proceed" confirmation from user
- **EXCEPTION**: Skip asking if user CLEARLY requested deployment in their message (e.g., "deploy version 0.2.29", "publish now", "deploy again as X")
- If user just made changes or deployment intent is unclear, ALWAYS ask

## Deployment Checklist (CRITICAL - DO ALWAYS)
When deploying follow these steps IN ORDER, NO SKIPPING:

**DEPLOYMENT STEPS:**
- [ ] **Step 1: ASK USER** → "Ready to deploy?" → **WAIT FOR YES**
  - **EXCEPTION**: Skip asking if user CLEARLY requested deployment (e.g., "deploy version X", "publish now", "deploy again")
  - If user just made changes or context is unclear, ALWAYS ask for confirmation

- [ ] **Step 2: Verify Branch**:
   - **CRITICAL**: Deployment MUST be done from the `main` branch ONLY
   - Check current branch: `git branch --show-current`
   - **STOP DEPLOYMENT** if branch is not `main` - inform user and halt
   - **Changelog Rule**: In the change notes only include changes that are present in the `main` branch
   - If work is on feature branches, it must be merged to `main` first before deployment

- [ ] **Step 3: Run Tests**: 
   - **IMPORTANT**: Always run from project root directory (where the main package.json is located)
   - **Command**: `npm test` (runs all *.test.js files in tests/ folder)
   - **STOP DEPLOYMENT if ANY test fails**
   - Note: Integration tests require Chrome and manual authentication
   - All tests must pass before proceeding

- [ ] **Step 4: Version Bump**: Update version number in `package.json`, `server.json`, and `extension/package.json`

- [ ] **Step 5: Update ALL Descriptions - Two Sources of Truth**:
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

- [ ] **Step 6: Update Docs**: Update version numbers in ALL documentation files (`README.md`, `agent-notes.md`, etc.) - search for old version numbers in examples and update to current version

- [ ] **Step 7: Update Changelog**: Update `extension/CHANGELOG.md` with changes

- [ ] **Step 8: Git**: Commit all changes → `git push origin main`

- [ ] **Step 9: VERIFY SYNCHRONIZATION**:
   - **CRITICAL**: ALL files must be updated and committed BEFORE publishing
   - Verify all version numbers match: `package.json`, `server.json`, `extension/package.json`
   - Verify all descriptions are synchronized from their sources of truth
   - **STOP** if any file is out of sync - never deploy to just one platform
   - All three platforms (npm, VS Code Marketplace, server.json) must be updated together

- [ ] **Step 10: npm**: `npm publish`

- [ ] **Step 11: VS Code Marketplace**: `cd extension` → `vsce package` → `vsce publish`

