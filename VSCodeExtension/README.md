# ✅ MCPBrowser (MCP Browser)

> ⚠️ **Security Notice:** MCPBrowser extracts webpage content and provides it to your AI agent (e.g., GitHub Copilot, Kiro, Antigravity), which then sends it to the LLM provider it uses (e.g., Anthropic, OpenAI, GitHub) for processing. Make sure you trust both your agent and the LLM provider — especially when accessing pages with sensitive or private data. MCPBrowser combines private data access, untrusted content exposure, and external communication (the MCP "[lethal trifecta](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/)") — all tool annotations accurately declare these risks so MCP clients can enforce appropriate safety controls.

**MCP browser server extension for VS Code, Kiro, Antigravity, and compatible editors.** This browser-based MCP server extension enables in-browser web page fetching using your real Chrome, Edge, or Brave browser. Used when loading web pages via browser automation is preferred - handles login, SSO, CAPTCHA, and anti-crawler restrictions. Should be used when standard browser_fetch_webpage fails.

## Features

- 🚀 **No Runtime Downloads**: The MCP server and its dependencies are bundled in the signed VSIX
- 🏢 **Enterprise Ready**: Uses VS Code's native MCP provider API and stable registry identity
- 🔐 **Authentication Support**: Fetches web pages in your Chrome/Edge/Brave browser - authenticate once, reuse sessions automatically
- 🤖 **Bypass Anti-Crawler**: Fetch sites that block automated tools, including CAPTCHA and human verification

## Requirements

- Chrome, Edge, or Brave browser
- VS Code 1.107 or later

The extension uses VS Code's embedded Node.js runtime. It does not install global npm packages or download code when the MCP server starts.

## How It Works

When your AI agent needs to fetch a web page via browser:
1. MCPBrowser opens the URL in your Chrome/Edge/Brave browser
2. If authentication is required, you log in normally in the browser
3. MCPBrowser waits for the web page to fully load (handles redirects automatically)
4. Once loaded, it extracts the content and returns it to your AI agent
5. The browser tab stays open to reuse your session for future requests

## Usage

### Installation Steps

1. Install this extension from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser) or [Open VSX Registry](https://open-vsx.org/extension/cherchyk/mcpbrowser)
2. MCPBrowser registers its bundled MCP server automatically
3. Open **MCP: List Servers** and confirm `io.github.cherchyk/mcpbrowser` is available
4. MCPBrowser is ready to use with your AI agent

### Using with Your AI Agent

Once configured, your AI agent (GitHub Copilot, Kiro Agent, Antigravity Agent, etc.) will automatically use MCPBrowser when it encounters auth/crawler blocks. You can also explicitly request it:

**Example prompts:**
```
Fetch https://internal.company.com/docs (I'm already logged in)

Fetch the content from https://portal.azure.com/resources - use my authenticated session

Fetch https://github.com/private-repo/issues using MCPBrowser
```

Your AI agent will use your Chrome/Edge/Brave browser session to fetch these pages, bypassing authentication and anti-crawler restrictions.

### Manual Commands

Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):
- **Configure MCPBrowser** - Verify the bundled MCP server or configure compatible editors
- **Remove MCPBrowser** - Show removal guidance or remove compatible-editor configuration

## Enterprise allowlisting

MCPBrowser is published in the official MCP Registry with this canonical ID:

```text
io.github.cherchyk/mcpbrowser
```

For VS Code enterprise policy, allow the extension and MCP server:

```json
{
  "AllowedExtensions": {
    "cherchyk.mcpbrowser": "stable"
  },
  "ChatAllowedMcpServers": [
    {
      "serverName": "io.github.cherchyk/mcpbrowser"
    }
  ]
}
```

For GitHub Copilot organization or enterprise policy, add the canonical ID to the organization's MCP registry before enabling **Registry only** access.

## About MCPBrowser

Alternative web fetcher for AI agents when normal URL fetch fails. Uses Chrome DevTools Protocol to fetch authenticated and crawler-protected web pages through your browser session. Works with GitHub Copilot, Kiro, Antigravity, and any MCP-compatible AI agent.

**Supported editors:** VS Code, Kiro, Antigravity, VSCodium, and any editor supporting Open VSX extensions.

**Use cases:**
1. **Auth-required pages**: 401/403 errors, login pages, SSO, corporate intranets
2. **Anti-bot/crawler blocks**: CAPTCHA, human verification, bot detection
3. **JavaScript-heavy sites**: SPAs, dynamic content requiring browser rendering

Learn more: [MCPBrowser on GitHub](https://github.com/cherchyk/MCPBrowser)

## License

MIT
