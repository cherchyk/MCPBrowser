# Contract: `plugin_action` MCP Tool

**Feature**: 002-site-plugins

## Tool Definition

```javascript
{
  name: "plugin_action",
  title: "Plugin Action",
  description: "Execute a site-specific plugin action. Use plugin_info first to discover available actions and their parameters. Plugins provide specialized automation for UI-heavy websites like Gmail, Outlook, PowerBI, AWS, and Azure — faster and more reliable than generic DOM interaction.",
  inputSchema: {
    type: "object",
    properties: {
      plugin: {
        type: "string",
        description: "Plugin name (e.g., 'gmail', 'outlook', 'powerbi')"
      },
      action: {
        type: "string",
        description: "Action name within the plugin (e.g., 'list_emails', 'extract_grid')"
      },
      params: {
        type: "object",
        description: "Action parameters. Use plugin_info to discover accepted parameters.",
        additionalProperties: true
      }
    },
    required: ["plugin", "action"],
    additionalProperties: false
  },
  outputSchema: {
    type: "object",
    properties: {
      nextSteps: {
        type: "array",
        items: { type: "string" },
        description: "Suggested next actions"
      }
    },
    required: ["nextSteps"],
    additionalProperties: true
  }
}
```

## Behavior

### Success Path

1. Look up `plugin` in loaded plugins map
2. Find `action` in plugin's action list
3. Get active browser page for the plugin's target domain
4. Call `action.execute({ page, params })`
5. Return the action's response (MCPResponse subclass)

### Error: Unknown Plugin

```javascript
{
  isError: true,
  content: [{ type: "text", text: "Unknown plugin: 'foo'. Available plugins: gmail, outlook, powerbi" }]
}
```

### Error: Unknown Action

```javascript
{
  isError: true,
  content: [{ type: "text", text: "Unknown action 'foo' for plugin 'gmail'. Available actions: list_emails, read_email, compose_email" }]
}
```

### Error: Wrong Page Context

When the browser's active page does not match the plugin's target site:

```javascript
{
  isError: true,
  content: [{ type: "text", text: "Plugin 'gmail' requires mail.google.com but current page is bing.com. Use fetch_webpage to navigate to the correct site first." }]
}
```

### Error: Action Execution Failure

```javascript
{
  isError: true,
  content: [{ type: "text", text: "Plugin 'gmail' action 'list_emails' failed: Element not found. The site structure may have changed. You can fall back to generic MCPBrowser tools (click_element, get_current_html)." }]
}
```
