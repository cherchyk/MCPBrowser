# MCPBrowser

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/cherchyk.mcpbrowser.svg)](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
[![npm version](https://img.shields.io/npm/v/mcpbrowser.svg)](https://www.npmjs.com/package/mcpbrowser)
[![Claude Desktop](https://img.shields.io/badge/Claude-Desktop-5865F2?logo=anthropic)](https://modelcontextprotocol.io/quickstart/user)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This repo contains two related projects:

## 📦 Projects

### [MCPBrowser](./MCPBrowser/) - MCP Server
MCP server for in-browser web page fetching using Chrome DevTools Protocol. Handles login-protected pages, corporate SSO, and anti-crawler restrictions.

**Published as:** [`mcpbrowser` on npm](https://www.npmjs.com/package/mcpbrowser)

[📖 Full Documentation](./MCPBrowser/README.md)

### [VSCodeExtension](./VSCodeExtension/) - VS Code Extension
VS Code extension that automatically installs and configures the MCPBrowser MCP server for GitHub Copilot and Claude Code.

**Published as:** [`cherchyk.mcpbrowser` on VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)

[📖 Full Documentation](./VSCodeExtension/README.md)

## 🚀 Quick Start

### For End Users

**Option 1: VS Code Extension (Easiest)**
```bash
code --install-extension cherchyk.mcpbrowser
```

**Option 2: npm Package (Manual Setup)**
```bash
npx -y mcpbrowser@latest
```

See [MCPBrowser README](./MCPBrowser/README.md) for full installation options.

### For Developers

**Clone and setup:**
```bash
git clone https://github.com/cherchyk/MCPBrowser.git
cd MCPBrowser
npm install
```

**Run tests:**
```bash
# Test everything
npm test

# Test MCP server only
npm run test:mcp

# Test extension only
npm run test:extension
```

**Install all workspace dependencies:**
```bash
npm run install:all
```

## 📝 License

MIT - See [LICENSE](./LICENSE) file for details

## 🔗 Links

- [GitHub Repository](https://github.com/cherchyk/MCPBrowser)
- [npm Package](https://www.npmjs.com/package/mcpbrowser)
- [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser)
- [MCP Registry](https://registry.modelcontextprotocol.io/)
- [Issues](https://github.com/cherchyk/MCPBrowser/issues)
