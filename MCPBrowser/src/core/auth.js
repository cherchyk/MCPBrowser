/**
 * Authentication flow handling for MCPBrowser
 */

import { getBaseDomain, isLikelyAuthUrl } from '../utils.js';

/**
 * Detect redirect type: permanent redirect, auth flow, or same-domain auth path change.
 * @param {string} url - Original requested URL
 * @param {string} hostname - Original hostname
 * @param {string} currentUrl - Current page URL
 * @param {string} currentHostname - Current page hostname
 * @returns {Object} Object with redirect type and related info
 */
export function detectRedirectType(url, hostname, currentUrl, currentHostname) {
  const isDifferentDomain = currentHostname !== hostname;
  const requestedAuthPage = isLikelyAuthUrl(url);
  const currentIsAuthPage = isLikelyAuthUrl(currentUrl);
  const isSameDomainAuthPath = !isDifferentDomain && currentIsAuthPage && !requestedAuthPage;
  
  // If user requested auth page directly and landed on it (same domain), return content
  if (requestedAuthPage && currentHostname === hostname && !isDifferentDomain) {
    return { type: 'requested_auth', currentHostname };
  }
  
  // No redirect scenario
  if (!isDifferentDomain && !isSameDomainAuthPath) {
    return { type: 'none' };
  }
  
  const originalBase = getBaseDomain(hostname);
  const currentBase = getBaseDomain(currentHostname);
  
  // Permanent redirect: Different domain without auth patterns
  if (!currentIsAuthPage) {
    return { type: 'permanent', currentHostname };
  }
  
  // Authentication flow
  const flowType = isSameDomainAuthPath ? 'same-domain path change' : 'cross-domain redirect';
  return { 
    type: 'auth', 
    flowType, 
    originalBase, 
    currentBase, 
    currentUrl,
    hostname,
    currentHostname
  };
}

/**
 * Check if authentication auto-completes quickly (valid session/cookies).
 * @param {Page} page - The Puppeteer page instance
 * @param {string} hostname - Original hostname
 * @param {string} originalBase - Original base domain
 * @param {number} timeoutMs - How long to wait for auto-auth
 * @returns {Promise<Object>} Object with success status and final hostname
 */
export async function waitForAutoAuth(page, hostname, originalBase, timeoutMs = 5000) {
  console.error(`[MCPBrowser] Checking for auto-authentication (${timeoutMs / 1000} sec)...`);
  
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    try {
      const checkUrl = page.url();
      const checkHostname = new URL(checkUrl).hostname;
      const checkBase = getBaseDomain(checkHostname);
      
      // Extract root domain word (e.g., "google" from both "gmail.com" and "google.com")
      const getRoot = (domain) => domain.split('.')[0];
      const originalRoot = getRoot(originalBase);
      const checkRoot = getRoot(checkBase);
      
      // Check if returned to original domain/base or related domain
      const isRelatedDomain = checkHostname === hostname ||
                              checkBase === originalBase || 
                              (originalRoot === checkRoot && originalRoot.length > 3); // Avoid false positives
      
      if (isRelatedDomain && !isLikelyAuthUrl(checkUrl)) {
        console.error(`[MCPBrowser] Auto-authentication successful! Now at: ${checkUrl}`);
        return { success: true, hostname: checkHostname };
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return { success: false };
}

/**
 * Wait for user to complete manual authentication.
 * @param {Page} page - The Puppeteer page instance
 * @param {string} hostname - Original hostname
 * @param {string} originalBase - Original base domain
 * @param {number} timeoutMs - How long to wait for manual auth
 * @returns {Promise<Object>} Object with success status, final hostname, and optional error
 */
export async function waitForManualAuth(page, hostname, originalBase, timeoutMs = 600000) {
  console.error(`[MCPBrowser] Auto-authentication did not complete. Waiting for user...`);
  console.error(`[MCPBrowser] Will wait for return to ${hostname} or related domain under ${originalBase}`);
  
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    try {
      const checkUrl = page.url();
      const checkHostname = new URL(checkUrl).hostname;
      const checkBase = getBaseDomain(checkHostname);
      
      // Extract root domain word (e.g., "google" from both "gmail.com" and "google.com")
      const getRoot = (domain) => domain.split('.')[0];
      const originalRoot = getRoot(originalBase);
      const checkRoot = getRoot(checkBase);
      
      // Auth complete if:
      // 1. Exact hostname match, OR
      // 2. Same base domain (e.g., mail.google.com vs accounts.google.com), OR
      // 3. Related services sharing root (e.g., gmail.com vs google.com - both share "google")
      const isRelatedDomain = checkHostname === hostname ||
                              checkBase === originalBase || 
                              (originalRoot === checkRoot && originalRoot.length > 3); // Avoid false positives with short names
      
      if (isRelatedDomain && !isLikelyAuthUrl(checkUrl)) {
        console.error(`[MCPBrowser] Authentication completed! Now at: ${checkUrl}`);
        
        if (checkHostname !== hostname) {
          console.error(`[MCPBrowser] Landed on different subdomain: ${checkHostname}`);
        }
        
        return { success: true, hostname: checkHostname };
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const currentUrl = page.url();
  const hint = `Authentication timeout. Tab is left open at ${currentUrl}. Complete authentication and retry the same URL.`;
  return { 
    success: false, 
    error: "Authentication timeout - user did not complete login",
    hint 
  };
}
