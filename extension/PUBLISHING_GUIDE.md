# Publishing MCPBrowser Extension to VS Code Marketplace

## Step-by-Step Publishing Guide

### 1. Create Icon (PNG from SVG)

You need a 128x128 PNG icon. I've created an SVG, now convert it:

**Option A: Online Converter**
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icon.svg`
3. Set dimensions to 128x128
4. Download as `icon.png`
5. Move to `extension/` folder

**Option B: Using Inkscape (if installed)**
```bash
inkscape icon.svg -w 128 -h 128 -o icon.png
```

**Option C: PowerShell with ImageMagick**
```powershell
# Install ImageMagick from https://imagemagick.org/
magick icon.svg -resize 128x128 icon.png
```

### 2. Get Publisher Account

1. **Create Microsoft Account** (if you don't have one)
   - Go to https://account.microsoft.com/

2. **Create Azure DevOps Organization**
   - Go to https://dev.azure.com/
   - Click "Start free"
   - Create organization (e.g., "cherchyk-extensions")

3. **Get Personal Access Token (PAT)**
   - In Azure DevOps, click User Settings icon (top right)
   - Select "Personal access tokens"
   - Click "+ New Token"
   - Settings:
     - **Name**: "VS Code Marketplace"
     - **Organization**: Your organization
     - **Expiration**: Custom (1 year recommended)
     - **Scopes**: Click "Show all scopes"
     - **Check ONLY**: "Marketplace" → "Manage"
   - Click "Create"
   - **IMPORTANT**: Copy the token immediately - you won't see it again!
   - Save it in a password manager

### 3. Create Publisher

First time only:

```bash
# Install vsce globally
npm install -g @vscode/vsce

# Create publisher
vsce create-publisher cherchyk

# You'll be prompted for:
# - Publisher name: cherchyk
# - Personal Access Token: [paste your PAT]
```

Alternative: Create publisher via web
- Go to https://marketplace.visualstudio.com/manage/publishers
- Click "Create publisher"
- ID: cherchyk
- Name: Your display name
- Save

### 4. Login to Publisher

```bash
vsce login cherchyk
# Enter your PAT when prompted
```

### 5. Pre-Publishing Checklist

Before publishing, verify:

```bash
cd extension

# Check package.json is correct
cat package.json

# Verify icon exists
ls icon.png

# Test packaging (creates .vsix file)
vsce package

# Install locally to test
# In VS Code: Extensions → ... → Install from VSIX → select .vsix file
```

Test the extension thoroughly:
- [ ] Install from .vsix works
- [ ] Extension activates on startup
- [ ] Configure command works
- [ ] Remove command works
- [ ] Notification appears if not configured
- [ ] mcp.json is modified correctly
- [ ] Works on your platform (Windows/Mac/Linux)

### 6. Publish to Marketplace

**Initial Publish:**
```bash
vsce publish
```

**Future Updates:**
```bash
# Patch version (0.1.0 → 0.1.1)
vsce publish patch

# Minor version (0.1.0 → 0.2.0)
vsce publish minor

# Major version (0.1.0 → 1.0.0)
vsce publish major

# Specific version
vsce publish 1.0.0
```

### 7. Verify Publication

1. Check marketplace page (wait 5-10 minutes for indexing):
   - https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser

2. Search in VS Code:
   - Extensions → Search "MCPBrowser"
   - Should see your extension

3. Install and test from marketplace

### 8. Post-Publication

**Create GitHub Release:**
```bash
cd ..
git tag extension-v0.1.0
git push origin extension-v0.1.0
```

On GitHub:
1. Go to Releases → "Create a new release"
2. Tag: extension-v0.1.0
3. Title: "MCPBrowser v0.1.0"
4. Description: Copy from CHANGELOG.md
5. Attach the .vsix file
6. Publish release

**Update Main README:**
Add extension link to main project README:
```markdown
## Installation

### Option 1: VS Code Extension (Recommended)
Install [MCPBrowser](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser) from the VS Code Marketplace.
```

### 9. Troubleshooting

**"Error: Missing publisher name"**
- Add `"publisher": "cherchyk"` to package.json

**"Error: Missing icon"**
- Ensure icon.png exists in extension folder
- Remove `"icon": "icon.png"` line if no icon yet

**"Error: Invalid Personal Access Token"**
- Token expired - create new one
- Run `vsce login cherchyk` again

**"Error: Extension already published"**
- Bump version number in package.json
- Or use `vsce publish patch/minor/major`

### 10. Maintenance

**Updating the Extension:**
1. Make changes to code
2. Update CHANGELOG.md
3. Test locally
4. Run `vsce publish patch` (or minor/major)
5. Create GitHub release

**Unpublishing (if needed):**
```bash
vsce unpublish cherchyk.mcpbrowser
```

### Quick Reference

```bash
# Install tools
npm install -g @vscode/vsce

# Package without publishing (creates .vsix)
vsce package

# Publish
vsce publish

# Update version and publish
vsce publish patch  # 0.1.0 → 0.1.1
vsce publish minor  # 0.1.0 → 0.2.0
vsce publish major  # 0.1.0 → 1.0.0
```

## Support

- VS Code Extension API: https://code.visualstudio.com/api
- Publishing Extensions: https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- Marketplace Management: https://marketplace.visualstudio.com/manage

## Next Steps

1. ✅ Convert icon.svg to icon.png
2. ✅ Create Azure DevOps account
3. ✅ Get Personal Access Token
4. ✅ Install vsce: `npm install -g @vscode/vsce`
5. ✅ Test package: `vsce package`
6. ✅ Publish: `vsce publish`
7. ✅ Celebrate! 🎉
