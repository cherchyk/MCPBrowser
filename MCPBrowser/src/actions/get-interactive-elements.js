/**
 * get-interactive.js - Get all interactive elements on a page
 */

import { getBrowser, domainPages } from '../core/browser.js';

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
      error: `No open page found for ${hostname}. Please fetch the page first using fetch_webpage.`
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
