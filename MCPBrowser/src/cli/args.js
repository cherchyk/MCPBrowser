/**
 * cli/args.js — Argument parsing and schema-driven flag coercion.
 */

/**
 * Parse CLI argv into { command, positional, flags }.
 * Supports --flag value, --flag=value, --flag (boolean), -h, -v.
 */
export function parseArgs(argv) {
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
      const eqIdx = arg.indexOf('=');
      if (eqIdx !== -1) {
        // --flag=value
        flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
      } else {
        const key = arg.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('--')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (!command) {
      command = arg;
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

/**
 * Coerce flag values to correct types using MCP tool inputSchema.
 * Returns { coerced, errors } where errors is an array of validation messages.
 */
export function coerceFlags(flags, tool, flagMap = {}) {
  const props = tool?.inputSchema?.properties || {};
  const coerced = { ...flags };
  const errors = [];

  // Build reverse map: CLI flag → MCP param name
  const reverseMap = {};
  for (const [cliFlag, mcpParam] of Object.entries(flagMap)) {
    if (!mcpParam.startsWith('_')) reverseMap[cliFlag] = mcpParam;
  }

  for (const [key, value] of Object.entries(coerced)) {
    // Skip built-in flags
    if (key === 'help' || key === 'version' || key === 'json' || key === 'output') continue;

    const mcpParam = reverseMap[key] || key;
    const schema = props[mcpParam];
    if (!schema) continue; // unknown flag — leave as-is

    if (schema.type === 'number' && typeof value === 'string') {
      const n = Number(value);
      if (Number.isNaN(n)) {
        errors.push(`--${key} must be a number, got '${value}'`);
      } else {
        coerced[key] = n;
      }
    } else if (schema.type === 'boolean' && typeof value === 'string') {
      coerced[key] = value !== 'false' && value !== '0';
    }
  }

  return { coerced, errors };
}
