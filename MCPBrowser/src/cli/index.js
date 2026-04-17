/**
 * cli/index.js — CLI entrypoint and generic command executor.
 *
 * Thin orchestration layer: parses args, coerces types, validates,
 * dispatches to registry actions, and formats output.
 */

import { parseArgs, coerceFlags } from './args.js';
import { CLI_REGISTRY, CMD_MAP } from './registry.js';
import { getVersion, printHelp } from './help.js';
import { getPrimaryText } from './utils.js';

import { fetchPage } from '../actions/fetch-page.js';
import { closeBrowser } from '../core/browser.js';
import logger from '../core/logger.js';

logger.setConsoleOutput(false);

export function isCliMode(argv) {
  return argv.length > 0;
}

/**
 * Generic command executor — driven by CLI_REGISTRY entry.
 */
async function executeCommand(entry, url, flags) {
  // Custom validation
  if (entry.validate) {
    const err = entry.validate(flags);
    if (err) {
      process.stderr.write(`Error: ${err}\n`);
      return 1;
    }
  }

  // Schema-driven type coercion
  const { coerced, errors } = coerceFlags(flags, entry.tool, entry.flagMap);
  if (errors.length > 0) {
    for (const e of errors) process.stderr.write(`Error: ${e}\n`);
    return 1;
  }

  // Build params
  const params = entry.buildParams
    ? entry.buildParams(url, coerced)
    : { url, ...coerced };

  // Call the MCP action
  const result = await entry.action(params);
  const mcp = result.toMcpFormat();

  if (mcp.isError) {
    process.stderr.write(`Error: ${getPrimaryText(mcp)}\n`);
    return 1;
  }

  // --json: output raw MCP result
  if (coerced.json) {
    const jsonOut = {
      content: mcp.content,
      ...(mcp.structuredContent ? { structuredContent: mcp.structuredContent } : {})
    };
    process.stdout.write(JSON.stringify(jsonOut, null, 2) + '\n');
    return 0;
  }

  // Formatted output
  const output = entry.formatOutput
    ? entry.formatOutput(mcp, coerced)
    : { stdout: getPrimaryText(mcp) };

  if (output.error) {
    process.stderr.write(`Error: ${output.error}\n`);
    return 1;
  }
  if (output.stderr) process.stderr.write(output.stderr + '\n');
  if (output.stdout) process.stdout.write(output.stdout + '\n');

  return 0;
}

/**
 * Main CLI entry point.
 */
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
    // Auto-fetch for commands that declare it (e.g. screenshot)
    if (entry.autoFetch) {
      const fetchResult = await fetchPage({ url, browser: flags.browser || '', removeUnnecessaryHTML: true });
      const fetchMcp = fetchResult.toMcpFormat();
      if (fetchMcp.isError) {
        process.stderr.write(`Error loading page: ${getPrimaryText(fetchMcp)}\n`);
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
