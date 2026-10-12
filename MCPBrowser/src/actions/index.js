import { ACCEPT_EULA_ACTION } from './accept-eula.js';
import { CLICK_ELEMENT_ACTION } from './click-element.js';
import { CLOSE_TAB_ACTION } from './close-tab.js';
import { DETECT_FORMS_ACTION } from './detect-forms.js';
import { EXECUTE_JAVASCRIPT_ACTION } from './execute-javascript.js';
import { FETCH_WEBPAGE_ACTION } from './fetch-page.js';
import { GET_CURRENT_HTML_ACTION } from './get-current-html.js';
import { NAVIGATE_HISTORY_ACTION } from './navigate-history.js';
import { PLUGIN_ACTION } from './plugin-action.js';
import { PLUGIN_INFO_ACTION } from './plugin-info.js';
import { SCROLL_PAGE_ACTION } from './scroll-page.js';
import { TAKE_SCREENSHOT_ACTION } from './take-screenshot.js';
import { TYPE_TEXT_ACTION } from './type-text.js';

export const ACTIONS = [
  ACCEPT_EULA_ACTION,
  FETCH_WEBPAGE_ACTION,
  EXECUTE_JAVASCRIPT_ACTION,
  CLICK_ELEMENT_ACTION,
  TYPE_TEXT_ACTION,
  CLOSE_TAB_ACTION,
  GET_CURRENT_HTML_ACTION,
  TAKE_SCREENSHOT_ACTION,
  SCROLL_PAGE_ACTION,
  NAVIGATE_HISTORY_ACTION,
  DETECT_FORMS_ACTION,
  PLUGIN_INFO_ACTION,
  PLUGIN_ACTION,
];
