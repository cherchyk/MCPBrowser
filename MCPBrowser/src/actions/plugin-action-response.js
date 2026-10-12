import { ErrorResponse } from '../core/responses.js';

export function createMissingPluginPageResponse(pluginName, actionName, targetPatterns, params) {
  const hasUrl = typeof params?.url === 'string' && params.url.length > 0;
  const urlExplanation = hasUrl
    ? ' The URL in params.url is passed to the plugin only after MCPBrowser selects a matching tab, so it cannot create the first tab.'
    : '';
  const firstStep = hasUrl
    ? 'First call browser_fetch_webpage with the same URL from params.url to create or reuse the required tab'
    : `First call browser_fetch_webpage with a URL matching: ${targetPatterns}`;

  return new ErrorResponse(
    `Plugin '${pluginName}' action '${actionName}' cannot run because no matching browser tab is open. This plugin operates on: ${targetPatterns}.${urlExplanation} ${firstStep}, then retry browser_plugin_action.`,
    [firstStep, `Then retry browser_plugin_action for '${pluginName}/${actionName}'`],
  );
}
