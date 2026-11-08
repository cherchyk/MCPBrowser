# MCPBrowser for GitHub Copilot

This [Agent Plugins 1.0.0](https://agent-plugins.org/specification) bundle combines the MCPBrowser stdio server with a focused browser workflow skill. It requires Node.js 18+ and a local Chrome, Edge, or Brave browser. The npm server version is pinned to the plugin version; no credentials or hosted service are bundled.

**Privacy:** Browser content is passed to your AI agent and its LLM provider. Review the [privacy note](../README.md) before accessing private websites. The skill preserves user confirmation for consequential actions and directs users to complete login, MFA, and CAPTCHAs themselves.

## Install

After this plugin directory is published to the repository and its pinned npm version is publicly available, install directly with Copilot CLI:

```sh
copilot plugin install cherchyk/MCPBrowser:AgentPlugin
```

For local development, load the directory without persisting an installation:

```powershell
copilot --plugin-dir .\AgentPlugin plugin list --json
```

Start a new Copilot session to use the plugin. Do not configure a second copy of the MCPBrowser server if it is already enabled manually. In the Copilot app, use **Customize > Plugins** to browse available marketplace plugins; this bundle is not listed there until GitHub accepts its submission.

## Prepare a marketplace submission

Run `npm run test:plugin` from the repository root. Before submitting, also run `vally lint` against the plugin directory and perform Copilot's install smoke test in an isolated test profile, as required by the [Awesome Copilot contribution guide](https://github.com/github/awesome-copilot/blob/main/CONTRIBUTING.md#adding-external-plugins). The local contract tests do not replace those review gates.

Once the plugin is published at an immutable commit or release tag, open an [external plugin submission issue](https://github.com/github/awesome-copilot/issues/new?template=external-plugin.yml). Do not open a PR editing `plugins/external.json`.

| Submission field                  | Value                                                                                                                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plugin name                       | `mcpbrowser`                                                                                                                                                                                                                       |
| Short description                 | Use the description from `plugin.json`.                                                                                                                                                                                            |
| GitHub repository                 | `cherchyk/MCPBrowser`                                                                                                                                                                                                              |
| Plugin path inside the repository | `AgentPlugin`                                                                                                                                                                                                                      |
| Ref / commit SHA to review        | A published release tag containing this directory, a full 40-character commit SHA, or both resolving to the same commit. Do not use a branch or an older tag without the plugin.                                                   |
| Version                           | Use `plugin.json.version`; the pinned npm version must already be available.                                                                                                                                                       |
| License identifier                | `MIT`                                                                                                                                                                                                                              |
| Author name / URL                 | `cherchyk` / `https://github.com/cherchyk`                                                                                                                                                                                         |
| Homepage URL                      | `https://github.com/cherchyk/MCPBrowser`                                                                                                                                                                                           |
| Keywords                          | `browser`, `mcp`, `web-automation`, `authentication`, `github-copilot`                                                                                                                                                             |
| Additional notes                  | Local Chromium browser required; stdio npm server, no remote endpoint; usage skill includes authentication handoff, untrusted-content handling, and consequential-action confirmation. Include actual lint and smoke-test results. |

Check the issue's public-repository, immutable-source, policy-compliance, and non-duplicate-listing confirmations only after verifying them. GitHub runs manifest, skill lint, installation, version, and source-consistency checks; a human maintainer must approve the listing. Submission does not guarantee inclusion or placement in Recommended.

## Release maintenance

Keep `plugin.json.version`, the `mcpbrowser@VERSION` argument in `mcp.json`, and the repository's npm/server versions synchronized. The existing version-bump tool updates matching version strings across the repository; `npm run test:plugin` catches drift. Publish the npm version before inviting users to install that plugin release. Registry recovery and GitHub MCP catalog nomination are documented in the [root README](../README.md#mcp-registry-publication).
