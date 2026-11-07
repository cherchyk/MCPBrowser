import { CorePlugin } from '../../core/plugins.js';
import {
  isExcelDocumentUrl,
  isOfficeEditorHost,
  isSharePointHost,
} from '../../core/office-urls.js';
import { ACTIONS } from './actions/index.js';
import { isAllowedExcelUrl } from './helpers.js';

const manifest = {
  name: 'excel',
  version: '1.0.0',
  description:
    'Microsoft Excel Online controller using standard editor controls, without Copilot or add-ins',
  interfaceVersion: 2,
  urlPatterns: [
    'excel.cloud.microsoft',
    'excel.office.com',
    'sharepoint.com',
    'officeapps.live.com',
    'onedrive.live.com',
  ],
  domPatterns: ['FormulaBar-NameBox-input', 'gridKeyboardContentEditable_textElement'],
};

function matchesPage(url, html) {
  if (!isAllowedExcelUrl(url)) return { matched: false };
  if (isExcelDocumentUrl(url)) {
    return { matched: true, confidence: isSharePointHost(new URL(url).hostname) ? 0.95 : 1 };
  }
  if (html?.includes('FormulaBar-NameBox-input')) return { matched: true, confidence: 0.9 };
  const parsed = new URL(url);
  if (
    /\/:[wp]:\//i.test(parsed.pathname) ||
    /\.(docx|pptx)$/i.test(parsed.pathname) ||
    /\.(docx|pptx)$/i.test(parsed.searchParams.get('file') || '') ||
    /(?:^|-)word(?:-|\.officeapps\.live\.com$)/i.test(parsed.hostname)
  ) {
    return { matched: false };
  }
  if (
    !isOfficeEditorHost(parsed.hostname) &&
    /\/(?:doc2?|wopiframe|edit)\.aspx$/i.test(parsed.pathname)
  ) {
    return { matched: true, confidence: 0.5 };
  }
  return { matched: false };
}

function getInfo() {
  return {
    recommendation:
      'Use Excel actions for bounded cell reads and edits in authenticated workbooks.',
    description: manifest.description,
    targetPages: ['Excel home', 'SharePoint and OneDrive Excel links', 'Excel Online editors'],
    authFlow: 'Uses the existing browser session. Complete Microsoft sign-in in the browser.',
    actions: ACTIONS.map((action) => action.toInfo()),
  };
}

export const EXCEL_PLUGIN = new CorePlugin({ manifest, matchesPage, actions: ACTIONS, getInfo });
