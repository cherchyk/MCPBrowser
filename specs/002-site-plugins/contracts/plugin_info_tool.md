# Contract: `plugin_info` MCP Tool

**Feature**: 002-site-plugins

## Tool Definition

```javascript
{
  name: "plugin_info",
  title: "Plugin Info",
  description: "Get information about an installed site plugin — its available actions, parameters, and site context. Call this after a plugin is detected (recommended in nextSteps) to discover what actions you can perform via plugin_action. You can also call with no arguments to list all loaded plugins.",
  inputSchema: {
    type: "object",
    properties: {
      plugin: {
        type: "string",
        description: "Plugin name to get info for. Omit to list all loaded plugins."
      },
      action: {
        type: "string",
        description: "Optional. Specific action name to get detailed info for."
      }
    },
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

### List All Plugins (no `plugin` parameter)

Returns summary of all loaded plugins.

```javascript
{
  plugins: [
    { name: "gmail", description: "Gmail automation", actionCount: 5 },
    { name: "outlook", description: "Outlook automation", actionCount: 8 }
  ],
  nextSteps: [
    "Call plugin_info({ plugin: 'gmail' }) to see Gmail's available actions",
    "Call plugin_info({ plugin: 'outlook' }) to see Outlook's available actions"
  ]
}
```

### Plugin Detail (with `plugin` parameter)

Returns full action catalog + high-level site context.

```javascript
{
  name: "gmail",
  description: "Automate Gmail inbox, email reading, composition, and search",
  targetPages: ["Gmail inbox (mail.google.com)"],
  authFlow: "Google SSO — authenticate via browser, wait for redirect back to mail.google.com",
  actions: [
    {
      name: "list_emails",
      description: "List emails in a folder",
      params: [
        { name: "folder", type: "string", description: "Folder to list", required: false, default: "inbox" },
        { name: "limit", type: "number", description: "Max emails to return", required: false, default: 20 }
      ]
    },
    {
      name: "read_email",
      description: "Read full content of a specific email",
      params: [
        { name: "emailId", type: "string", description: "Email identifier", required: true }
      ]
    }
  ],
  nextSteps: [
    "Use plugin_action({ plugin: 'gmail', action: 'list_emails' }) to list inbox emails",
    "Use fetch_webpage to navigate to mail.google.com first if not already there"
  ]
}
```

### Action Detail (with `plugin` + `action` parameters)

Returns details for a single action.

```javascript
{
  plugin: "gmail",
  action: {
    name: "list_emails",
    description: "List emails in a folder with sender, subject, date, and snippet",
    params: [
      { name: "folder", type: "string", description: "Folder to list (inbox, sent, drafts, trash)", required: false, default: "inbox" },
      { name: "limit", type: "number", description: "Maximum number of emails to return", required: false, default: 20 }
    ]
  },
  nextSteps: [
    "Call plugin_action({ plugin: 'gmail', action: 'list_emails', params: { folder: 'inbox', limit: 10 } })"
  ]
}
```

### Error: Unknown Plugin

```javascript
{
  isError: true,
  content: [{ type: "text", text: "Unknown plugin: 'foo'. Available plugins: gmail, outlook" }]
}
```

### Error: Unknown Action (valid plugin, invalid action)

```javascript
{
  isError: true,
  content: [{ type: "text", text: "Unknown action 'foo' for plugin 'gmail'. Available actions: list_emails, read_email, compose_email" }]
}
```

### No Plugins Loaded

```javascript
{
  plugins: [],
  nextSteps: [
    "No plugins are currently loaded. Add plugin names to plugins.json and restart the server."
  ]
}
```
