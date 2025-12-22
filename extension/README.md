# MCPBrowser

Alternative web fetcher for GitHub Copilot when normal URL access fails due to authentication or anti-crawler restrictions.

## Features

- 🚀 **One-Click Setup**: Installs npm package and configures mcp.json automatically
- 🔐 **Bypass Authentication**: Opens pages in your Chrome/Edge browser - you authenticate if needed, MCPBrowser waits and fetches the final page content
- 🤖 **Beat Anti-Crawler**: Works when sites block Copilot's normal fetching
- ⚙️ **Auto-Configuration**: Complete setup with a single click

## How It Works

When Copilot needs to access an authenticated or protected page:
1. MCPBrowser opens the URL in your Chrome/Edge browser
2. If authentication is required, you log in normally in the browser
3. MCPBrowser waits for the page to fully load (handles redirects automatically)
4. Once loaded, it extracts the content and returns it to Copilot
5. The browser tab stays open to reuse your session for future requests

## Usage

### Installation (Automatic)

1. Install this extension from VS Code marketplace
2. Click "Configure Now" when prompted
3. Extension installs npm package and configures mcp.json automatically
4. Restart VS Code

### Using with GitHub Copilot

Once configured, Copilot will automatically use MCPBrowser when it encounters auth/crawler blocks. You can also explicitly request it:

**Example prompts:**
```
Read https://internal.company.com/docs (I'm already logged in)

Load the content from https://portal.azure.com/resources - use my authenticated session

Fetch https://github.com/private-repo/issues using MCPBrowser
```

Copilot will use your Chrome/Edge browser session to access these pages, bypassing authentication and anti-crawler restrictions.

### Manual Commands

Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):
- **Configure MCPBrowser for GitHub Copilot** - Set up or update configuration
- **Remove MCPBrowser from GitHub Copilot** - Remove configuration

## About MCPBrowser

Alternative web fetcher for GitHub Copilot when normal URL access fails. Uses Chrome DevTools Protocol to access authenticated and crawler-protected pages through your browser session.

Learn more: [MCPBrowser on GitHub](https://github.com/cherchyk/MCPBrowser)

## License

MIT
