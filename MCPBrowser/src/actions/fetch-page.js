/**
 * fetch.js - Main page fetching functionality
 * Handles web page fetching with authentication flows and tab reuse
 */

import { getBrowser, domainPages } from '../core/browser.js';
import { getOrCreatePage, navigateToUrl, extractAndProcessHtml, waitForPageStability } from '../core/page.js';
import { detectRedirectType, waitForAutoAuth, waitForManualAuth } from '../core/auth.js';

/**
 * Fetch a web page using Chrome browser, with support for authentication flows and tab reuse.
 * Reuses existing tabs per domain when possible. Handles authentication redirects by waiting
 * for user to complete login (up to 10 minutes). Processes HTML to remove unnecessary elements
 * and convert relative URLs to absolute.
 * @param {Object} params - Fetch parameters
 * @param {string} params.url - The URL to fetch
 * @param {boolean} [params.removeUnnecessaryHTML=true] - Whether to clean HTML (removes scripts, styles, etc.)
 * @returns {Promise<Object>} Result object with success status, URL, HTML content, or error details
 */
export async function fetchPage({ url, removeUnnecessaryHTML = true }) {
  // Hardcoded smart defaults - use 'domcontentloaded' for fastest loading
  // (waits for HTML parsed, not all resources loaded - much faster for SPAs)
  const waitUntil = "domcontentloaded";
  const navigationTimeout = 30000;
  const authCompletionTimeout = 600000;
  const reuseLastKeptPage = true;
  
  if (!url) {
    throw new Error("url parameter is required");
  }

  // Parse hostname for domain-based tab reuse
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  const browser = await getBrowser();
  let page = null;
  
  try {
    // Get or create page for this domain
    page = await getOrCreatePage(browser, hostname, reuseLastKeptPage);
    
    // Navigate to URL with fallback strategy
    await navigateToUrl(page, url, waitUntil, navigationTimeout);
    
    const currentUrl = page.url();
    const currentHostname = new URL(currentUrl).hostname;
    console.error(`[MCPBrowser] Navigation completed: ${currentUrl}`);
    
    // Detect redirect type and handle accordingly
    const redirectInfo = detectRedirectType(url, hostname, currentUrl, currentHostname);
    
    if (redirectInfo.type === 'requested_auth') {
      console.error(`[MCPBrowser] User requested auth page directly, returning content`);
      // Update domain mapping if needed
      if (redirectInfo.currentHostname !== hostname) {
        domainPages.delete(hostname);
        domainPages.set(redirectInfo.currentHostname, page);
        hostname = redirectInfo.currentHostname;
      }
    } else if (redirectInfo.type === 'permanent') {
      console.error(`[MCPBrowser] Permanent redirect detected: ${hostname} → ${redirectInfo.currentHostname}`);
      console.error(`[MCPBrowser] Accepting redirect and updating domain mapping`);
      domainPages.delete(hostname);
      domainPages.set(redirectInfo.currentHostname, page);
      hostname = redirectInfo.currentHostname;
    } else if (redirectInfo.type === 'auth') {
      console.error(`[MCPBrowser] Authentication flow detected (${redirectInfo.flowType})`);
      console.error(`[MCPBrowser] Current location: ${redirectInfo.currentUrl}`);
      
      // Try auto-auth first
      const autoAuthResult = await waitForAutoAuth(page, redirectInfo.hostname, redirectInfo.originalBase);
      
      if (autoAuthResult.success) {
        // Update hostname if changed
        if (autoAuthResult.hostname !== hostname) {
          domainPages.delete(hostname);
          domainPages.set(autoAuthResult.hostname, page);
          hostname = autoAuthResult.hostname;
        }
      } else {
        // Wait for manual auth
        const manualAuthResult = await waitForManualAuth(page, redirectInfo.hostname, redirectInfo.originalBase, authCompletionTimeout);
        
        if (!manualAuthResult.success) {
          return { 
            success: false, 
            error: manualAuthResult.error, 
            pageKeptOpen: true, 
            hint: manualAuthResult.hint 
          };
        }
        
        // Update hostname if changed
        if (manualAuthResult.hostname !== hostname) {
          domainPages.delete(hostname);
          domainPages.set(manualAuthResult.hostname, page);
          hostname = manualAuthResult.hostname;
        }
      }
      
      // Wait for page stability after auth
      await waitForPageStability(page);
    }
    
    // Extract and process HTML
    const processedHtml = await extractAndProcessHtml(page, removeUnnecessaryHTML);
    
    return { 
      success: true, 
      url: page.url(),
      html: processedHtml
    };
  } catch (err) {
    const hint = "Tab is left open. Complete sign-in there, then call fetch_webpage again with just the URL.";
    return { success: false, error: err.message || String(err), pageKeptOpen: true, hint };
  } finally {
    // Tab always stays open - domain-aware reuse handles cleanup
  }
}
