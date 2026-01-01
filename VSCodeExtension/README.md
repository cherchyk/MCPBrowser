# MCPBrowser

**Lightweight MCP server-extension for in-browser web page fetching.** Used when loading web page via browser is preferred - handles login, SSO, anti-crawler restrictions. Should be used when standard fetch_webpage fails.

## Features

- 🚀 **One-Click Setup**: Installs npm package and configures mcp.json automatically - complete setup with a single click
- 🔐 **Authentication Support**: Fetches web pages in your Chrome/Edge browser - authenticate once, reuse sessions automatically
- 🤖 **Bypass Anti-Crawler**: Fetch sites that block automated tools, including CAPTCHA and human verification

## How It Works

When Copilot needs to fetch a web page via browser:
1. MCPBrowser opens the URL in your Chrome/Edge browser
2. If authentication is required, you log in normally in the browser
3. MCPBrowser waits for the web page to fully load (handles redirects automatically)
4. Once loaded, it extracts the content and returns it to Copilot
5. The browser tab stays open to reuse your session for future requests

## Usage

### Installation Steps

1. Install this extension from VS Code marketplace
2. You'll see a notification: **"MCPBrowser is available! Would you like to configure it for GitHub Copilot?"**
3. Click **"Configure Now"**
4. Wait for "Installing MCPBrowser npm package..." to complete
5. When you see **"MCPBrowser configured successfully!"**, click **"Restart Now"**
6. After restart, MCPBrowser is ready to use with Copilot!

### Using with GitHub Copilot

Once configured, Copilot will automatically use MCPBrowser when it encounters auth/crawler blocks. You can also explicitly request it:

**Example prompts:**
```
Fetch https://internal.company.com/docs (I'm already logged in)

Fetch the content from https://portal.azure.com/resources - use my authenticated session

Fetch https://github.com/private-repo/issues using MCPBrowser
```

Copilot will use your Chrome/Edge browser session to fetch these pages, bypassing authentication and anti-crawler restrictions.

### Manual Commands

Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`):
- **Configure MCPBrowser for GitHub Copilot** - Set up or update configuration
- **Remove MCPBrowser from GitHub Copilot** - Remove configuration

## About MCPBrowser

Alternative web fetcher for GitHub Copilot when normal URL fetch fails. Uses Chrome DevTools Protocol to fetch authenticated and crawler-protected web pages through your browser session.

**Use cases:**
1. **Auth-required pages**: 401/403 errors, login pages, SSO, corporate intranets
2. **Anti-bot/crawler blocks**: CAPTCHA, human verification, bot detection
3. **JavaScript-heavy sites**: SPAs, dynamic content requiring browser rendering

Learn more: [MCPBrowser on GitHub](https://github.com/cherchyk/MCPBrowser)

## License

MIT
