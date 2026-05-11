# Feature Specification: Site-Specific Plugin Mechanism

**Feature Branch**: `002-site-plugins`  
**Created**: 2026-04-02  
**Status**: Draft  
**Input**: User description: "Add plugin mechanism for MCPBrowser to support site-specific navigation, content extraction, and dedicated tools for UI-heavy websites like Gmail, Outlook, PowerBI, AWS, and Azure"

## Clarifications

### Session 2026-04-02

- Q: Should plugin tools always appear in the MCP tool listing, or only after detection? → A: Option B with dispatch — two universal tools (`browser_plugin_action`, `browser_plugin_info`) are always visible. Plugin-specific actions are never individually registered. Detection tells the agent which plugin matched; `browser_plugin_info` provides full action catalog on demand; `browser_plugin_action` dispatches to the plugin. Flow: `browser_fetch_webpage` → detection → nextSteps says "Gmail plugin available, use `browser_plugin_info`" → `browser_plugin_info({ plugin: 'gmail' })` → full action catalog → `browser_plugin_action({ plugin: 'gmail', action: 'list_emails', params: { folder: 'inbox' } })`.
- Q: Where should the enabled plugins registry be maintained? → A: A dedicated plugin registry file in the MCPBrowser root (e.g., `plugins.json` or `plugin-registry.js`). Not in `server.json` (different purpose) and not auto-discovery (performance concern with many folders).
- Q: How should plugin site knowledge reach the AI agent? → A: Included in `browser_plugin_info` response alongside the action catalog. Site knowledge is high-level context only (what the plugin can do, target pages, auth flow expectations). Detailed implementation knowledge like DOM selectors and JavaScript is hidden inside plugin action implementations — the agent never sees it.
- Q: What happens when `browser_plugin_action` is called but the browser is on a different site? → A: Error with guidance — the plugin returns a clear error stating which site it requires and instructs the agent to use `browser_fetch_webpage` to navigate first. No auto-navigation (avoids losing form data or session state on the current page).
- Q: How should the system handle plugins built against an older interface version? → A: Version in manifest — each plugin declares the interface version it implements. The core validates compatibility at load time; incompatible plugins are skipped with a warning log. Prevents cryptic runtime errors and makes upgrade paths clear.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Plugin Detection on Page Fetch (Priority: P1)

When an AI agent fetches a web page using MCPBrowser, the system automatically detects whether any installed plugin recognizes the current page. If a matching plugin is found, the response includes a recommendation to the agent that a specialized plugin is available, along with the plugin's dedicated tools. This enables the agent to switch from generic DOM interaction to precise, plugin-driven automation.

**Why this priority**: This is the foundational mechanism that makes plugins useful. Without detection, no plugin can ever be activated. It also establishes the plugin interface contract that all future plugins must implement.

**Independent Test**: Can be tested by installing a stub plugin that matches a known URL pattern, fetching that URL, and verifying the response includes the plugin recommendation.

**Acceptance Scenarios**:

1. **Given** a plugin is installed for Gmail (matching `mail.google.com`), **When** the agent fetches `https://mail.google.com/`, **Then** the response includes a recommendation indicating the Gmail plugin is available and lists its dedicated tools.
2. **Given** no plugin matches the current page URL or DOM, **When** the agent fetches any page, **Then** the response contains no plugin recommendation and standard next steps are returned as before.
3. **Given** multiple plugins are installed, **When** the agent fetches a page that matches exactly one plugin, **Then** only that matching plugin is recommended.
4. **Given** a plugin is installed for PowerBI grids, **When** the agent fetches a page that is not a PowerBI URL but contains PowerBI embedded grid elements in its DOM, **Then** the PowerBI plugin is recommended based on DOM content detection.

---

### User Story 2 - Plugin Dispatch Tools (Priority: P1)

The system exposes exactly two universal plugin tools — `browser_plugin_action` and `browser_plugin_info` — that are always visible in the MCP tool listing regardless of which plugins are installed. Plugin-specific actions are never individually registered as MCP tools. Instead, each plugin declares its actions internally, and the agent discovers them through detection recommendations and `browser_plugin_info`. The agent then invokes any plugin action through `browser_plugin_action`, which dispatches to the correct plugin via the interface. This keeps the tool list fixed at a constant size even with 50+ plugins installed.

**Why this priority**: Without the dispatch mechanism, tool count would grow linearly with plugins (10 per Gmail + 10 Outlook + 30 PowerBI + 40 Azure = 90 extra tools). The dispatch pair keeps the agent's tool list manageable while providing full access to all plugin capabilities.

**Independent Test**: Can be tested by installing a plugin, calling `browser_plugin_info` to retrieve its action catalog, then calling `browser_plugin_action` to execute an action and verifying the result.

**Acceptance Scenarios**:

1. **Given** a Gmail plugin is installed with actions `list_emails`, `read_email`, `compose_email`, **When** the agent requests the list of available MCP tools, **Then** only `browser_plugin_action` and `browser_plugin_info` appear (not individual Gmail actions). The tool count remains constant.
2. **Given** the agent calls `browser_plugin_info({ plugin: "gmail" })`, **When** the plugin is loaded, **Then** the response lists all available actions with their parameters, types, defaults, and descriptions.
3. **Given** the agent calls `browser_plugin_action({ plugin: "gmail", action: "list_emails", params: { folder: "inbox", limit: 20 } })`, **When** the plugin executes, **Then** it runs site-specific JavaScript on the active Gmail tab and returns structured email data (sender, subject, date, snippet).
4. **Given** the agent calls `browser_plugin_action` with a plugin name that is not loaded, **When** the dispatch runs, **Then** it returns a clear error listing available plugins.
5. **Given** the agent calls `browser_plugin_action` referencing a valid plugin but an invalid action name, **When** the dispatch runs, **Then** it returns a clear error listing valid actions for that plugin.

---

### User Story 3 - Plugin Registry and Zero-Change Extensibility (Priority: P1)

The system maintains a registry (an array/list) of enabled plugins. To add a new plugin, a developer creates a plugin folder in `plugins/<pluginName>/` implementing the standard plugin interface, and adds it to the enabled plugins list. The core system reads this list at startup, loads each plugin through the plugin interface, registers its tools, and wires up detection — all without any changes to core MCPBrowser code. The core never contains plugin-specific logic; it only knows how to iterate the registry and call interface methods.

**Why this priority**: This is the architectural foundation that ensures the system scales to dozens of plugins (Gmail, Outlook, PowerBI, AWS, Azure, and beyond) without core code becoming a bottleneck. Every new plugin is just a new entry in the registry, not a code change.

**Independent Test**: Can be tested by creating a new plugin folder with a valid implementation, adding it to the enabled plugins list, restarting the server, and verifying the plugin is loaded and its tools are available — with zero lines of core code changed.

**Acceptance Scenarios**:

1. **Given** a plugin folder `plugins/gmail/` exists with a valid implementation of the plugin interface, and it is listed in the enabled plugins registry, **When** the MCPBrowser server starts, **Then** the plugin is loaded via the interface, and its tools are registered.
2. **Given** the enabled plugins list references a plugin whose folder has an invalid manifest (missing required fields), **When** the server starts, **Then** the invalid plugin is skipped with a warning log and all other plugins load normally.
3. **Given** the enabled plugins list is empty or the `plugins/` directory does not exist, **When** the server starts, **Then** it operates normally with only the standard built-in tools.
4. **Given** a developer creates a brand-new plugin (e.g., `plugins/azure/`) implementing the plugin interface, **When** they add it to the enabled plugins list and restart the server, **Then** the new plugin's tools appear and its detection works — with zero modifications to any file outside the `plugins/` folder and the enabled plugins list.

---

### User Story 4 - Plugin Recommendation in Tool Responses (Priority: P2)

When a standard MCPBrowser tool (browser_fetch_webpage, browser_get_current_html, browser_click_element, etc.) returns a response for a page that matches an installed plugin, the `nextSteps` in the response are augmented with plugin-specific recommendations. These recommendations guide the agent to call `browser_plugin_info` for details and then use `browser_plugin_action` to interact with the site, instead of generic DOM manipulation. Detection provides a summary of the plugin's top actions; `browser_plugin_info` provides the full catalog on demand.

**Why this priority**: This is the communication channel between the plugin system and the AI agent. It leverages MCPBrowser's existing `nextSteps` pattern to naturally inform the agent about better options available through plugins, and directs the agent through the dispatch flow.

**Independent Test**: Can be tested by fetching a page that matches a plugin and verifying the `nextSteps` array contains plugin-specific guidance referencing `browser_plugin_info` and `browser_plugin_action`.

**Acceptance Scenarios**:

1. **Given** a Gmail plugin is installed and the agent has fetched `mail.google.com`, **When** the fetch response is returned, **Then** `nextSteps` includes the plugin name, a summary of top actions (e.g., list_emails, read_email), and guidance to call `browser_plugin_info({ plugin: 'gmail' })` for the full action catalog.
2. **Given** a PowerBI plugin is installed and the agent fetches a page with embedded PowerBI grids, **When** the response is returned, **Then** `nextSteps` includes guidance to use `browser_plugin_action({ plugin: 'powerbi', action: 'extract_grid' })` for reliable grid data extraction.
3. **Given** the agent uses `browser_get_current_html` on a page matching a plugin, **When** the response is returned, **Then** the same plugin recommendations appear in `nextSteps`.
4. **Given** a plugin has 30+ actions (e.g., PowerBI), **When** detection triggers, **Then** `nextSteps` includes only the top 3-5 most relevant actions as a summary, with a pointer to `browser_plugin_info` for the complete list.

---

### User Story 5 - Plugin Access to Browser Context (Priority: P2)

Plugins have access to the active browser page object so they can execute JavaScript, read DOM, interact with elements, and leverage the existing MCPBrowser browser management infrastructure. Plugins do not manage their own browser connections.

**Why this priority**: Plugins need to interact with the page to be useful, but they should not duplicate the browser management that MCPBrowser already handles well.

**Independent Test**: Can be tested by creating a plugin tool that executes JavaScript on the page and verifying it can read and modify the DOM on the active page.

**Acceptance Scenarios**:

1. **Given** a plugin tool is invoked, **When** the tool implementation needs to interact with the page, **Then** it receives the active browser page object for the matching domain.
2. **Given** the agent has not yet navigated to the plugin's target page, **When** a plugin tool is called, **Then** the plugin returns an error stating which site it requires, and the agent can then use `browser_fetch_webpage` to navigate there. The plugin itself MUST NOT auto-navigate.
3. **Given** a plugin executes JavaScript on the page, **When** the script fails (e.g., element not found), **Then** the error is caught and returned as a structured error response consistent with MCPBrowser's error format.

---

### User Story 6 - Plugin Provides High-Level Site Context (Priority: P3)

Each plugin includes high-level context about the target site — what pages it covers, what authentication flow to expect, what capabilities the plugin offers — delivered as part of the `browser_plugin_info` response. This helps the agent plan its workflow (e.g., "I need to authenticate first, then I can list emails"). Detailed implementation knowledge like DOM selectors and JavaScript extraction logic remains hidden inside plugin action implementations; the agent never sees or needs it.

**Why this priority**: While actions provide execution, high-level context helps the agent plan multi-step workflows without trial-and-error. However, since most domain knowledge is encapsulated inside actions, this is lighter-weight than initially scoped.

**Independent Test**: Can be tested by calling `browser_plugin_info` for a plugin and verifying it returns high-level site context (target pages, auth expectations) alongside the action catalog.

**Acceptance Scenarios**:

1. **Given** a Gmail plugin is installed, **When** the agent calls `browser_plugin_info({ plugin: "gmail" })`, **Then** the response includes high-level context: target site URL patterns, authentication flow description (e.g., "Google SSO, wait for redirect back to mail.google.com"), and the action catalog.
2. **Given** an Outlook plugin is installed, **When** the agent calls `browser_plugin_info({ plugin: "outlook" })`, **Then** the response describes Microsoft SSO expectations and available actions — but does not expose CSS selectors, XPath expressions, or internal JavaScript.

---

### Edge Cases

- What happens when two plugins both claim to match the same page URL and DOM? The system returns recommendations for all matching plugins, allowing the agent to choose the most appropriate one.
- What happens when a plugin's JavaScript fails due to the site changing its DOM structure? The plugin tool returns a structured error with the failure details, and the agent can fall back to generic MCPBrowser tools.
- What happens when a plugin is installed but its target site requires authentication the user hasn't completed? The plugin tool delegates to MCPBrowser's existing authentication flow and informs the agent that authentication is needed first.
- What happens when the `plugins/` folder contains non-plugin files or folders? The discovery mechanism only loads folders that contain a valid plugin manifest; all others are silently ignored.
- What happens when a plugin tool is called but the browser tab has navigated away from the plugin's target site? The plugin returns an error stating which site it requires and instructs the agent to use `browser_fetch_webpage` to navigate first. Plugins MUST NOT auto-navigate to avoid losing form data or session state on the current page.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define a standard plugin interface that all plugins implement, including: a detection function, tool definitions, and a site knowledge descriptor. The core system MUST interact with plugins exclusively through this interface — never through plugin-specific logic.
- **FR-002**: System MUST maintain a registry (enabled plugins list) in a dedicated plugin registry file in the MCPBrowser root. At startup, the core reads this file and loads each plugin from its `plugins/<pluginName>/` directory through the plugin interface. The registry file is separate from `server.json`.
- **FR-002a**: Adding a new plugin MUST require only two actions: (1) creating the plugin folder with interface-compliant files, and (2) adding the plugin to the enabled plugins list. No core source files may be modified.
- **FR-003**: Each plugin MUST provide a detection function (e.g., `matchesPage(url, html)`) that accepts the current page URL and the page HTML, and returns an object indicating whether the plugin is applicable and optionally a confidence score (see data-model.md MatchResult).
- **FR-004**: System MUST call each plugin's detection function after page fetch and HTML extraction operations, and include matching plugin recommendations in the response's `nextSteps` array.
- **FR-005**: System MUST expose exactly two universal plugin tools — `browser_plugin_action` (dispatches to a plugin action) and `browser_plugin_info` (returns a plugin's action catalog). Plugin-specific actions MUST NOT be individually registered as MCP tools.
- **FR-005a**: `browser_plugin_action` MUST accept plugin name, action name, and action parameters, dispatch to the correct plugin through the interface, and return the result.
- **FR-005b**: `browser_plugin_info` MUST accept a plugin name and optionally an action name, and return the full action catalog (or single action details) with parameter names, types, defaults, and descriptions, plus high-level site context (target pages, auth flow description). It MUST NOT expose internal implementation details like DOM selectors or JavaScript code.
- **FR-006**: Plugin action implementations MUST receive access to the active browser page object for the relevant domain, using MCPBrowser's existing browser management.
- **FR-007**: Plugin action implementations MUST return responses that conform to MCPBrowser's existing response class hierarchy (extending MCPResponse or returning ErrorResponse).
- **FR-008**: System MUST continue to function normally when no plugins are installed (zero plugins is a valid state).
- **FR-009**: System MUST log a warning and skip any plugin that fails to load (invalid manifest, missing entry point, runtime errors during initialization) without affecting other plugins or core functionality.
- **FR-010**: Each plugin MUST declare a manifest with at minimum: plugin name, version, description, target site patterns, and plugin interface version. The core MUST validate the declared interface version at load time and skip incompatible plugins with a warning log.
- **FR-011**: Plugin detection MUST support both URL pattern matching (for site-specific plugins like Gmail) and DOM content detection (for embeddable content plugins like PowerBI grids).
- **FR-012**: System MUST provide plugin recommendations in responses from all page-content-returning tools (browser_fetch_webpage, browser_get_current_html, browser_execute_javascript, browser_click_element). Recommendations MUST reference `browser_plugin_info` and `browser_plugin_action` as the mechanism, not individual tool names.
- **FR-013**: Each plugin MUST provide recommended `nextSteps` text entries that summarize its top 3-5 actions and direct the agent to call `browser_plugin_info` for the full catalog and `browser_plugin_action` to execute.
- **FR-014**: Each plugin MUST use its plugin name as a namespace for action names within the dispatch system to avoid collisions (e.g., plugin "gmail" action "list_emails", plugin "powerbi" action "extract_grid").

### Key Entities

- **Plugin**: A self-contained module representing site-specific automation capabilities. Implements the standard plugin interface. Has a name, version, target site patterns, detection logic, site knowledge, and a set of dedicated tools.
- **Plugin Registry**: A dedicated configuration file in the MCPBrowser root (separate from `server.json`) listing enabled plugin names. The core reads this at startup to determine which plugins to load. The only place outside a plugin folder that needs to change when adding a new plugin.
- **Plugin Interface**: The contract that all plugins must implement. Defines the methods the core calls (detection, tool registration, site knowledge). The core never calls any method not defined in this interface.
- **Plugin Manifest**: A declarative descriptor within each plugin folder that declares the plugin's identity, version, target URL patterns, and entry point. Used for discovery and validation.
- **Plugin Action**: A named operation provided by a plugin (e.g., "list_emails", "extract_grid"), with a description, parameter schema, and an implementation function that operates on the browser page. Actions are not individually registered as MCP tools; they are invoked through the `browser_plugin_action` dispatch tool.
- **Dispatch Tools**: The two universal MCP tools (`browser_plugin_action` and `browser_plugin_info`) that serve as the single entry point for all plugin interactions. The MCP tool count remains constant regardless of how many plugins or actions are installed.
- **Plugin Detection Result**: The outcome of running all plugins' detection functions against a page, containing the list of matching plugins and their recommended next steps (referencing `browser_plugin_info` and `browser_plugin_action`).
- **Site Knowledge**: High-level context within a plugin describing what pages the plugin covers, authentication flow expectations, and plugin capabilities. Exposed via `browser_plugin_info`. Does not include internal implementation details (DOM selectors, JavaScript) which remain hidden inside action implementations.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new plugin can be added by creating a folder in `plugins/<name>/` and adding it to the enabled plugins list, without modifying any core MCPBrowser source files. The system scales to 50+ plugins with this same pattern.
- **SC-002**: Plugin detection adds less than 100ms overhead to page fetch operations when up to 10 plugins are installed.
- **SC-003**: The AI agent receives plugin tool recommendations within the same response as the page content, requiring zero additional round-trips.
- **SC-004**: Plugin tools for a target site extract data at least 5x faster than equivalent multi-step generic DOM scraping approaches.
- **SC-005**: All existing MCPBrowser tests continue to pass with zero plugins installed (full backward compatibility).
- **SC-006**: A developer with knowledge of a target site can create a working plugin within 1 hour using documentation and examples.
- **SC-007**: 100% of plugin tools return responses conforming to MCPBrowser's response format, verifiable by existing response class validation.

## Assumptions

- Plugins run in the same Node.js process as the MCPBrowser server (no sandboxing or separate process isolation in the initial implementation).
- Plugin authors are trusted developers; the system does not need to sandbox or restrict plugin code execution.
- The Puppeteer Page object API is the interface plugins use to interact with the browser; no additional abstraction layer is needed initially.
- Site-specific JavaScript selectors will need periodic maintenance as target sites update their DOM structure; this is accepted as a plugin maintenance responsibility.
- The `plugins/` directory is located within the MCPBrowser package directory (sibling to `src/`).
- The enabled plugins list lives in a dedicated file in the MCPBrowser root (e.g., `plugins.json`), separate from `server.json` which serves a different purpose (MCP server metadata).
- Plugin detection runs synchronously against URL patterns first and only inspects DOM content when URL matching is inconclusive, to minimize performance overhead.
- The plugin interface is versioned (e.g., `"interfaceVersion": 1`). When the interface evolves, the core checks compatibility at load time and skips incompatible plugins with a clear warning, preventing runtime errors.
- The architecture is designed to scale — the same pattern used for the first plugin (Gmail) works identically for the 50th plugin (any future site) with no architectural changes.
