# MCPBrowser

One-click VS Code extension to configure MCPBrowser for GitHub Copilot.

## Features

- 🚀 **One-Click Setup**: Configure MCPBrowser for GitHub Copilot with a single click
- 🔄 **Automatic Detection**: Detects when MCPBrowser is available and offers to configure it
- 🗑️ **Easy Removal**: Remove configuration just as easily
- ⚙️ **Smart Configuration**: Automatically modifies your `mcp.json` file

## Usage

### Automatic Prompt

When you install this extension, it will automatically detect if MCPBrowser is available and show a notification asking if you want to configure it for GitHub Copilot.

### Manual Commands

You can also use the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):

- **Configure MCPBrowser for GitHub Copilot** - Adds MCPBrowser to your mcp.json
- **Remove MCPBrowser from GitHub Copilot** - Removes MCPBrowser from your mcp.json

## What It Does

This extension automatically adds the following configuration to your VS Code `mcp.json` file:

```json
{
  "servers": {
    "MCPBrowser": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"],
      "description": "Loads authenticated web pages using Chrome DevTools Protocol"
    }
  }
}
```

## Requirements

- VS Code 1.85.0 or higher
- MCPBrowser npm package (installed automatically via npx)

## Installation

Install this extension from the VS Code marketplace, then:

1. Click "Configure Now" when prompted, or
2. Use Command Palette > "Configure MCPBrowser for GitHub Copilot"
3. Restart VS Code
4. MCPBrowser is now available in GitHub Copilot!

## About MCPBrowser

MCPBrowser is an MCP (Model Context Protocol) server that enables GitHub Copilot to load authenticated web pages using your Chrome browser session. It's perfect for accessing content behind authentication, SSO, or corporate intranets.

Learn more: [MCPBrowser on GitHub](https://github.com/cherchyk/MCPBrowser)

## License

MIT
