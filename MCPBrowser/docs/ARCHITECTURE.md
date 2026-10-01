# MCPBrowser Architecture

## Overview

MCPBrowser follows a **co-location architecture** where everything related to a specific tool is kept in one place. This eliminates duplication and makes the codebase easier to maintain.

## File Structure

```
MCPBrowser/
├── src/
│   ├── mcp-browser.js           # Main entry point (assembles tools)
│   ├── core/
│   │   ├── actions.js           # Action, CoreAction, and PluginAction contracts
│   │   ├── responses.js         # Base response classes (MCPResponse, ErrorResponse)
│   │   ├── browser.js           # Browser lifecycle management
│   │   ├── page.js              # Page operations
│   │   ├── auth.js              # Authentication flow handling
│   │   └── html.js              # HTML processing
│   └── actions/
│       ├── index.js             # Complete ACTIONS array
│       ├── fetch-page.js        # One exported CoreAction descriptor
│       ├── click-element.js     # One exported CoreAction descriptor
│       └── ...                  # One file per action
```

## Architecture Principles

### 1. Co-location

Each action file contains **everything** related to that tool but exposes exactly one descriptor:

- ✅ Private response class
- ✅ Private MCP tool definition with inline schemas
- ✅ Private action handler
- ✅ One exported `CoreAction` or `PluginAction`
- ✅ Optional CLI metadata on `CoreAction`

**Benefits:**

- Single source of truth
- One stable module boundary
- No duplication
- Easy to maintain
- Clear ownership
- Minimal constants - schemas inlined where used

### 2. Single Source of Truth

**Problem we solved:**

- Before: Tool definitions in `mcp-browser.js`, response classes in `responses.js`, schemas duplicated
- Result: Changes required edits in multiple files

**Solution:**

- Each action file defines and exports one action descriptor
- Each `actions/index.js` exports the folder's complete `ACTIONS` array
- Production consumers use the folder index rather than individual action files
- Tests select actions by immutable `action.id` and inspect `tool`, `response`, or `handler`

### 3. Type Safety

**Response Class Hierarchy:**

```
MCPResponse (base)
├── ErrorResponse (shared by all tools)
├── InformationalResponse (soft failures)
├── FetchPageSuccessResponse
├── ClickElementSuccessResponse
├── TypeTextSuccessResponse
├── CloseTabSuccessResponse
├── GetCurrentHtmlSuccessResponse
└── TakeScreenshotSuccessResponse
```

**Benefits:**

- Runtime validation of all fields
- Type errors caught at response creation time
- IDE autocomplete and type hints
- Self-documenting code

## Example: Adding a New Tool

To add a new tool, create one file `src/actions/my-tool.js`:

```javascript
import { CoreAction } from '../core/actions.js';
import { MCPResponse, ErrorResponse } from '../core/responses.js';

class MyToolSuccessResponse extends MCPResponse {
  constructor(result, nextSteps) {
    super(nextSteps);
    if (typeof result !== 'string') throw new TypeError('result must be a string');
    this.result = result;
  }

  _getAdditionalFields() {
    return { result: this.result };
  }
}

const MY_TOOL = {
  name: 'my_tool',
  description: 'Description of what this tool does',
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' },
    },
    required: ['input'],
  },
  outputSchema: {
    type: 'object',
    properties: {
      result: { type: 'string', description: 'The result' },
      nextSteps: { type: 'array', items: { type: 'string' } },
    },
    required: ['result', 'nextSteps'],
  },
  annotations: {
    title: 'My Tool',
  },
};

async function myTool({ input }) {
  try {
    const result = doSomething(input);
    return new MyToolSuccessResponse(result, ['Suggested next action']);
  } catch (err) {
    return new ErrorResponse(err.message, ['Recovery step']);
  }
}

export const MY_TOOL_ACTION = new CoreAction({
  tool: MY_TOOL,
  response: MyToolSuccessResponse,
  handler: myTool,
});
```

Then add the descriptor to `src/actions/index.js`:

```javascript
import { MY_TOOL_ACTION } from './my-tool.js';

export const ACTIONS = [
  // ...existing actions
  MY_TOOL_ACTION,
];
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

- Everything in one action file behind one exported descriptor
- Folder indexes provide complete action arrays
- `mcp-browser.js` derives registration and dispatch from the core array
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
const response = { currentUrl: 123 }; // Wrong type, no error

// Response class - immediate validation
new FetchPageSuccessResponse(123, 'html', []);
// ❌ TypeError: currentUrl must be a string
```

### Why separate `MCPResponse` base class?

- Shared validation logic (success, nextSteps)
- Consistent structure across all tools
- Easy to add new common fields
- Error responses shared by all tools

## Request Queue System

MCPBrowser uses a **simple sequential queue** for processing requests:

- **No locks** - Locks lead to deadlocks. Instead, use a simple FIFO queue.
- **One URL at a time** - Process sequentially to avoid race conditions
- **Tab reuse per domain** - Multiple hostnames can share one tab (e.g., gmail.com → mail.google.com)

```
Queue: [url1(eng.ms), url2(eng.ms), url3(dev.azure)]

Processing (sequential):
1. url1(eng.ms)    → NEW tab      → load → done
2. url2(eng.ms)    → REUSE tab    → load → done
3. url3(dev.azure) → NEW tab      → load → done

Result: 2 tabs (one per unique host)
```

**Key files:**

- `page.js` - Queue implementation (`queueRequest()`, `processQueue()`)
- `browser.js` - Tab management (`domainPages` Map)
- `fetch-page.js` - Uses queue via `queueRequest()`

## Future Improvements

Potential enhancements:

- [ ] Generate TypeScript definitions from response classes
- [ ] Add schema validation against actual responses
- [ ] Create schema documentation generator
- [ ] Add performance benchmarks per tool
