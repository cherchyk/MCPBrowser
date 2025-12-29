/**
 * type.js - Type text into input fields
 */

import { getBrowser, domainPages } from '../core/browser.js';
import { extractAndProcessHtml, waitForPageStability } from '../core/page.js';

/**
 * Type text into an input field
 * @param {Object} params - Type parameters
 * @param {string} params.url - The URL of the page to interact with
 * @param {string} params.selector - CSS selector for the input element
 * @param {string} params.text - Text to type
 * @param {boolean} [params.clear=true] - Whether to clear existing text first
 * @param {number} [params.typeDelay=50] - Delay between keystrokes in milliseconds
 * @param {number} [params.waitForElementTimeout=30000] - Maximum time to wait for element
 * @param {boolean} [params.returnHtml=true] - Whether to wait for stability and return HTML
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML (only if returnHtml is true)
 * @param {number} [params.postTypeWait=1000] - Milliseconds to wait after typing for SPAs to render dynamic content
 * @returns {Promise<Object>} Result object with success status and details
 */
export async function typeText({ url, selector, text, clear = true, typeDelay = 50, waitForElementTimeout = 30000, returnHtml = true, removeUnnecessaryHTML = true, postTypeWait = 1000 }) {
  if (!url) {
    throw new Error("url parameter is required");
  }
  
  if (!selector) {
    throw new Error("selector parameter is required");
  }
  
  if (text === undefined || text === null) {
    throw new Error("text parameter is required");
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
      error: `No open page found for ${hostname}. Please fetch the page first using fetch_webpage_protected.`
    };
  }

  try {
    await page.waitForSelector(selector, { timeout: waitForElementTimeout, visible: true });
    
    if (clear) {
      await page.click(selector, { clickCount: 3 }); // Select all text
      await page.keyboard.press('Backspace');
    }
    
    await page.type(selector, String(text), { delay: typeDelay });
    
    if (returnHtml) {
      // Wait for page to stabilize (handles form validation, autocomplete, etc.)
      await waitForPageStability(page);
      
      // Wait for SPAs to render dynamic content after typing
      if (postTypeWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postTypeWait));
      }
      
      const currentUrl = page.url();
      const html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
      
      return {
        success: true,
        message: `Typed text into: ${selector}`,
        currentUrl,
        html,
        selector,
        textLength: String(text).length
      };
    } else {
      // Wait for page to stabilize even without returning HTML
      await waitForPageStability(page);
      
      // Wait for SPAs to render dynamic content after typing
      if (postTypeWait > 0) {
        await new Promise(resolve => setTimeout(resolve, postTypeWait));
      }
      
      const currentUrl = page.url();
      
      return {
        success: true,
        message: `Typed text into: ${selector}`,
        currentUrl,
        selector,
        textLength: String(text).length
      };
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to type text: ${err.message}`
    };
  }
}
