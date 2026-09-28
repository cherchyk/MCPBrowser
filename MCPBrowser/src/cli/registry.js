/**
 * CLI command registry generated from core action metadata.
 *
 * To add a CLI command, add a `cli` definition to its CoreAction.
 */

import { ACTIONS } from '../actions/index.js';

export const CLI_REGISTRY = ACTIONS.flatMap((action) => {
  if (!action.cli) return [];
  const definitions = Array.isArray(action.cli) ? action.cli : [action.cli];
  return definitions.map((definition) => ({
    ...definition,
    tool: action.tool,
    action: action.execute,
  }));
}).sort((left, right) => (left.order ?? 0) - (right.order ?? 0));

export const CMD_MAP = new Map(CLI_REGISTRY.map((entry) => [entry.cmd, entry]));

if (CMD_MAP.size !== CLI_REGISTRY.length) {
  throw new Error('Core actions define duplicate CLI command names');
}
