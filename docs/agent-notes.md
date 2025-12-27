# MCP Browser notes

## Project Structure

This workspace contains two projects:
- **MCPBrowser/** - MCP server (npm package)
- **VSCodeExtension/** - VS Code extension

**Key Files:**

**MCP Server (MCPBrowser/):**
- `MCPBrowser/src/mcp-browser.js` - MCP server implementation (fetch tool)
- `MCPBrowser/package.json` - npm package metadata and version
- `MCPBrowser/server.json` - MCP Registry metadata
- `MCPBrowser/README.md` - MCP server documentation
- `MCPBrowser/tests/` - MCP server test suite

**VS Code Extension (VSCodeExtension/):**
- `VSCodeExtension/src/extension.js` - Extension for auto-configuration
- `VSCodeExtension/package.json` - Extension metadata and version
- `VSCodeExtension/README.md` - Extension documentation
- `VSCodeExtension/test/` - Extension test suite

**Root:**
- `package.json` - Workspace configuration (npm workspaces)
- `README.md` - Root overview documentation

**Distribution Platforms:**
1. npm registry - `npm publish` (from MCPBrowser/)
2. VS Code Marketplace - `vsce publish` (from VSCodeExtension/)
3. MCP Registry - via MCPBrowser/server.json (auto-indexed)

## Test Suite

**Command:** `npm test` (from root directory - runs both projects)

**MCP Server Tests (MCPBrowser/tests/):**
- **Unit Tests:** `MCPBrowser/tests/domain-tab-pooling.test.js`
  - Fast (~100ms), no browser needed
  - 49 tests for domain pooling logic
- **Integration Tests:** `MCPBrowser/tests/integration.test.js`
  - Requires Chrome + manual authentication
  - Tests real browser workflow with eng.ms
  - Browser stays open after completion

**Extension Tests (VSCodeExtension/test/):**
- **Unit Tests:** `VSCodeExtension/test/extension.test.js`
  - Uses Mocha/Sinon for mocking
  - Tests extension functions (getMcpConfigPath, checkNodeInstalled, etc.)

---

# ⚠️ CRITICAL: READ THIS FIRST BEFORE ANY DEPLOYMENT ⚠️

## 🛑 DEPLOYMENT RULE #1 - USE THE TODO LIST TOOL
**MANDATORY**: When user requests deployment, IMMEDIATELY use `manage_todo_list` tool to create a checklist with ALL deployment steps listed below.
- Create todo list FIRST, before doing ANYTHING else
- Mark each step in-progress as you work on it
- Mark each step completed immediately after finishing
- This ensures no steps are skipped

## 🛑 DEPLOYMENT RULE #2 - NEVER SKIP THE ASK STEP
**ALWAYS ASK FIRST**: "Ready to deploy?"
- Ask this question FIRST (after creating todo list), before checking branches, running tests, or making ANY changes
- Wait for explicit "yes" or "proceed" confirmation from user
- **EXCEPTION**: Skip asking if user CLEARLY requested deployment in their message (e.g., "deploy version 0.2.29", "publish now", "deploy again as X")
- If user just made changes or deployment intent is unclear, ALWAYS ask

## Deployment Checklist (CRITICAL - DO ALWAYS)
When deploying follow these steps IN ORDER, NO SKIPPING:

**DEPLOYMENT STEPS:**
- [ ] **Step 0: CREATE TODO LIST** → Use `manage_todo_list` tool to create checklist with ALL steps below
  - This is MANDATORY to prevent skipping steps
  - Create list FIRST before doing anything else

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
   - **MANDATORY**: ALWAYS run tests before deployment - NO EXCEPTIONS
   - **IMPORTANT**: Run from root directory
   - **Command**: `npm test` (runs tests for all workspaces - both MCP server and Extension)
   - **MCP Server Tests**: Located in `MCPBrowser/tests/` (Node.js test runner)
     - Unit tests: domain-tab-pooling, redirect-detection, auth-flow, prepare-html, mcp-server
     - Integration test: Requires Chrome + manual authentication
   - **Extension Tests**: Located in `VSCodeExtension/test/` (Mocha)
     - Unit tests: extension.test.js (comprehensive suite for all functions)
   - **STOP DEPLOYMENT if ANY test fails**
   - Note: MCP integration tests require Chrome and manual authentication
   - All tests must pass before proceeding to next step

- [ ] **Step 4: Version Bump**: Update version number in THREE package.json files:
   - `MCPBrowser/package.json` - MCP server version
   - `MCPBrowser/server.json` - MCP Registry version
   - `VSCodeExtension/package.json` - Extension version
   - **CRITICAL**: All three must have the SAME version number

- [ ] **Step 5: Update ALL Descriptions - Two Sources of Truth**:
   - **SOURCE OF TRUTH #1 - MCP Server Purpose**: `VSCodeExtension/src/extension.js` 
     - Search for `config.servers.MCPBrowser` to find the `description` field
     - This describes WHEN and WHY to use the MCP server (for mcp.json configuration)
     - **Must propagate to**: ALL mcp.json samples in READMEs - search for `"description"` in code blocks and ensure they match exactly
   
   - **SOURCE OF TRUTH #2 - Fetch Tool API**: `MCPBrowser/src/mcp-browser.js`
     - Search for `name: "fetch_webpage_protected"` to find the tool's `description` field
     - This describes HOW the fetch tool works (technical API documentation for MCP protocol)
     - This is different from #1 - it's for the tool API, not the server configuration
   
   - **Derived Descriptions** (should align with sources of truth but may be adapted for context):
     - `MCPBrowser/package.json` - main package description (search for `"description"` field)
     - `VSCodeExtension/package.json` - extension package description (search for `"description"` field)
     - `MCPBrowser/server.json` - registry description (search for `"description"` field)
     - `VSCodeExtension/README.md` - extension documentation opening paragraph
     - `MCPBrowser/README.md` - MCP server documentation
   
   - **Tip**: Use grep/search to find all `"description"` or `description:` fields, verify each matches appropriate source of truth

- [ ] **Step 6: Update Docs**: Update version numbers in ALL documentation files:
   - `README.md` (root overview)
   - `MCPBrowser/README.md` (MCP server docs)
   - `VSCodeExtension/README.md` (extension docs)
   - `docs/agent-notes.md` (this file)
   - Search for old version numbers in examples and update to current version

- [ ] **Step 7: Update Changelog**: Update `CHANGELOG.md` (root changelog) with changes
   - **Location**: Single root changelog file at `CHANGELOG.md`
   - **Format**: Entries organized by version with clear "MCP Server" and "VS Code Extension" section headers
   - **Important**: Add changes under the appropriate package section (MCP Server vs VS Code Extension)

- [ ] **Step 8: Git**: Commit all changes → `git push origin main`

- [ ] **Step 9: VERIFY SYNCHRONIZATION**:
   - **CRITICAL**: ALL files must be updated and committed BEFORE publishing
   - Verify all version numbers match in THREE files:
     - `MCPBrowser/package.json`
     - `MCPBrowser/server.json`
     - `VSCodeExtension/package.json`
   - Verify all descriptions are synchronized from their sources of truth
   - **STOP** if any file is out of sync - never deploy to just one platform
   - All three platforms (npm, VS Code Marketplace, server.json) must be updated together

- [ ] **Step 10: npm**: Publish MCP server to npm
   - `cd MCPBrowser`
   - `npm publish`
   - `cd ..` (return to root)

- [ ] **Step 11: VS Code Marketplace**: Publish extension
   - `cd VSCodeExtension`
   - `vsce package`
   - `vsce publish`
   - `cd ..` (return to root)

