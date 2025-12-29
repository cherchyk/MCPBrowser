/**
 * wait-for-element.js - Wait for an element to appear on a page
 */

import { getBrowser, domainPages } from '../core/browser.js';

/**
 * Wait for an element to appear on the page
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page
 * @param {string} [params.selector] - CSS selector to wait for
 * @param {string} [params.text] - Text content to wait for
 * @param {number} [params.timeout=30000] - Maximum time to wait
 * @returns {Promise<Object>} Result object
 */
export async function waitForElement({ url, selector, text, timeout = 30000 }) {
  if (!url) {
    throw new Error("url parameter is required");
  }
  
  if (!selector && !text) {
    throw new Error("Either selector or text parameter is required");
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
    if (selector) {
      await page.waitForSelector(selector, { timeout, visible: true });
      return {
        success: true,
        message: `Element found: ${selector}`,
        selector
      };
    } else {
      await page.waitForFunction(
        (searchText) => {
          const elements = Array.from(document.querySelectorAll('*'));
          return elements.some(el => {
            const text = el.textContent?.trim();
            return text && text.includes(searchText);
          });
        },
        { timeout },
        text
      );
      return {
        success: true,
        message: `Element with text found: "${text}"`,
        text
      };
    }
  } catch (err) {
    return {
      success: false,
      error: `Element not found within timeout: ${err.message}`,
      selector,
      text
    };
  }
}
