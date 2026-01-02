# MCPBrowser Architecture

## Overview

MCPBrowser follows a **co-location architecture** where everything related to a specific tool is kept in one place. This eliminates duplication and makes the codebase easier to maintain.

## File Structure

```
MCPBrowser/
├── src/
│   ├── mcp-browser.js           # Main entry point (assembles tools)
│   ├── core/
│   │   ├── responses.js         # Base response classes (MCPResponse, ErrorResponse)
│   │   ├── browser.js           # Browser lifecycle management
│   │   ├── page.js              # Page operations
│   │   ├── auth.js              # Authentication flow handling
│   │   └── html.js              # HTML processing
│   └── actions/
│       ├── fetch-page.js        # Fetch page action + tool definition + response classes
│       ├── click-element.js     # Click action + tool definition + response classes
│       ├── type-text.js         # Type action + tool definition + response classes
│       ├── close-tab.js         # Close action + tool definition + response classes
│       └── get-current-html.js  # Get HTML action + tool definition + response classes
```

## Architecture Principles

### 1. Co-location
Each action file contains **everything** related to that tool:
- ✅ Response class (success response for this specific tool)
- ✅ Tool definition (MCP tool descriptor with inline schemas)
- ✅ Action function (implementation)

**Benefits:**
- Single source of truth
- No duplication
- Easy to maintain
- Clear ownership
- Minimal constants - schemas inlined where used

### 2. Single Source of Truth

**Problem we solved:**
- Before: Tool definitions in `mcp-browser.js`, response classes in `responses.js`, schemas duplicated
- Result: Changes required edits in multiple files

**Solution:**
- Each action file defines its own structure
- `mcp-browser.js` simply imports and assembles
- Schemas are derived from response classes

### 3. Type Safety

**Response Class Hierarchy:**
```
MCPResponse (base)
├── ErrorResponse (shared by all tools)
├── FetchPageSuccessResponse
├── ClickElementSuccessResponse
├── TypeTextSuccessResponse
├── CloseTabSuccessResponse
└── GetCurrentHtmlSuccessResponse
```

**Benefits:**
- Runtime validation of all fields
- Type errors caught at response creation time
- IDE autocomplete and type hints
- Self-documenting code

## Example: Adding a New Tool

To add a new tool, create one file `src/actions/my-tool.js`:

```javascript
import { MCPResponse, ErrorResponse, ERROR_RESPONSE_SCHEMA } from '../core/responses.js';

// ============================================================================
// RESPONSE CLASS
// ============================================================================

export class MyToolSuccessResponse extends MCPResponse {
  constructor(result, nextSteps) {
    super(true, nextSteps);
    if (typeof result !== 'string') throw new TypeError('result must be a string');
    this.result = result;
  }
  
  _getAdditionalFields() {
    return { result: this.result };
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const MY_TOOL = {
  name: "my_tool",
  description: "Description of what this tool does",
  inputSchema: {
    type: "object",
    properties: {
      input: { type: "string", description: "Input parameter" }
    },
    required: ["input"]
  },
  outputSchema: {
    oneOf: [
      {
        type: "object",
        properties: {
          success: { type: "boolean", const: true },
          result: { type: "string", description: "The result" },
          nextSteps: { type: "array", items: { type: "string" } }
        },
        required: ["success", "result", "nextSteps"]
      },
      ERROR_RESPONSE_SCHEMA
    ]
  },
  annotations: {
    title: "My Tool"
  }
};

// ============================================================================
// ACTION FUNCTION
// ============================================================================

export async function myTool({ input }) {
  try {
    // Implementation here
    const result = doSomething(input);
    
    return new MyToolSuccessResponse(
      result,
      ["Suggested next action"]
    );
  } catch (err) {
    return new ErrorResponse(
      err.message,
      ["Recovery step"]
    );
  }
}
```

Then add to `mcp-browser.js`:

```javascript
import { myTool, MY_TOOL } from './actions/my-tool.js';

const tools = [
  // ...existing tools
  MY_TOOL
];

// In switch statement:
case "my_tool":
  result = await myTool(safeArgs);
  break;
```

## MCP Compliance

### Output Schema (MCP 2025-11-25)

Each tool defines an `outputSchema` that describes what it returns:

```javascript
{
  oneOf: [
    // Success response schema
    { type: "object", properties: { ... } },
    // Error response schema  
    { type: "object", properties: { ... } }
  ]
}
```

**Benefits:**
- Clients can validate responses
- LLMs understand output structure better
- Better documentation and developer experience
- Strict schema validation of responses

### Response Format

All tools return:
```javascript
{
  content: [{ type: "text", text: "Human-readable summary" }],
  isError: boolean,
  structuredContent: { /* Full structured data */ }
}
```

**Why this format?**
- `content`: Human-readable summary for display
- `isError`: Quick error checking
- `structuredContent`: Machine-parseable data for LLMs

## Testing

Tests are organized to match the architecture:

```
tests/
├── core/
│   ├── browser.test.js          # Browser tests
│   ├── html.test.js             # HTML processing tests
│   ├── page.test.js             # Page operation tests
│   └── responses.test.js        # Response class tests
├── actions/
│   ├── fetch-page.test.js       # Fetch action tests
│   ├── click-element.test.js    # Click action tests
│   └── ...
├── demo-type-safety.js          # Type safety demonstration
├── verify-structured-output.test.js  # MCP format compliance
└── verify-nextsteps.test.js     # NextSteps field verification
```

## Key Design Decisions

### Why co-location?

**Before:**
- Tool definition in `mcp-browser.js` (80+ lines per tool)
- Response classes in `responses.js`
- Schemas duplicated in both places
- Changes required editing 2-3 files

**After:**
- Everything in one action file
- `mcp-browser.js` is just 20 lines (imports + assembly)
- One place to change when updating a tool
- Clear single source of truth

### Why response classes instead of plain objects?

**Benefits of classes:**
1. Type validation at creation time (catches bugs early)
2. IDE autocomplete and type hints
3. Self-documenting through TypeScript-like constructors
4. Consistent structure enforcement
5. Better error messages

**Example:**
```javascript
// Plain object - no validation
const response = { currentUrl: 123 };  // Wrong type, no error

// Response class - immediate validation
new FetchPageSuccessResponse(123, "html", []);  
// ❌ TypeError: currentUrl must be a string
```

### Why separate `MCPResponse` base class?

- Shared validation logic (success, nextSteps)
- Consistent structure across all tools
- Easy to add new common fields
- Error responses shared by all tools

## Future Improvements

Potential enhancements:
- [ ] Generate TypeScript definitions from response classes
- [ ] Add schema validation against actual responses
- [ ] Create schema documentation generator
- [ ] Add performance benchmarks per tool
