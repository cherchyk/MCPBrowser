import { ACTIONS } from './actions/index.js';
import { CorePlugin } from '../../core/plugins.js';

const manifest = {
  name: '_example',
  version: '1.0.0',
  description: 'Example stub plugin demonstrating the MCPBrowser plugin structure',
  interfaceVersion: 2,
  urlPatterns: ['example.test'],
  domPatterns: ['.example-plugin-marker'],
};

function matchesPage(url, html) {
  try {
    if (url?.includes('example.test')) return { matched: true, confidence: 1.0 };
    if (html?.includes('example-plugin-marker')) return { matched: true, confidence: 0.8 };
    return { matched: false };
  } catch {
    return { matched: false };
  }
}

function getInfo() {
  return {
    recommendation: 'Use the example actions to list items and read item details.',
    description: manifest.description,
    targetPages: ['Example test page (example.test)'],
    authFlow: 'No authentication required.',
    actions: ACTIONS.map((action) => action.toInfo()),
  };
}

export const EXAMPLE_PLUGIN = new CorePlugin({ manifest, matchesPage, actions: ACTIONS, getInfo });
