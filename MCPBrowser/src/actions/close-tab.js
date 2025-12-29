/**
 * Close a tab for a specific domain
 */

import { domainPages } from '../core/browser.js';

/**
 * Closes the browser tab for the given URL's hostname and removes it from the tab pool.
 * This forces a fresh session on the next visit to that hostname.
 * @param {object} params - Parameters
 * @param {string} params.url - The URL whose hostname tab should be closed
 * @returns {Promise<object>} Result indicating success or failure
 */
export async function closeTab({ url }) {
  try {
    // Validate URL
    if (!url || typeof url !== 'string') {
      return {
        success: false,
        error: 'Invalid or missing URL parameter'
      };
    }

    // Extract hostname from URL
    let hostname;
    try {
      hostname = new URL(url).hostname;
    } catch {
      return {
        success: false,
        error: 'Invalid URL format'
      };
    }
    
    // Check if we have a tab for this hostname
    if (!domainPages.has(hostname)) {
      // Hostname not found - try to find by actual page URL
      // This handles redirects where tab was created with original hostname
      // but now the page URL is different
      let foundHostname = null;
      for (const [key, page] of domainPages.entries()) {
        try {
          if (!page.isClosed() && page.url() === url) {
            foundHostname = key;
            break;
          }
        } catch {
          // Skip pages we can't access
        }
      }
      
      if (!foundHostname) {
        return {
          success: true,
          hostname,
          message: 'No open tab found for this hostname',
          alreadyClosed: true
        };
      }
      
      // Found the page by URL - use that hostname
      hostname = foundHostname;
    }

    // Get and close the page
    const page = domainPages.get(hostname);
    
    // Check if page is already closed
    if (page.isClosed()) {
      domainPages.delete(hostname);
      return {
        success: true,
        hostname,
        message: 'Tab was already closed',
        alreadyClosed: true
      };
    }

    // Close the page
    await page.close();
    
    // Remove from domain pool
    domainPages.delete(hostname);
    
    console.error(`[MCPBrowser] Closed tab for hostname: ${hostname}`);
    
    return {
      success: true,
      hostname,
      message: `Successfully closed tab for ${hostname}`
    };
    
  } catch (error) {
    console.error(`[MCPBrowser] Error closing tab:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}
