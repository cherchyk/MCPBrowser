/**
 * get-current-html.js - Get current HTML from an already-loaded page
 */

import { getBrowser, domainPages } from '../core/browser.js';
import { extractAndProcessHtml } from '../core/page.js';

/**
 * Get current HTML from an already-loaded page without reloading/navigating
 * Use this after interactions (click, type, wait) to get updated DOM state
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page to get HTML from
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML
 * @returns {Promise<Object>} Result object with current HTML
 */
export async function getCurrentHtml({ url, removeUnnecessaryHTML = true }) {
  if (!url) {
    throw new Error("url parameter is required");
  }

  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const browser = await getBrowser();
  let page = domainPages.get(hostname);
  
  if (!page || page.isClosed()) {
    return {
      success: false,
      error: `No open page found for ${hostname}. Please fetch the page first using fetch_webpage.`
    };
  }

  try {
    const currentUrl = page.url();
    const html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
    
    return {
      success: true,
      url: currentUrl,
      html
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to get HTML: ${err.message}`
    };
  }
}
