# Deployment Guide

This guide outlines the deployment process for publishing updates to both the MCP server (npm) and VS Code extension (Marketplace).

## Prerequisites

- Node.js and npm installed
- `vsce` CLI installed (`npm install -g @vscode/vsce`)
- npm authentication configured (`npm login`)
- VS Code Marketplace publisher access
- Working on `main` branch
- All tests passing

## Quick Deployment Checklist

1. ✅ **Verify branch** - Must be on `main`
2. ✅ **Run tests** - `npm test` (from root)
3. ✅ **Update versions** - Bump version in 3 files (see below)
4. ✅ **Update descriptions** - Sync from sources of truth
5. ✅ **Update docs** - Version numbers in READMEs
6. ✅ **Update changelog** - Add new version entry
7. ✅ **Commit & push** - `git push origin main`
8. ✅ **Verify sync** - All versions match
9. ✅ **Publish npm** - `cd MCPBrowser; npm publish; cd ..`
10. ✅ **Publish extension** - `cd VSCodeExtension; vsce package --no-dependencies; vsce publish --packagePath mcpbrowser-<VERSION>.vsix; cd ..`

## Version Files (Must All Match)

Update version number in these **3 files**:
- `MCPBrowser/package.json`
- `MCPBrowser/server.json`
- `VSCodeExtension/package.json`

**Example**: All should be `0.2.29` or whatever the next version is.

## Description Sources of Truth

### Source #1: MCP Server Purpose
**File**: `VSCodeExtension/src/extension.js`
**Location**: Search for `config.servers.MCPBrowser` → `description` field
**Purpose**: Describes WHEN and WHY to use the server (for mcp.json configuration)
**Propagate to**: All mcp.json code samples in READMEs

### Source #2: Fetch Tool API
**File**: `MCPBrowser/src/mcp-browser.js`
**Location**: Search for `name: "fetch_webpage_protected"` → `description` field
**Purpose**: Describes HOW the fetch tool works (technical API docs)

### Derived Descriptions
These should align with the sources above:
- `MCPBrowser/package.json` - npm package description
- `VSCodeExtension/package.json` - extension package description
- `MCPBrowser/server.json` - MCP registry description
- `MCPBrowser/README.md` - server documentation
- `VSCodeExtension/README.md` - extension documentation

## Documentation Files to Update

Search for old version numbers and update:
- `README.md` (root)
- `MCPBrowser/README.md`
- `VSCodeExtension/README.md`

## Changelog Format

**File**: `CHANGELOG.md` (root level)

```markdown
## [0.2.29] - 2025-12-28

### MCP Server
- Added new feature X
- Fixed bug Y

### VS Code Extension
- Updated configuration Z
```

## Publishing Commands

### npm (MCP Server)
```bash
cd MCPBrowser
npm publish
cd ..
```

### VS Code Marketplace (Extension)
```bash
cd VSCodeExtension
vsce package --no-dependencies
vsce publish --packagePath mcpbrowser-<VERSION>.vsix
cd ..
```

Replace `<VERSION>` with the actual version number (e.g., `0.2.29`).

## Distribution Platforms

After publishing, the package will be available on:
1. **npm registry** - https://www.npmjs.com/package/mcpbrowser
2. **VS Code Marketplace** - Extension ID: `mcpbrowser`
3. **MCP Registry** - Auto-indexed from `server.json`

## Rollback

If you need to unpublish or deprecate:

```bash
# Unpublish from npm (within 72 hours)
npm unpublish mcpbrowser@<VERSION>

# Deprecate on npm (after 72 hours)
npm deprecate mcpbrowser@<VERSION> "Reason for deprecation"

# VS Code Marketplace
# No direct unpublish - must publish a new fixed version
```

## Common Issues

**Tests failing**: Fix tests before deploying - never deploy with failing tests
**Wrong branch**: Only deploy from `main` branch
**Version mismatch**: All 3 package files must have identical version
**Description sync**: Ensure all descriptions align with sources of truth
