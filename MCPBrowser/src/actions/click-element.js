/**
 * click.js - Click element action
 * 
 * This function handles two distinct use cases:
 * 
 * 1. NAVIGATION/CONTENT UPDATES (returnHtml: true, default):
 *    - Clicks the element
 *    - Waits for page stability (network idle, DOM updates)
 *    - Returns the updated HTML content
 *    - Use for: Links, navigation buttons, SPA route changes (e.g., Gmail folders)
 *    - Takes 3-8 seconds due to stability wait
 * 
 * 2. FAST FORM INTERACTIONS (returnHtml: false):
 *    - Clicks the element
 *    - Minimal 300ms wait
 *    - Returns success without HTML
 *    - Use for: Checkboxes, radio buttons, form fields that don't navigate
 *    - Takes <1 second
 * 
 * Why this design?
 * - Solves SPA navigation issue: URL hash changes instantly (#inbox → #trash),
 *   but content loads asynchronously. Without waiting, we'd return old content.
 * - Consistent with fetch_webpage: Both wait for stability and return HTML
 * - Flexible: Can disable waiting for fast form interactions
 */

import { getBrowser, domainPages } from '../core/browser.js';
import { extractAndProcessHtml, waitForPageStability } from '../core/page.js';

/**
 * Click on an element on the page
 * 
 * @param {Object} params - Click parameters
 * @param {string} params.url - The URL of the page to interact with
 * @param {string} [params.selector] - CSS selector for the element to click
 * @param {string} [params.text] - Text content to search for (alternative to selector)
 * @param {number} [params.timeout=30000] - Maximum time to wait for element
 * @param {boolean} [params.returnHtml=true] - Whether to wait for stability and return HTML
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML (only if returnHtml is true)
 * @returns {Promise<Object>} Result object with success status and details
 * 
 * @example
 * // Navigate to Gmail Bin folder (waits for emails to load, returns HTML)
 * const result = await clickElement({ url: gmailUrl, text: "Bin" });
 * console.log(result.html); // Contains bin emails
 * 
 * @example
 * // Fast checkbox click (no wait, no HTML)
 * const result = await clickElement({ 
 *   url: formUrl, 
 *   selector: "#agree-checkbox",
 *   returnHtml: false 
 * });
 */
export async function clickElement({ url, selector, text, timeout = 30000, returnHtml = true, removeUnnecessaryHTML = true }) {
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
    let elementHandle;
    
    if (selector) {
      // Use CSS selector
      await page.waitForSelector(selector, { timeout, visible: true });
      elementHandle = await page.$(selector);
    } else {
      // Search by text content
      await page.waitForFunction(
        (searchText) => {
          const elements = Array.from(document.querySelectorAll('*'));
          return elements.some(el => {
            const text = el.textContent?.trim();
            return text && text.includes(searchText) && el.offsetParent !== null;
          });
        },
        { timeout },
        text
      );
      
      elementHandle = await page.evaluateHandle((searchText) => {
        const elements = Array.from(document.querySelectorAll('*'));
        // Prioritize smaller elements (more specific matches)
        const matches = elements.filter(el => {
          const elText = el.textContent?.trim();
          return elText && elText.includes(searchText) && el.offsetParent !== null;
        });
        matches.sort((a, b) => a.textContent.length - b.textContent.length);
        return matches[0];
      }, text);
    }

    if (!elementHandle || !elementHandle.asElement()) {
      return {
        success: false,
        error: selector ? `Element not found: ${selector}` : `Element with text "${text}" not found`
      };
    }

    // Scroll element into view and click
    await page.evaluate(el => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), elementHandle);
    await new Promise(r => setTimeout(r, 300)); // Brief delay after scroll
    
    await elementHandle.click();
    
    if (returnHtml) {
      // Wait for page to stabilize (handles both navigation and SPA content updates)
      // This ensures content is fully loaded before returning, just like fetch_webpage does
      await waitForPageStability(page);
      
      const currentUrl = page.url();
      const html = await extractAndProcessHtml(page, removeUnnecessaryHTML);
      
      return {
        success: true,
        message: selector ? `Clicked element: ${selector}` : `Clicked element with text: "${text}"`,
        url: currentUrl,
        html,
        clicked: selector || `text:"${text}"`
      };
    } else {
      // Fast click for form interactions - minimal wait
      await new Promise(r => setTimeout(r, 300));
      const currentUrl = page.url();
      
      return {
        success: true,
        message: selector ? `Clicked element: ${selector}` : `Clicked element with text: "${text}"`,
        currentUrl,
        clicked: selector || `text:"${text}"`
      };
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to click element: ${err.message}`
    };
  }
}
