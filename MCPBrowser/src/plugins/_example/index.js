import { getItemDetail } from './actions/get-item-detail.js';
import { listItems } from './actions/list-items.js';

export const manifest = {
  name: '_example',
  version: '1.0.0',
  description: 'Example stub plugin demonstrating the MCPBrowser plugin structure',
  interfaceVersion: 1,
  urlPatterns: ['example.test'],
  domPatterns: ['.example-plugin-marker']
};

export function matchesPage(url, html) {
  try {
    if (url?.includes('example.test')) return { matched: true, confidence: 1.0 };
    if (html?.includes('example-plugin-marker')) return { matched: true, confidence: 0.8 };
    return { matched: false };
  } catch {
    return { matched: false };
  }
}

export function getActions() {
  return [
    {
      name: 'list_items',
      description: 'List items from the example page',
      params: [
        { name: 'limit', type: 'number', description: 'Maximum number of items to return (default: 10)', required: false, default: 10 }
      ],
      execute: listItems
    },
    {
      name: 'get_item_detail',
      description: 'Get details for a specific item by ID',
      params: [
        { name: 'itemId', type: 'string', description: 'Item identifier', required: true }
      ],
      execute: getItemDetail
    }
  ];
}

export function getInfo() {
  return {
    recommendation: 'Use the example actions to list items and read item details.',
    description: manifest.description,
    targetPages: ['Example test page (example.test)'],
    authFlow: 'No authentication required.',
    actions: getActions().map(({ name, description, params }) => ({ name, description, params }))
  };
}
