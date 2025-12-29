# Deployment Instructions for AI Assistants

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

### Step 0: CREATE TODO LIST
→ Use `manage_todo_list` tool to create checklist with ALL steps below
- This is MANDATORY to prevent skipping steps
- Create list FIRST before doing anything else

### Step 1: ASK USER
→ "Ready to deploy?" → **WAIT FOR YES**
- **EXCEPTION**: Skip asking if user CLEARLY requested deployment (e.g., "deploy version X", "publish now", "deploy again")
- If user just made changes or context is unclear, ALWAYS ask for confirmation

### Step 2: Verify Branch
**CRITICAL**: Deployment MUST be done from the `main` branch ONLY
- Check current branch: `git branch --show-current`
- **STOP DEPLOYMENT** if branch is not `main` - inform user and halt
- **Changelog Rule**: In the change notes only include changes that are present in the `main` branch
- If work is on feature branches, it must be merged to `main` first before deployment

### Step 3: Run Tests
**MANDATORY**: ALWAYS run tests before deployment - NO EXCEPTIONS
- **IMPORTANT**: Run from root directory
- **Command**: `npm test` (runs tests for all workspaces - both MCP server and Extension)
- **MCP Server Tests**: Located in `MCPBrowser/tests/` - 195 tests across 11 suites
  - Unit tests (parallel): core/browser.test.js (64), core/html.test.js (51), core/page.test.js (43)
  - Integration tests (sequential): 
    - actions/click-element.test.js (3)
    - actions/type-text.test.js (4)
    - actions/get-interactive-elements.test.js (4)
    - actions/wait-for-element.test.js (3)
    - actions/get-current-html.test.js (4)
    - actions/fetch-page.test.js (3)
    - core/auth.test.js (14)
    - mcp-browser.test.js (2)
- **Extension Tests**: Located in `VSCodeExtension/test/` (Mocha)
  - Unit tests: extension.test.js (comprehensive suite for all functions)
- **STOP DEPLOYMENT if ANY test fails**
- Note: MCP integration tests require Chrome and manual authentication
- All tests must pass before proceeding to next step

### Step 4: Version Bump
Update version number in THREE package.json files:
- `MCPBrowser/package.json` - MCP server version
- `MCPBrowser/server.json` - MCP Registry version
- `VSCodeExtension/package.json` - Extension version
- **CRITICAL**: All three must have the SAME version number

### Step 5: Update Hardcoded npm Version in Extension
Update the hardcoded npm package version in `VSCodeExtension/src/extension.js`:
- Find line ~58: `let installCmd = 'npm install -g mcpbrowser@X.X.X';`
- Find line ~114: `args: ["-y", "mcpbrowser@X.X.X"],`
- Update BOTH occurrences to match the new version number
- **CRITICAL**: This ensures the VS Code extension installs the correct npm package version

### Step 6: Update ALL Descriptions - Two Sources of Truth
**SOURCE OF TRUTH #1 - MCP Server Purpose**: `VSCodeExtension/src/extension.js`
- Search for `config.servers.MCPBrowser` to find the `description` field
- This describes WHEN and WHY to use the MCP server (for mcp.json configuration)
- **Must propagate to**: ALL mcp.json samples in READMEs - search for `"description"` in code blocks and ensure they match exactly

**SOURCE OF TRUTH #2 - Fetch Tool API**: `MCPBrowser/src/mcp-browser.js`
- Search for `name: "fetch_webpage_protected"` to find the tool's `description` field
- This describes HOW the fetch tool works (technical API documentation for MCP protocol)
- This is different from #1 - it's for the tool API, not the server configuration

**Derived Descriptions** (should align with sources of truth but may be adapted for context):
- `MCPBrowser/package.json` - main package description (search for `"description"` field)
- `VSCodeExtension/package.json` - extension package description (search for `"description"` field)
- `MCPBrowser/server.json` - registry description (search for `"description"` field)
- `VSCodeExtension/README.md` - extension documentation opening paragraph
- `MCPBrowser/README.md` - MCP server documentation

**Tip**: Use grep/search to find all `"description"` or `description:` fields, verify each matches appropriate source of truth

### Step 7: Update Docs
Update version numbers in ALL documentation files:
- `README.md` (root overview)
- `MCPBrowser/README.md` (MCP server docs)
- `VSCodeExtension/README.md` (extension docs)
- Search for old version numbers in examples and update to current version

### Step 8: Update Changelog
Update `CHANGELOG.md` (root changelog) with changes
- **Location**: Single root changelog file at `CHANGELOG.md`
- **Format**: Entries organized by version with clear "MCP Server" and "VS Code Extension" section headers
- **Important**: Add changes under the appropriate package section (MCP Server vs VS Code Extension)

### Step 9: VERIFY SYNCHRONIZATION
**CRITICAL**: ALL files must be updated and committed BEFORE publishing
- Verify all version numbers match in THREE files:
  - `MCPBrowser/package.json`
  - `MCPBrowser/server.json`
  - `VSCodeExtension/package.json`
- Verify all descriptions are synchronized from their sources of truth
- **STOP** if any file is out of sync - never deploy to just one platform
- All three platforms (npm, VS Code Marketplace, server.json) must be updated together

### Step 10: Git Commit & Push
Commit all changes → `git push origin main`

### Step 11: Publish to npm
Publish MCP server to npm registry
- **Single command**: `cd MCPBrowser; npm publish; cd ..`
- This ensures we return to root after publishing

### Step 12: Publish to VS Code Marketplace
Publish extension to VS Code Marketplace
- **Single command**: `cd VSCodeExtension; vsce package --no-dependencies; vsce publish --packagePath mcpbrowser-<VERSION>.vsix; cd ..`
- This ensures all steps run and we return to root

### Step 13: Create GitHub Release
**CRITICAL**: Create a GitHub release for the new version
- Use `gh release create v<VERSION>` command
- Include release notes from CHANGELOG.md
- Tag format: `v<VERSION>` (e.g., v0.3.1)
- This makes it easy for users to track versions and download specific releases
- **Why this matters**: GitHub releases provide version history, download statistics, and integration with dependency management tools

## Distribution Platforms

1. **npm registry** - `npm publish` (from MCPBrowser/)
2. **VS Code Marketplace** - `vsce publish` (from VSCodeExtension/)
3. **MCP Registry** - via MCPBrowser/server.json (auto-indexed)
4. **GitHub Releases** - `gh release create` (version tracking & downloads)
