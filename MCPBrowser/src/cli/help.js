/**
 * cli/help.js — Auto-generated help from CLI_REGISTRY + MCP tool schemas.
 */

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { CLI_REGISTRY } from './registry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function getVersion() {
  return JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8')).version;
}

/**
 * Format inputSchema properties into CLI option lines.
 * Skips 'url' (positional) and internal-only params.
 */
function formatSchemaOptions(tool, entry) {
  const props = tool.inputSchema?.properties || {};
  const required = new Set(tool.inputSchema?.required || []);
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
    if (t === 'object' && !prop.description) continue;
    lines.push(`    ${name} (${t})${prop.description ? ' — ' + prop.description : ''}`);
  }
  return lines;
}

export function printHelp() {
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
  o('GLOBAL FLAGS');
  o('  --json     Output raw MCP result as JSON (for agent/programmatic use)');
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
    const desc = (entry.tool.description || '')
      .replace(/\*\*/g, '')
      .replace(/\\n/g, ' ')
      .split('\n')[0];

    o(`${entry.cmd} <url> [options]${depTag}`);
    o(`  ${desc}`);
    o('');

    const schemaOpts = formatSchemaOptions(entry.tool, entry);
    if (schemaOpts.length > 0 || entry.cliNote) {
      o('  Options:');
      for (const line of schemaOpts) o(line);
      if (entry.cliNote) o(`    ${entry.cliNote}`);
      o('');
    }

    const outFields = formatSchemaOutput(entry.tool);
    if (outFields.length > 0) {
      o('  Output fields:');
      for (const line of outFields) o(line);
      o('');
    }

    if (entry.examples?.length) {
      o('  Examples:');
      for (const ex of entry.examples) o(`    ${ex}`);
    }
  }

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
  o('  Use --json with any command for structured output:');
  o('  mcpbrowser fetch https://example.com --json');
  o('');

  o('━'.repeat(70));
  o('MCP SERVER MODE');
  o('━'.repeat(70));
  o('');
  o('  No arguments → starts MCP server (stdin/stdout JSON-RPC).');
  o('  CLI commands map 1:1 to MCP tools (fetch→browser_fetch_webpage, etc.).');
  o('');
  o('  { "mcpServers": { "mcpbrowser": { "command": "npx", "args": ["-y", "mcpbrowser@latest"] } } }');
  o('');
}
