/**
 * ============================================================================
 * MCP TOOL SCHEMA COMPATIBILITY VALIDATOR
 * ============================================================================
 *
 * MCP clients (VS Code / Copilot, Kiro, Antigravity / Gemini, etc.) each ship
 * their own JSON Schema parser. The strictest of these — notably the
 * Gemini/Vertex AI tool parser used by Antigravity — will crash or refuse to
 * initialize if schemas contain unsupported patterns. By validating against
 * the strictest common denominator we guarantee compatibility across all
 * known MCP clients.
 *
 * This test validates all exported MCP tool definitions to ensure they are
 * fully compatible with every client.
 *
 * ============================================================================
 * STRICT SCHEMA RULES (required by Antigravity/Gemini, good practice for all)
 * ============================================================================
 *
 * 1. EVERY PROPERTY MUST HAVE A 'TYPE':
 *    - Valid: `property: { type: "string" }`
 *    - Invalid: `property: { description: "something" }`
 *    - The Gemini parser throws a validation error if a property lacks an
 *      explicit `type`.
 *
 * 2. NO ARRAY TYPES IN THE 'TYPE' FIELD:
 *    - Valid: `type: "string"`
 *    - Invalid: `type: ["string", "null"]`
 *    - Invalid: `type: ["object", "null"]`
 *    - The Gemini API strictly expects a single string value for `type`.
 *      Arrays will cause an unhandled exception during tool registration,
 *      crashing the agent.
 *
 * 3. NO EMPTY STRINGS IN ENUMS:
 *    - Valid: `enum: ["chrome", "edge"]`
 *    - Invalid: `enum: ["", "chrome", "edge"]`
 *    - The parser rejects empty strings `""` within an enum array. If you
 *      need an optional field, omit the enum and rely on the description,
 *      or use a default value keyword.
 *
 * 4. ITEMS MUST BE AN OBJECT SCHEMA, NOT AN ARRAY OF SCHEMAS:
 *    - Valid: `items: { type: "object", properties: { ... } }`
 *    - Invalid: `items: [{ type: "string" }]`
 *
 * 5. OPTIONAL ENUM PROPERTIES MUST HAVE A DEFAULT VALUE:
 *    - Valid: `direction: { type: "string", enum: ["back", "forward"], default: "back" }`
 *    - Valid: (property is listed in `required`)
 *    - Invalid: `browser: { type: "string", enum: ["chrome", "edge"] }` (optional, no default)
 *    - The Gemini function-calling API cannot resolve the ambiguity of an
 *      optional parameter constrained to specific enum values with no
 *      default. This crashes Antigravity during tool registration.
 *
 * ============================================================================
 */

import assert from 'assert';

// Import all tool definitions directly — mirrors src/mcp-browser.js imports
import { ACCEPT_EULA_TOOL } from '../src/actions/accept-eula.js';
import { FETCH_WEBPAGE_TOOL } from '../src/actions/fetch-page.js';
import { CLICK_ELEMENT_TOOL } from '../src/actions/click-element.js';
import { TYPE_TEXT_TOOL } from '../src/actions/type-text.js';
import { CLOSE_TAB_TOOL } from '../src/actions/close-tab.js';
import { GET_CURRENT_HTML_TOOL } from '../src/actions/get-current-html.js';
import { TAKE_SCREENSHOT_TOOL } from '../src/actions/take-screenshot.js';
import { SCROLL_PAGE_TOOL } from '../src/actions/scroll-page.js';
import { EXECUTE_JAVASCRIPT_TOOL } from '../src/actions/execute-javascript.js';
import { NAVIGATE_HISTORY_TOOL } from '../src/actions/navigate-history.js';
import { DETECT_FORMS_TOOL } from '../src/actions/detect-forms.js';
import { PLUGIN_ACTION_TOOL } from '../src/actions/plugin-action.js';
import { PLUGIN_INFO_TOOL } from '../src/actions/plugin-info.js';

const ALL_TOOLS = [
  ACCEPT_EULA_TOOL,
  FETCH_WEBPAGE_TOOL,
  CLICK_ELEMENT_TOOL,
  TYPE_TEXT_TOOL,
  CLOSE_TAB_TOOL,
  GET_CURRENT_HTML_TOOL,
  TAKE_SCREENSHOT_TOOL,
  SCROLL_PAGE_TOOL,
  EXECUTE_JAVASCRIPT_TOOL,
  NAVIGATE_HISTORY_TOOL,
  DETECT_FORMS_TOOL,
  PLUGIN_ACTION_TOOL,
  PLUGIN_INFO_TOOL,
];

console.log('🧪 Testing MCP Tool Schema Compatibility\n');

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  return new Promise((resolve) => {
    fn()
      .then(() => {
        console.log(`✅ ${description}`);
        testsPassed++;
        resolve();
      })
      .catch((err) => {
        console.log(`❌ ${description}`);
        console.log(`   Error: ${err.message}`);
        testsFailed++;
        resolve();
      });
  });
}

/**
 * Recursively validates a JSON Schema object against Antigravity rules.
 */
function validateSchema(schema, currentPath = 'root') {
  const issues = [];
  if (!schema) return issues;

  if (schema.type === 'object' && schema.properties) {
    const requiredProps = schema.required || [];
    for (const [key, value] of Object.entries(schema.properties)) {
      if (!value.type) {
        issues.push(`${currentPath}.${key} is missing 'type'`);
      } else if (Array.isArray(value.type)) {
        issues.push(`${currentPath}.${key} uses array type: ${JSON.stringify(value.type)}`);
      }

      if (value.enum && value.enum.includes('')) {
        issues.push(`${currentPath}.${key} enum contains an empty string`);
      }

      if (value.enum && !requiredProps.includes(key) && value.default === undefined) {
        issues.push(`${currentPath}.${key} has enum but is optional with no default (crashes Antigravity)`);
      }

      if (value.type === 'array' && value.items) {
        if (Array.isArray(value.items)) {
          issues.push(`${currentPath}.${key} items is an array of schemas`);
        } else {
          issues.push(...validateSchema(value.items, `${currentPath}.${key}.items`));
        }
      }

      if (value.type === 'object') {
        issues.push(...validateSchema(value, `${currentPath}.${key}`));
      }
    }
  }
  return issues;
}

// ============================================================================
// Antigravity Schema Compatibility Tests
// ============================================================================

console.log('📋 Validating tool schemas for cross-client compatibility\n');

for (const tool of ALL_TOOLS) {
  await test(`${tool.name} inputSchema is Antigravity-compatible`, async () => {
    const issues = validateSchema(tool.inputSchema, 'inputSchema');
    assert.deepStrictEqual(issues, [], `Input schema issues:\n  - ${issues.join('\n  - ')}`);
  });

  if (tool.outputSchema) {
    await test(`${tool.name} outputSchema is Antigravity-compatible`, async () => {
      const issues = validateSchema(tool.outputSchema, 'outputSchema');
      assert.deepStrictEqual(issues, [], `Output schema issues:\n  - ${issues.join('\n  - ')}`);
    });
  }
}

await test('Every tool has a name and inputSchema', async () => {
  for (const tool of ALL_TOOLS) {
    assert.ok(tool.name, 'Tool must have a name');
    assert.ok(tool.inputSchema, `${tool.name} must have an inputSchema`);
    assert.strictEqual(tool.inputSchema.type, 'object', `${tool.name} inputSchema.type must be "object"`);
  }
});

// ============================================================================
// Summary
// ============================================================================

console.log(`\n${'='.repeat(50)}`);
console.log(`Tests: ${testsPassed} passed, ${testsFailed} failed`);
console.log('='.repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
