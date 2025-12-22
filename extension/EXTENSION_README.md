# MCPBrowser VS Code Extension

Professional one-click configuration extension for MCPBrowser.

## Development Setup

```bash
cd extension
npm install
```

## Testing Locally

1. Open the `extension` folder in VS Code
2. Press F5 to launch Extension Development Host
3. Test the commands:
   - `Ctrl+Shift+P` → "Configure MCPBrowser for GitHub Copilot"
   - `Ctrl+Shift+P` → "Remove MCPBrowser from GitHub Copilot"

## Publishing to VS Code Marketplace

### Prerequisites

1. Install vsce (VS Code Extension Manager):
   ```bash
   npm install -g @vscode/vsce
   ```

2. Get a Personal Access Token from Azure DevOps:
   - Go to https://dev.azure.com
   - Create a new organization if needed
   - User Settings → Personal Access Tokens
   - Create token with **Marketplace (Manage)** scope
   - Save the token securely

### Create Publisher

First time only:
```bash
vsce create-publisher cherchyk
```

Login:
```bash
vsce login cherchyk
```

### Package and Publish

```bash
cd extension

# Package the extension
vsce package

# Publish to marketplace
vsce publish
```

Or publish in one command:
```bash
vsce publish patch  # Bumps patch version and publishes
vsce publish minor  # Bumps minor version and publishes
vsce publish major  # Bumps major version and publishes
```

### Manual Installation for Testing

Generate .vsix file:
```bash
vsce package
```

Install in VS Code:
1. Extensions sidebar → ... → Install from VSIX
2. Select the generated `mcpbrowser-0.1.1.vsix`

## Features

✅ **Automatic Detection** - Shows notification when MCPBrowser is available  
✅ **One-Click Setup** - Configures mcp.json automatically  
✅ **Smart Updates** - Handles existing configurations  
✅ **Easy Removal** - Clean uninstall option  
✅ **Cross-Platform** - Works on Windows, macOS, Linux  

## Extension Structure

```
extension/
├── package.json          # Extension manifest
├── src/
│   └── extension.js      # Main extension code
├── README.md            # User-facing documentation
├── CHANGELOG.md         # Version history
└── .vscodeignore        # Files to exclude from package
```

## How It Works

1. **Activation**: Extension activates on VS Code startup
2. **Detection**: Checks if MCPBrowser is configured in mcp.json
3. **Prompt**: Shows notification if not configured
4. **Configuration**: Adds MCPBrowser server config to mcp.json
5. **Restart**: Prompts to restart VS Code for changes to take effect

## Publishing Checklist

- [ ] Update version in package.json
- [ ] Update CHANGELOG.md
- [ ] Add icon.png (128x128px recommended)
- [ ] Test extension locally
- [ ] Run `vsce package` to verify build
- [ ] Run `vsce publish`
- [ ] Verify on marketplace
- [ ] Create GitHub release tag

## Marketplace Link

Once published: https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser
