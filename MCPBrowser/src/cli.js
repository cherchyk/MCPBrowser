#!/usr/bin/env node
/**
 * cli.js - Registry-driven CLI interface for MCPBrowser
 *
 * All CLI commands, help text, and flag→param mapping are derived from a single
 * CLI_REGISTRY. When you add/remove MCP tools or change their schemas, update
 * the registry and everything (routing, help, validation) updates automatically.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Action functions
import { fetchPage, FETCH_WEBPAGE_TOOL } from './actions/fetch-page.js';
import { clickElement, CLICK_ELEMENT_TOOL } from './actions/click-element.js';
import { typeText, TYPE_TEXT_TOOL } from './actions/type-text.js';
import { executeJavascript, EXECUTE_JAVASCRIPT_TOOL } from './actions/execute-javascript.js';
import { getCurrentHtml, GET_CURRENT_HTML_TOOL } from './actions/get-current-html.js';
import { takeScreenshot, TAKE_SCREENSHOT_TOOL } from './actions/take-screenshot.js';
import { scrollPage, SCROLL_PAGE_TOOL } from './actions/scroll-page.js';
import { navigateHistory, NAVIGATE_HISTORY_TOOL } from './actions/navigate-history.js';
import { closeTab, CLOSE_TAB_TOOL } from './actions/close-tab.js';
import { closeBrowser } from './core/browser.js';
import logger from './core/logger.js';

logger.setConsoleOutput(false);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getVersion() {
  return JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')).version;
}

// ============================================================================
// CLI REGISTRY — single source of truth for all CLI commands
//
// To add a new CLI command:
//   1. Import the MCP TOOL definition and action function above
//   2. Add an entry to CLI_REGISTRY below
//   3. Done — help, routing, flag mapping all auto-update
//
// Fields:
//   cmd           CLI command name (what the user types)
//   tool          MCP TOOL definition object (has description, inputSchema, outputSchema)
//   action        The async function to call
//   requiresFetch true if the page must be loaded via fetch first
//   flagMap       Maps CLI flag names → MCP param names (for renamed flags)
//   flagDefaults  Default param values injected before calling the action
//   buildParams   (optional) Custom function(url, flags) → params object
//                 When omitted, params are auto-built from inputSchema + flagMap
//   formatOutput  (optional) Custom function(mcpResult, flags) → { stdout, stderr }
//                 When omitted, outputs mcpResult.content[0].text to stdout
//   examples      Array of example command strings shown in help
//   cliNote       Extra note shown under options in help (e.g. CLI-only flags)
// ============================================================================

const CLI_REGISTRY = [
  {
    cmd: 'fetch',
    tool: FETCH_WEBPAGE_TOOL,
    action: fetchPage,
    requiresFetch: false,
    flagMap: { wait: 'postLoadWait', raw: '_raw' },
    flagDefaults: {},
    buildParams: (url, flags) => ({
      url,
      browser: flags.browser || '',
      removeUnnecessaryHTML: !flags.raw,
      postLoadWait: flags.wait ? parseInt(flags.wait, 10) : 0
    }),
    formatOutput: (mcp, flags) => {
      const html = mcp.structuredContent?.html || mcp.content[0].text;
      return { stdout: flags.raw ? html : htmlToText(html) };
    },
    examples: [
      'mcpbrowser fetch https://eng.ms/docs/my-page',
      'mcpbrowser fetch https://portal.azure.com --browser edge --wait 5000',
      'mcpbrowser fetch https://github.com --raw',
    ],
    cliNote: '--raw    Output full HTML instead of extracted text',
  },

  {
    cmd: 'screenshot',
    tool: TAKE_SCREENSHOT_TOOL,
    action: takeScreenshot,
    requiresFetch: true,
    flagMap: { 'full-page': 'fullPage' },
    buildParams: (url, flags) => ({
      url,
      fullPage: !!flags['full-page']
    }),
    formatOutput: (mcp, flags) => {
      const base64 = mcp.structuredContent?.screenshotBase64;
      if (!base64) return { error: 'No screenshot data returned' };
      const outFile = flags.output || 'screenshot.png';
      writeFileSync(outFile, Buffer.from(base64, 'base64'));
      return { stderr: `Screenshot saved to ${outFile}` };
    },
    examples: [
      'mcpbrowser screenshot https://example.com --output page.png',
      'mcpbrowser screenshot https://dashboard.corp.com --full-page',
    ],
    cliNote: '--output <path>    File path to save (default: screenshot.png)',
  },

  {
    cmd: 'click',
    tool: CLICK_ELEMENT_TOOL,
    action: clickElement,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => ({
      url,
      selector: flags.selector || undefined,
      text: flags.text || undefined,
      returnHtml: flags.returnHtml !== 'false',
      removeUnnecessaryHTML: true,
      postClickWait: flags.postClickWait ? parseInt(flags.postClickWait, 10) : 1000,
    }),
    validate: (flags) => {
      if (!flags.selector && !flags.text) return '--selector or --text is required for click';
    },
    formatOutput: (mcp) => {
      const html = mcp.structuredContent?.html;
      return { stdout: html ? htmlToText(html) : mcp.content[0].text };
    },
    examples: [
      'mcpbrowser click https://example.com --selector "#login-btn"',
      'mcpbrowser click https://example.com --text "Sign In"',
    ],
  },

  {
    cmd: 'type',
    tool: TYPE_TEXT_TOOL,
    action: typeText,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => ({
      url,
      fields: [{ selector: flags.selector, text: flags.text }],
      returnHtml: false
    }),
    validate: (flags) => {
      if (!flags.selector || !flags.text) return '--selector and --text are required for type';
    },
    formatOutput: (mcp) => ({ stdout: mcp.content[0].text }),
    examples: [
      'mcpbrowser type https://example.com --selector "#search" --text "query"',
      'mcpbrowser type https://login.com --selector "input[name=email]" --text "user@corp.com"',
    ],
    cliNote: 'CLI shorthand: --selector + --text fills a single field',
  },

  {
    cmd: 'exec',
    tool: EXECUTE_JAVASCRIPT_TOOL,
    action: executeJavascript,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => ({
      url,
      script: flags.script,
      timeoutMs: flags.timeoutMs ? parseInt(flags.timeoutMs, 10) : 30000,
      returnType: flags.returnType || 'json',
    }),
    validate: (flags) => {
      if (!flags.script) return '--script is required for exec';
    },
    formatOutput: (mcp) => {
      const r = mcp.structuredContent?.result;
      if (r !== undefined && r !== null) {
        return { stdout: typeof r === 'string' ? r : JSON.stringify(r, null, 2) };
      }
      return { stdout: mcp.content[0].text };
    },
    examples: [
      'mcpbrowser exec https://example.com --script "document.title"',
      'mcpbrowser exec https://mail.google.com --script "[...document.querySelectorAll(\'.zA\')].map(r=>r.textContent)"',
    ],
  },

  {
    cmd: 'html',
    tool: GET_CURRENT_HTML_TOOL,
    action: getCurrentHtml,
    requiresFetch: true,
    flagMap: { raw: '_raw' },
    buildParams: (url, flags) => ({
      url,
      removeUnnecessaryHTML: !flags.raw,
    }),
    formatOutput: (mcp) => ({ stdout: mcp.structuredContent?.html || mcp.content[0].text }),
    examples: [
      'mcpbrowser html https://example.com',
      'mcpbrowser html https://example.com --raw',
    ],
    cliNote: '--raw    Output raw HTML without cleanup',
  },

  {
    cmd: 'scroll',
    tool: SCROLL_PAGE_TOOL,
    action: scrollPage,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => {
      const params = { url };
      if (flags.selector) { params.selector = flags.selector; }
      else if (flags.x !== undefined || flags.y !== undefined) {
        if (flags.x !== undefined) params.x = parseInt(flags.x, 10);
        if (flags.y !== undefined) params.y = parseInt(flags.y, 10);
      } else {
        params.direction = flags.direction || 'down';
        if (flags.amount) params.amount = parseInt(flags.amount, 10);
      }
      return params;
    },
    formatOutput: (mcp) => {
      const s = mcp.structuredContent;
      return { stdout: JSON.stringify({ scrollX: s.scrollX, scrollY: s.scrollY, pageWidth: s.pageWidth, pageHeight: s.pageHeight, viewportWidth: s.viewportWidth, viewportHeight: s.viewportHeight }, null, 2) };
    },
    examples: [
      'mcpbrowser scroll https://example.com --direction down --amount 1000',
      'mcpbrowser scroll https://example.com --selector "#footer"',
      'mcpbrowser scroll https://example.com --x 0 --y 0',
    ],
  },

  {
    cmd: 'back',
    tool: NAVIGATE_HISTORY_TOOL,
    action: navigateHistory,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => ({
      url,
      direction: 'back',
      returnHtml: true,
      removeUnnecessaryHTML: !flags.raw,
    }),
    formatOutput: (mcp, flags) => {
      const s = mcp.structuredContent;
      const out = {};
      out.stderr = `${s.previousUrl} → ${s.currentUrl}`;
      if (s.html) out.stdout = flags.raw ? s.html : htmlToText(s.html);
      return out;
    },
    examples: ['mcpbrowser back https://example.com'],
  },

  {
    cmd: 'forward',
    tool: NAVIGATE_HISTORY_TOOL,
    action: navigateHistory,
    requiresFetch: true,
    flagMap: {},
    buildParams: (url, flags) => ({
      url,
      direction: 'forward',
      returnHtml: true,
      removeUnnecessaryHTML: !flags.raw,
    }),
    formatOutput: (mcp, flags) => {
      const s = mcp.structuredContent;
      const out = {};
      out.stderr = `${s.previousUrl} → ${s.currentUrl}`;
      if (s.html) out.stdout = flags.raw ? s.html : htmlToText(s.html);
      return out;
    },
    examples: ['mcpbrowser forward https://example.com'],
  },

  {
    cmd: 'close',
    tool: CLOSE_TAB_TOOL,
    action: closeTab,
    requiresFetch: false,
    flagMap: {},
    buildParams: (url) => ({ url }),
    formatOutput: (mcp) => ({ stdout: mcp.content[0].text }),
    examples: ['mcpbrowser close https://example.com'],
  },
];

// Build lookup map from registry
const CMD_MAP = new Map(CLI_REGISTRY.map(entry => [entry.cmd, entry]));

// ============================================================================
// ARGUMENT PARSING
// ============================================================================

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  let command = null;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      flags.version = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

// ============================================================================
// HTML → TEXT (for terminal output)
// ============================================================================

function htmlToText(html) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============================================================================
// HELP — auto-generated from CLI_REGISTRY + MCP tool definitions
// ============================================================================

/**
 * Format inputSchema properties into CLI option lines.
 * Skips 'url' (positional) and any param mapped to a CLI-only alias.
 */
function formatSchemaOptions(tool, entry) {
  const props = tool.inputSchema?.properties || {};
  const required = new Set(tool.inputSchema?.required || []);
  // Reverse flagMap: MCP param name → CLI flag name
  const reverseMap = {};
  for (const [cliFlag, mcpParam] of Object.entries(entry.flagMap || {})) {
    if (!mcpParam.startsWith('_')) reverseMap[mcpParam] = cliFlag;
  }

  const lines = [];
  for (const [name, schema] of Object.entries(props)) {
    if (name === 'url') continue;

    const cliName = reverseMap[name] || name;
    let typeHint = '';
    if (schema.enum) {
      typeHint = `<${schema.enum.filter(Boolean).join('|')}>`;
    } else if (schema.type === 'string') {
      typeHint = `<${cliName}>`;
    } else if (schema.type === 'number') {
      typeHint = '<n>';
    } else if (schema.type === 'boolean') {
      typeHint = '';
    } else if (schema.type === 'array' && schema.items?.properties) {
      // Complex array (like fields) — show item properties
      lines.push(`    --${cliName}  (structured — see MCP schema)`);
      const itemReq = new Set(schema.items.required || []);
      for (const [iName, iProp] of Object.entries(schema.items.properties)) {
        const ir = itemReq.has(iName) ? ' (required)' : '';
        const id = iProp.default !== undefined ? `  [default: ${iProp.default}]` : '';
        lines.push(`      .${iName} (${iProp.type})${ir}${id} — ${iProp.description || ''}`);
      }
      continue;
    }

    const defVal = schema.default !== undefined ? `  [default: ${schema.default}]` : '';
    const req = required.has(name) ? '  (required)' : '';
    const desc = schema.description || '';
    // Shorten description for terminal readability
    const shortDesc = desc.length > 80 ? desc.slice(0, 77) + '...' : desc;
    lines.push(`    --${cliName} ${typeHint}${req}${defVal}  ${shortDesc}`);
  }
  return lines;
}

/**
 * Format outputSchema into a compact output description.
 */
function formatSchemaOutput(tool) {
  const props = tool.outputSchema?.properties || {};
  const lines = [];
  for (const [name, prop] of Object.entries(props)) {
    let t = prop.type || 'any';
    if (Array.isArray(t)) t = t.filter(x => x !== 'null').join('|');
    if (t === 'array') t = `array<${prop.items?.type || 'any'}>`;
    if (t === 'object' && !prop.description) continue; // skip complex nested objects without desc
    lines.push(`    ${name} (${t})${prop.description ? ' — ' + prop.description : ''}`);
  }
  return lines;
}

function printHelp() {
  const version = getVersion();
  const o = (s) => process.stdout.write(s + '\n');

  o(`MCPBrowser v${version} — Browser automation for AI agents and CLI`);
  o('');
  o('USAGE');
  o('  mcpbrowser                              Start MCP server (stdin/stdout)');
  o('  mcpbrowser <command> <url> [options]     Run a CLI command and exit');
  o('  mcpbrowser -h | --help                  Show this help');
  o('  mcpbrowser -v | --version               Show version');
  o('');
  o('WORKFLOW');
  o('  fetch  ──▶  click / type / exec / scroll  ──▶  html  ──▶  close');
  o('  (load)      (interact)                         (read)      (cleanup)');
  o('');
  o('  Start with "fetch" to load a page, then interact. The browser keeps tabs');
  o('  open between commands. Auth, SSO, CAPTCHAs are handled automatically.');
  o('');
  o('BROWSERS');
  o('  chrome, edge, brave — auto-detected, or set with --browser');
  o('  Uses your real browser profile (existing logins/cookies available).');
  o('');
  o('━'.repeat(70));
  o('COMMANDS');
  o('━'.repeat(70));

  for (const entry of CLI_REGISTRY) {
    o('');
    const depTag = entry.requiresFetch ? '  [requires: fetch]' : '';
    // Clean description: strip markdown bold, collapse newlines
    const desc = (entry.tool.description || '')
      .replace(/\*\*/g, '')
      .replace(/\\n/g, ' ')
      .split('\n')[0]; // first line only for summary

    o(`${entry.cmd} <url> [options]${depTag}`);
    o(`  ${desc}`);
    o('');

    // Options from inputSchema
    const schemaOpts = formatSchemaOptions(entry.tool, entry);
    if (schemaOpts.length > 0 || entry.cliNote) {
      o('  Options:');
      for (const line of schemaOpts) o(line);
      if (entry.cliNote) o(`    ${entry.cliNote}`);
      o('');
    }

    // Output schema
    const outFields = formatSchemaOutput(entry.tool);
    if (outFields.length > 0) {
      o('  Output fields:');
      for (const line of outFields) o(line);
      o('');
    }

    // Examples
    if (entry.examples?.length) {
      o('  Examples:');
      for (const ex of entry.examples) o(`    ${ex}`);
    }
  }

  // Multi-step example
  o('');
  o('━'.repeat(70));
  o('MULTI-STEP EXAMPLE');
  o('━'.repeat(70));
  o('');
  o('  mcpbrowser fetch https://app.example.com/login');
  o('  mcpbrowser type  https://app.example.com/login --selector "#email" --text "me@corp.com"');
  o('  mcpbrowser type  https://app.example.com/login --selector "#password" --text "secret"');
  o('  mcpbrowser click https://app.example.com/login --text "Sign In"');
  o('  mcpbrowser html  https://app.example.com/dashboard');
  o('  mcpbrowser screenshot https://app.example.com/dashboard --output dash.png');
  o('  mcpbrowser close https://app.example.com');
  o('');

  // MCP server mode
  o('━'.repeat(70));
  o('MCP SERVER MODE');
  o('━'.repeat(70));
  o('');
  o('  No arguments → starts MCP server (stdin/stdout JSON-RPC).');
  o('  CLI commands map 1:1 to MCP tools (fetch→fetch_webpage, etc.).');
  o('');
  o('  { "mcpServers": { "mcpbrowser": { "command": "npx", "args": ["-y", "mcpbrowser@latest"] } } }');
  o('');
}

// ============================================================================
// GENERIC COMMAND EXECUTOR — driven by CLI_REGISTRY
// ============================================================================

async function executeCommand(entry, url, flags) {
  // Validate if the entry has a validator
  if (entry.validate) {
    const err = entry.validate(flags);
    if (err) {
      process.stderr.write(`Error: ${err}\n`);
      return 1;
    }
  }

  // Build params from flags
  const params = entry.buildParams
    ? entry.buildParams(url, flags)
    : { url, ...flags };

  // Call the action
  const result = await entry.action(params);
  const mcp = result.toMcpFormat();

  if (mcp.isError) {
    process.stderr.write(`Error: ${mcp.content[0].text}\n`);
    return 1;
  }

  // Format and write output
  const output = entry.formatOutput
    ? entry.formatOutput(mcp, flags)
    : { stdout: mcp.content[0].text };

  if (output.error) {
    process.stderr.write(`Error: ${output.error}\n`);
    return 1;
  }
  if (output.stderr) process.stderr.write(output.stderr + '\n');
  if (output.stdout) process.stdout.write(output.stdout + '\n');

  return 0;
}

// ============================================================================
// MAIN CLI ENTRY
// ============================================================================

export function isCliMode(argv) {
  return argv.length > 0;
}

export async function runCli(argv) {
  const { command, positional, flags } = parseArgs(argv);

  if (flags.help) { printHelp(); return 0; }
  if (flags.version) { process.stdout.write(getVersion() + '\n'); return 0; }
  if (!command) { printHelp(); return 0; }

  const entry = CMD_MAP.get(command);
  if (!entry) {
    process.stderr.write(`Unknown command: ${command}\n`);
    process.stderr.write(`Available: ${[...CMD_MAP.keys()].join(', ')}\n`);
    process.stderr.write('Run mcpbrowser --help for usage\n');
    return 1;
  }

  const url = positional[0];
  if (!url) {
    process.stderr.write(`Error: <url> is required for '${command}'\n`);
    process.stderr.write(`Usage: mcpbrowser ${command} <url> [options]\n`);
    return 1;
  }

  let exitCode = 1;
  try {
    // For screenshot, auto-fetch first if needed
    if (entry.cmd === 'screenshot') {
      const fetchResult = await fetchPage({ url, browser: flags.browser || '', removeUnnecessaryHTML: true });
      const fetchMcp = fetchResult.toMcpFormat();
      if (fetchMcp.isError) {
        process.stderr.write(`Error loading page: ${fetchMcp.content[0].text}\n`);
        return 1;
      }
      const actualUrl = fetchMcp.structuredContent?.currentUrl || url;
      exitCode = await executeCommand(entry, actualUrl, flags);
    } else {
      exitCode = await executeCommand(entry, url, flags);
    }
  } catch (err) {
    process.stderr.write(`Error: ${err.message}\n`);
    exitCode = 1;
  } finally {
    try { await closeBrowser(); } catch { /* ignore */ }
  }

  return exitCode;
}
