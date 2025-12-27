/**
 * actions.js - Interactive page actions
 * Provides functions for clicking, typing, and inspecting interactive elements
 */

import { getBrowser } from './core/browser.js';
import { domainPages } from './core/browser.js';

/**
 * Click on an element on the page
 * @param {Object} params - Click parameters
 * @param {string} params.url - The URL of the page to interact with
 * @param {string} [params.selector] - CSS selector for the element to click
 * @param {string} [params.text] - Text content to search for (alternative to selector)
 * @param {number} [params.timeout=30000] - Maximum time to wait for element
 * @returns {Promise<Object>} Result object with success status and details
 */
export async function clickElement({ url, selector, text, timeout = 30000 }) {
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
      error: `No open page found for ${hostname}. Please fetch the page first using fetch_webpage_protected.`
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
    
    // Wait a bit for any navigation or JavaScript to execute
    await new Promise(r => setTimeout(r, 1000));
    
    const currentUrl = page.url();
    
    return {
      success: true,
      message: selector ? `Clicked element: ${selector}` : `Clicked element with text: "${text}"`,
      currentUrl,
      clicked: selector || `text:"${text}"`
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to click element: ${err.message}`
    };
  }
}

/**
 * Type text into an input field
 * @param {Object} params - Type parameters
 * @param {string} params.url - The URL of the page to interact with
 * @param {string} params.selector - CSS selector for the input element
 * @param {string} params.text - Text to type
 * @param {boolean} [params.clear=true] - Whether to clear existing text first
 * @param {number} [params.delay=50] - Delay between keystrokes in milliseconds
 * @param {number} [params.timeout=30000] - Maximum time to wait for element
 * @returns {Promise<Object>} Result object with success status and details
 */
export async function typeText({ url, selector, text, clear = true, delay = 50, timeout = 30000 }) {
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
    await page.waitForSelector(selector, { timeout, visible: true });
    
    if (clear) {
      await page.click(selector, { clickCount: 3 }); // Select all text
      await page.keyboard.press('Backspace');
    }
    
    await page.type(selector, String(text), { delay });
    
    return {
      success: true,
      message: `Typed text into: ${selector}`,
      selector,
      textLength: String(text).length
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to type text: ${err.message}`
    };
  }
}

/**
 * Get all interactive elements on the page
 * @param {Object} params - Parameters
 * @param {string} params.url - The URL of the page to inspect
 * @param {number} [params.limit=50] - Maximum number of elements to return
 * @returns {Promise<Object>} Result with list of interactive elements
 */
export async function getInteractiveElements({ url, limit = 50 }) {
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
      error: `No open page found for ${hostname}. Please fetch the page first using fetch_webpage_protected.`
    };
  }

  try {
    const elements = await page.evaluate((maxLimit) => {
      const interactiveSelectors = [
        'a[href]',
        'button',
        'input',
        'textarea',
        'select',
        '[onclick]',
        '[role="button"]',
        '[role="link"]',
        '[tabindex]'
      ];
      
      const foundElements = [];
      const seen = new Set();
      
      for (const selector of interactiveSelectors) {
        const elements = document.querySelectorAll(selector);
        
        for (const el of elements) {
          if (foundElements.length >= maxLimit) break;
          
          // Skip hidden elements
          if (el.offsetParent === null && !el.checkVisibility?.()) continue;
          
          // Create a unique key to avoid duplicates
          const rect = el.getBoundingClientRect();
          const key = `${el.tagName}-${rect.top}-${rect.left}`;
          if (seen.has(key)) continue;
          seen.add(key);
          
          const text = el.textContent?.trim().substring(0, 100) || '';
          const type = el.tagName.toLowerCase();
          
          // Generate a useful selector
          let suggestedSelector = '';
          if (el.id) {
            suggestedSelector = `#${el.id}`;
          } else if (el.className && typeof el.className === 'string') {
            const classes = el.className.split(' ').filter(c => c.trim()).slice(0, 2).join('.');
            if (classes) suggestedSelector = `${type}.${classes}`;
          } else {
            suggestedSelector = type;
          }
          
          foundElements.push({
            tag: type,
            text: text,
            selector: suggestedSelector,
            href: el.href || null,
            type: el.type || null,
            name: el.name || null,
            id: el.id || null,
            hasOnClick: el.hasAttribute('onclick'),
            role: el.getAttribute('role') || null
          });
        }
        
        if (foundElements.length >= maxLimit) break;
      }
      
      return foundElements;
    }, limit);

    return {
      success: true,
      count: elements.length,
      elements
    };
  } catch (err) {
    return {
      success: false,
      error: `Failed to get interactive elements: ${err.message}`
    };
  }
}

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
      error: `No open page found for ${hostname}. Please fetch the page first using fetch_webpage_protected.`
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
