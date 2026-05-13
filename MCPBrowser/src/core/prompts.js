/**
 * MCP Prompts — reusable workflow templates exposed as slash-commands.
 * Each prompt returns a message array that guides the LLM through
 * a multi-tool workflow using MCPBrowser's tools.
 */

// ============================================================================
// PROMPT DEFINITIONS
// ============================================================================

export const PROMPTS = [
  {
    name: "scrape-page",
    description: "Fetch a web page and extract its content as clean HTML",
    arguments: [
      { name: "url", description: "URL to scrape", required: true },
      { name: "selector", description: "CSS selector to scope extraction (optional)", required: false }
    ]
  },
  {
    name: "fill-form",
    description: "Detect form fields on a page and fill them with provided values",
    arguments: [
      { name: "url", description: "URL of the page with the form", required: true },
      { name: "values", description: "JSON object mapping field selectors to values, e.g. {\"#email\": \"user@example.com\", \"#password\": \"secret\"}", required: true }
    ]
  },
  {
    name: "visual-audit",
    description: "Take a screenshot and get HTML of a page for visual comparison or accessibility review",
    arguments: [
      { name: "url", description: "URL to audit", required: true }
    ]
  },
  {
    name: "authenticated-workflow",
    description: "Navigate an authenticated site — fetch the page, handle login if needed, then continue",
    arguments: [
      { name: "url", description: "URL that may require authentication", required: true }
    ]
  }
];

// ============================================================================
// PROMPT MESSAGE GENERATORS
// ============================================================================

/**
 * Returns the messages array for a given prompt name and arguments.
 * @param {string} name - Prompt name
 * @param {Record<string, string>} args - Prompt arguments
 * @returns {{ description: string, messages: Array<{ role: string, content: { type: string, text: string } }> }}
 */
export function getPromptMessages(name, args = {}) {
  const prompt = PROMPTS.find(p => p.name === name);
  if (!prompt) {
    throw new Error(`Unknown prompt: ${name}`);
  }

  // Validate required arguments
  const missing = (prompt.arguments || [])
    .filter(a => a.required && !args[a.name])
    .map(a => a.name);
  if (missing.length > 0) {
    throw new Error(`Missing required argument(s) for prompt "${name}": ${missing.join(', ')}`);
  }

  switch (name) {
    case "scrape-page":
      return buildScrapePage(args);
    case "fill-form":
      return buildFillForm(args);
    case "visual-audit":
      return buildVisualAudit(args);
    case "authenticated-workflow":
      return buildAuthenticatedWorkflow(args);
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

// ============================================================================
// BUILDERS
// ============================================================================

function buildScrapePage({ url, selector }) {
  const selectorInstruction = selector
    ? ` Focus on the content matching the CSS selector \`${selector}\`.`
    : '';

  return {
    description: `Scrape content from ${url}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Fetch the web page at ${url} using browser_fetch_webpage.${selectorInstruction} Return the extracted HTML content. If the page requires scrolling to load more content, use browser_scroll_page to load it, then browser_get_current_html to capture the full page.`
        }
      }
    ]
  };
}

function buildFillForm({ url, values }) {
  return {
    description: `Fill form on ${url}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Fill out the form on ${url}:\n\n1. Fetch the page with browser_fetch_webpage.\n2. Detect available forms with browser_detect_forms.\n3. For each field in the values below, use browser_type_text to enter the value:\n\n${values}\n\n4. After filling all fields, use browser_click_element to submit the form (look for a submit button).\n5. Return the resulting page HTML with browser_get_current_html.`
        }
      }
    ]
  };
}

function buildVisualAudit({ url }) {
  return {
    description: `Visual audit of ${url}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Perform a visual audit of ${url}:\n\n1. Fetch the page with browser_fetch_webpage.\n2. Take a full-page screenshot with browser_take_screenshot.\n3. Get the current HTML with browser_get_current_html.\n4. Analyze the screenshot and HTML for:\n   - Layout issues or broken elements\n   - Missing alt text on images\n   - Color contrast problems\n   - Mobile responsiveness concerns\n5. Provide a summary of findings.`
        }
      }
    ]
  };
}

function buildAuthenticatedWorkflow({ url }) {
  return {
    description: `Authenticated workflow for ${url}`,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Navigate to ${url} using browser_fetch_webpage. This page may require authentication.\n\nIf the page shows a login form or redirects to a login page:\n1. Notify me that authentication is needed.\n2. Wait for me to complete the login in the browser window.\n3. After I confirm login is complete, use browser_fetch_webpage again with the original URL.\n\nOnce authenticated, return the page content using browser_get_current_html.`
        }
      }
    ]
  };
}
