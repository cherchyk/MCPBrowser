# Automated Deployment Pipeline

## Overview
This pipeline automates deployment to npm, VS Code Marketplace, and GitHub Releases when changes are merged to `main`.

---

# 📋 Pre-Deployment Checklist

Follow these steps IN ORDER before merging to main:

## Step 1: Run Browser Tests
```bash
# Run all browser tests on Chrome
node tests/run-browser.js chrome

# Run all browser tests on Edge
node tests/run-browser.js edge

# Or run all tests (unit + browser)
npm test
```
**Requirement**: All tests must pass ✅

---

## Step 2: Bump Version Number
Update version in **ALL THREE** files (must be the same version):

### Files to update:
1. **`MCPBrowser/package.json`**
   - Change `"version": "0.3.4"` → `"version": "0.3.5"` (or your new version)

2. **`MCPBrowser/server.json`**
   - Change `"version": "0.3.4"` → `"version": "0.3.5"`

3. **`VSCodeExtension/package.json`**
   - Change `"version": "0.3.4"` → `"version": "0.3.5"`

**Critical**: All three files MUST have the exact same version number!

---

## Step 3: Update Documentation Files (Optional)
These files reference versions but can auto-update:

### README files (if needed):
- `README.md` - Usually references @latest, no update needed
- `MCPBrowser/README.md` - Usually references @latest, no update needed
- `VSCodeExtension/README.md` - Usually references version in install command

**Note**: Most READMEs use `@latest` so no update needed. Only update if you have specific version references.

---

## Step 4: Update CHANGELOG.md
Add a new section at the top of `CHANGELOG.md`:

```markdown
## [0.3.5] - 2026-01-04

### MCP Server
- 🏗️ **Browser architecture**: Created BaseBrowser and ChromiumBrowser base classes
- ♻️ **Code reduction**: Eliminated ~311 lines of duplicated code between Chrome and Edge
- 🎯 **Better organization**: Chrome/Edge implementations reduced to ~65 lines of config each

### VS Code Extension
- 📦 **Version sync**: Updated to match MCP server version
```

**Format**:
- Use `## [VERSION] - YYYY-MM-DD`
- Separate MCP Server and VS Code Extension sections
- Use emoji prefixes for clarity
- Describe what changed

---

## Step 5: Commit Changes
```bash
git add .
git commit -m "chore: bump version to 0.3.5"
git push origin feature/your-branch
```

---

## Step 6: Create Pull Request and Merge
1. Create PR from your feature branch to `main`
2. Review changes
3. Merge to `main`

---

## Step 7: Pipeline Deploys Automatically! 🚀
Once merged to `main`, the GitHub Actions pipeline will automatically handle deployment.

---

# 🤖 How the Pipeline Works

## Trigger
The pipeline is triggered when a commit is pushed to `main` that modifies any of these files:
- `MCPBrowser/package.json`
- `VSCodeExtension/package.json`
- `MCPBrowser/server.json`

## Version Detection
The pipeline checks if the version number was bumped:
- Compares current version with previous commit
- Only deploys if version was actually changed
- Prevents accidental re-deployments

## Automated Steps

1. **Check Version Synchronization** ✅
   - Verifies all three files have the same version
   - Fails if versions don't match

2. **Run Tests** ✅
   - Runs `npm run test:ci` (all unit tests)
   - Deployment stops if tests fail

3. **Publish to npm** ✅
   - Publishes MCP server package
   - Requires `NPM_TOKEN` secret

4. **Publish to VS Code Marketplace** ✅
   - Packages and publishes extension
   - Requires `VSCE_PAT` secret

5. **Create GitHub Release** ✅
   - Creates release with changelog
   - Attaches `.vsix` file
   - Uses version from package.json

---

# 🔐 Required GitHub Secrets

You need to configure these secrets in your repository settings:

1. **`NPM_TOKEN`**
   - Get from npmjs.com → Access Tokens → Generate New Token
   - Type: "Automation"
   - Add to: Settings → Secrets and variables → Actions → New repository secret

2. **`VSCE_PAT`**
   - Get from: https://dev.azure.com/[your-org]/_usersSettings/tokens
   - Scopes: "Marketplace" (Manage)
   - Add to: Settings → Secrets and variables → Actions → New repository secret

3. **`GITHUB_TOKEN`** (automatic)
   - Already provided by GitHub Actions
   - No configuration needed

---

# 📊 Complete Workflow Example

1. **Create feature branch**: `git checkout -b feature/new-thing`
2. **Make your changes**
3. **Run browser tests**: `node tests/run-browser.js chrome`
4. **Update version** in all 3 files (e.g., 0.3.4 → 0.3.5)
5. **Update CHANGELOG.md** with changes
6. **Commit**: `git commit -am "feat: add new thing (v0.3.5)"`
7. **Push**: `git push origin feature/new-thing`
8. **Create PR** and merge to `main`
9. **Pipeline automatically deploys!** 🚀

---

# 📈 Monitoring Deployment

- Go to: Repository → Actions → "Deploy to npm and VS Code Marketplace"
- View deployment logs in real-time
- Check status of each step
- If deployment fails, check the error logs

---

# 🔧 Manual Override

If you need to deploy manually (pipeline not working):
1. Follow steps in `.github/instructions/deployment.md`
2. Run deployment commands locally
3. Investigate why pipeline failed

---

# ⚠️ Limitations

**Browser Tests NOT Run**:
- Integration tests requiring Chrome are skipped (`npm run test:ci`)
- Only unit tests run in CI/CD
- Browser tests should be run locally before merging

**Cannot Run on Feature Branches**:
- Pipeline only triggers on `main` branch
- This is intentional to prevent accidental deployments

---

# ✅ Quick Checklist

Before merging to main:
- [ ] Browser tests pass
- [ ] Version updated in MCPBrowser/package.json
- [ ] Version updated in MCPBrowser/server.json
- [ ] Version updated in VSCodeExtension/package.json
- [ ] All 3 versions match
- [ ] CHANGELOG.md updated with new version section
- [ ] Changes committed and pushed
- [ ] PR created and merged to main
- [ ] Wait for pipeline to deploy 🎉

