# MCPBrowser client installation

MCPBrowser requires [Node.js 18+](https://nodejs.org/) and Chrome, Edge, or Brave. See the [root README](../README.md) for an overview and privacy details.

## Standard configuration

This configuration works in most MCP clients. Client-specific instructions follow.

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

## Clients

- [Amp](#amp)
- [Claude Code](#claude-code)
- [Claude Desktop](#claude-desktop)
- [Cline](#cline)
- [Codex](#codex)
- [Copilot CLI](#copilot-cli)
- [Cursor](#cursor)
- [Factory](#factory)
- [Gemini CLI](#gemini-cli)
- [Goose](#goose)
- [Kiro](#kiro)
- [LM Studio](#lm-studio)
- [opencode](#opencode)
- [OpenClaw](#openclaw)
- [Qodo Gen](#qodo-gen)
- [VS Code (GitHub Copilot)](#vs-code-github-copilot)
- [VS Code Extension](#vs-code-extension)
- [Warp](#warp)
- [Windsurf](#windsurf)

### Amp

Add via the Amp VS Code extension settings screen or by updating your settings.json file:

```json
"amp.mcpServers": {
  "mcpbrowser": {
    "command": "npx",
    "args": ["-y", "mcpbrowser@latest"]
  }
}
```

**Amp CLI Setup:**

```bash
amp mcp add mcpbrowser -- npx -y mcpbrowser@latest
```

### Claude Code

Use the Claude Code CLI to add the MCPBrowser MCP server:

```bash
claude mcp add mcpbrowser --scope user -- npx -y mcpbrowser@latest
```

Verify it's working:

```bash
claude mcp list
```

You should see:

```
mcpbrowser: npx -y mcpbrowser@latest - ✓ Connected
```

### Claude Desktop

Add to your config file (create it if it doesn't exist):

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json` (e.g., `C:\Users\<username>\AppData\Roaming\Claude\claude_desktop_config.json`)\
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

Restart Claude Desktop after saving.

### Cline

Follow the instruction in the section [Configuring MCP Servers](https://docs.cline.bot/mcp/configuring-mcp-servers).

Add the following to your [`cline_mcp_settings.json`](https://docs.cline.bot/mcp/configuring-mcp-servers#editing-mcp-settings-files) file:

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "type": "stdio",
      "command": "npx",
      "timeout": 30,
      "args": ["-y", "mcpbrowser@latest"],
      "disabled": false
    }
  }
}
```

### Codex

Use the Codex CLI to add the MCPBrowser MCP server:

```bash
codex mcp add mcpbrowser npx "-y" "mcpbrowser@latest"
```

Alternatively, create or edit the configuration file `~/.codex/config.toml` and add:

```toml
[mcp_servers.mcpbrowser]
command = "npx"
args = ["-y", "mcpbrowser@latest"]
```

For more information, see the [Codex MCP documentation](https://github.com/openai/codex/blob/main/codex-rs/config.md#mcp_servers).

### Copilot CLI

Use the Copilot CLI to interactively add the MCPBrowser MCP server:

```bash
/mcp add
```

When prompted, enter the following values:

| Field                     | Value                      |
| ------------------------- | -------------------------- |
| **Server Name**           | `mcpbrowser`               |
| **Server Type**           | `1` (Local)                |
| **Command**               | `npx -y mcpbrowser@latest` |
| **Environment Variables** | _(leave empty)_            |
| **Tools**                 | `*`                        |

Alternatively, create or edit the configuration file `~/.copilot/mcp-config.json` and add:

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "type": "local",
      "command": "npx",
      "tools": ["*"],
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

For more information, see the [Copilot CLI documentation](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli).

**Copilot plugin:** The [MCPBrowser plugin bundle](../AgentPlugin/README.md) combines a version-pinned server configuration with a browser workflow skill. After the bundle is published and its pinned npm version is available, install with `copilot plugin install cherchyk/MCPBrowser:AgentPlugin` instead of configuring the same server manually. Marketplace listing requires a separate submission and GitHub approval.

### Cursor

[![Install in Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/install-mcp?name=MCPBrowser&config=eyJjb21tYW5kIjoibnB4IC15IG1jcGJyb3dzZXJAbGF0ZXN0In0%3D)

**Or install manually:**

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx -y mcpbrowser@latest`. You can also verify config or add command like arguments via clicking `Edit`.

### Factory

Use the Factory CLI to add the MCPBrowser MCP server:

```bash
droid mcp add mcpbrowser "npx -y mcpbrowser@latest"
```

Alternatively, type `/mcp` within Factory droid to open an interactive UI for managing MCP servers.

For more information, see the [Factory MCP documentation](https://docs.factory.ai/cli/configuration/mcp).

### Gemini CLI

Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use the standard config above.

### Goose

[![Install in Goose](https://block.github.io/goose/img/extension-install-dark.svg)](https://block.github.io/goose/extension?cmd=npx&arg=-y&arg=mcpbrowser%40latest&id=mcpbrowser&name=MCPBrowser&description=Browser%20automation%20MCP%20server%20using%20Chrome%2FEdge)

**Or install manually:**

Go to `Advanced settings` -> `Extensions` -> `Add custom extension`. Name to your liking, use type `STDIO`, and set the `command` to `npx -y mcpbrowser@latest`. Click "Add Extension".

### Kiro

Follow the MCP Servers [documentation](https://kiro.dev/docs/mcp/). For example in `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "mcpbrowser": {
      "command": "npx",
      "args": ["-y", "mcpbrowser@latest"]
    }
  }
}
```

### LM Studio

[![Add MCP Server mcpbrowser to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=mcpbrowser&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIm1jcGJyb3dzZXJAbGF0ZXN0Il19)

**Or install manually:**

Go to `Program` in the right sidebar -> `Install` -> `Edit mcp.json`. Use the standard config above.

### opencode

Follow the MCP Servers [documentation](https://opencode.ai/docs/mcp-servers/). For example in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mcpbrowser": {
      "type": "local",
      "command": ["npx", "-y", "mcpbrowser@latest"],
      "enabled": true
    }
  }
}
```

### OpenClaw

[OpenClaw](https://openclaw.ai/) is a personal AI assistant that runs on your devices. Add MCPBrowser using the CLI:

```bash
openclaw mcp add mcpbrowser -- npx -y mcpbrowser@latest
```

Verify it's working:

```bash
openclaw mcp list
```

For more information, see the [OpenClaw MCP documentation](https://docs.openclaw.ai/).

### Qodo Gen

Open [Qodo Gen](https://docs.qodo.ai/qodo-documentation/qodo-gen) chat panel in VSCode or IntelliJ → Connect more tools → + Add new MCP → Paste the standard config above.

Click `Save`.

### VS Code (GitHub Copilot)

[![Install in VS Code](https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF)](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522mcpbrowser%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522mcpbrowser%2540latest%2522%255D%257D)
[![Install in VS Code Insiders](https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5)](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522mcpbrowser%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522mcpbrowser%2540latest%2522%255D%257D)

**Or install manually:**

Follow the MCP install [guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server), use the standard config above. You can also install the MCPBrowser MCP server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"mcpbrowser","command":"npx","args":["-y","mcpbrowser@latest"]}'
```

After installation, the MCPBrowser MCP server will be available for use with your AI agent in VS Code.

### VS Code Extension

Install from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=cherchyk.mcpbrowser) or [Open VSX Registry](https://open-vsx.org/extension/cherchyk/mcpbrowser), or run:

```bash
code --install-extension cherchyk.mcpbrowser
```

The extension automatically installs and configures everything for your AI agent (GitHub Copilot, Kiro Agent, Antigravity Agent). Also works with VSCodium and other Open VSX-compatible editors.

### Warp

Go to `Settings` -> `AI` -> `Manage MCP Servers` -> `+ Add` to [add an MCP Server](https://docs.warp.dev/knowledge-and-collaboration/mcp#adding-an-mcp-server). Use the standard config above.

Alternatively, use the slash command `/add-mcp` in the Warp prompt and paste the standard config from above.

### Windsurf

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.
