import { ACTIONS } from './actions/index.js';
import { matchesWordUrl } from './helpers.js';
import { CorePlugin } from '../../core/plugins.js';

const manifest = {
  name: 'word',
  version: '1.0.0',
  description:
    'Microsoft Word Online controller for reading, editing, and reviewing authenticated documents',
  interfaceVersion: 2,
  urlPatterns: [
    'word.cloud.microsoft',
    'word.office.com',
    'sharepoint.com',
    'officeapps.live.com',
    'onedrive.live.com',
  ],
  domPatterns: ['#PagesContainer', 'form[target^="WacFrame"]'],
};

function matchesPage(url, html) {
  try {
    if (matchesWordUrl(url)) {
      const hostname = new URL(url).hostname;
      if (hostname === 'officeapps.live.com' || hostname.endsWith('.officeapps.live.com')) {
        return { matched: true, confidence: 1.0 };
      }
      if (hostname === 'sharepoint.com' || hostname.endsWith('.sharepoint.com')) {
        return { matched: true, confidence: 0.95 };
      }
      return { matched: true, confidence: 0.7 };
    }
    if (html?.includes('id="PagesContainer"') || html?.includes('target="WacFrame')) {
      return { matched: true, confidence: 0.8 };
    }
    return { matched: false };
  } catch {
    return { matched: false };
  }
}

function getInfo() {
  return {
    recommendation:
      'Use Word actions for authenticated online documents instead of generic DOM manipulation.',
    description: manifest.description,
    targetPages: ['Word home', 'SharePoint and OneDrive Word links', 'Word Online editors'],
    authFlow:
      'Uses the existing browser session; complete Microsoft authentication in the browser.',
    actions: ACTIONS.map((action) => action.toInfo()),
  };
}

export const WORD_PLUGIN = new CorePlugin({ manifest, matchesPage, actions: ACTIONS, getInfo });
