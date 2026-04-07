/**
 * _example plugin — Stub plugin for testing and documentation.
 * Implements the full plugin interface contract (interfaceVersion 1).
 * Matches pages on "example.test" domain for unit/integration testing.
 */

import { MCPResponse } from '../../core/responses.js';

// ============================================================================
// MANIFEST
// ============================================================================

export const manifest = {
  name: "_example",
  version: "1.0.0",
  description: "Example stub plugin for testing the MCPBrowser plugin system",
  interfaceVersion: 1,
  urlPatterns: ["example.test"],
  domPatterns: [".example-plugin-marker"]
};

// ============================================================================
// DETECTION
// ============================================================================

/**
 * Detect whether this plugin is applicable for the given page.
 * @param {string} url - Current page URL
 * @param {string} html - Extracted page HTML
 * @returns {{ matched: boolean, confidence?: number }}
 */
export function matchesPage(url, html) {
  try {
    // Fast URL check first
    if (url && url.includes("example.test")) {
      return { matched: true, confidence: 1.0 };
    }
    // DOM fallback check
    if (html && html.includes("example-plugin-marker")) {
      return { matched: true, confidence: 0.8 };
    }
    return { matched: false };
  } catch {
    return { matched: false };
  }
}

// ============================================================================
// ACTIONS
// ============================================================================

class ExampleActionResponse extends MCPResponse {
  constructor(data, nextSteps) {
    super(nextSteps);
    this.data = data;
  }
  _getAdditionalFields() { return { data: this.data }; }
  getTextSummary() { return `Example action returned ${Array.isArray(this.data) ? this.data.length : 0} items`; }
}

/**
 * Return the complete list of actions this plugin provides.
 * @returns {import('../../specs/002-site-plugins/data-model.md').ActionDescriptor[]}
 */
export function getActions() {
  return [
    {
      name: "list_items",
      description: "List items from the example page",
      params: [
        { name: "limit", type: "number", description: "Maximum number of items to return", required: false, default: 10 }
      ],
      execute: async ({ page, params }) => {
        const limit = params?.limit ?? 10;
        const items = await page.evaluate((lim) => {
          const rows = document.querySelectorAll('.item-row');
          return Array.from(rows).slice(0, lim).map(row => ({
            title: row.querySelector('.title')?.textContent?.trim() || 'Untitled',
            date: row.querySelector('.date')?.textContent?.trim() || ''
          }));
        }, limit);

        return new ExampleActionResponse(items, [
          "Call plugin_action with action 'get_item_detail' to read a specific item"
        ]);
      }
    },
    {
      name: "get_item_detail",
      description: "Get details for a specific item by ID",
      params: [
        { name: "itemId", type: "string", description: "Item identifier", required: true }
      ],
      execute: async ({ page, params }) => {
        if (!params?.itemId) {
          throw new Error("itemId parameter is required");
        }
        const detail = await page.evaluate((id) => {
          const el = document.querySelector(`[data-id="${id}"]`);
          if (!el) return null;
          return {
            id,
            title: el.querySelector('.title')?.textContent?.trim() || '',
            body: el.querySelector('.body')?.textContent?.trim() || ''
          };
        }, params.itemId);

        if (!detail) {
          const { ErrorResponse } = await import('../../src/core/responses.js');
          return new ErrorResponse(
            `Item '${params.itemId}' not found on the page`,
            ["Verify the item ID is correct", "Use list_items to see available items"]
          );
        }

        return new ExampleActionResponse(detail, [
          "Use plugin_action with action 'list_items' to see all items"
        ]);
      }
    }
  ];
}

// ============================================================================
// INFO
// ============================================================================

/**
 * Return high-level plugin context for the AI agent.
 * @returns {import('../../specs/002-site-plugins/data-model.md').PluginInfo}
 */
export function getInfo() {
  return {
    recommendation: "Interact with example.test pages — list items and view item details.",
    description: "Example stub plugin for testing MCPBrowser's plugin system. Lists items and retrieves item details from example.test pages.",
    targetPages: ["Example test page (example.test)"],
    authFlow: "No authentication required — example.test is a test domain",
    actions: getActions().map(({ name, description, params }) => ({ name, description, params }))
  };
}
