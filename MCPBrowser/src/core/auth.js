/**
 * Authentication flow handling for MCPBrowser
 */

import { getBaseDomain } from '../utils.js';

// ============================================================================
// AUTH URL DETECTION
// ============================================================================

/**
 * Detect if URL contains authentication patterns
 * @param {string} url - The URL to check
 * @returns {boolean} True if URL appears to be auth-related
 */
export function isLikelyAuthUrl(url) {
  const lowerUrl = url.toLowerCase();
  
  // Path-based patterns (more strict - require / boundaries or end of path)
  const pathPatterns = [
    '/login', '/signin', '/sign-in', '/auth', '/sso', '/oauth', 
    '/authenticate', '/saml', '/openid'
  ];
  
  // Subdomain patterns (require as subdomain at start)
  const subdomainPatterns = [
    'login.', 'auth.', 'sso.', 'accounts.', 'id.', 'identity.',
    'signin.', 'authentication.', 'idp.'
  ];
  
  // Extract path from URL
  let pathname = '';
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    // If URL parsing fails, check if any pattern exists in the string
    pathname = lowerUrl;
  }
  
  // Check path patterns - ensure they're at path boundaries
  const hasAuthPath = pathPatterns.some(pattern => {
    // Check if pattern appears at start of path, followed by nothing, /, ?, or #
    return pathname === pattern || 
           pathname.startsWith(pattern + '/') ||
           pathname.startsWith(pattern + '?') ||
           lowerUrl.includes(pattern + '#');
  });
  
  // Check subdomain patterns (must be at start of hostname)
  const hostname = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return '';
    }
  })();
  const hasAuthSubdomain = subdomainPatterns.some(pattern => hostname.startsWith(pattern));
  
  return hasAuthPath || hasAuthSubdomain;
}

// ============================================================================
// TIMEOUTS
// ============================================================================

const DEFAULT_AUTO_AUTH_TIMEOUT = 5000;     // 5 seconds for auto-auth check
const DEFAULT_MANUAL_AUTH_TIMEOUT = 600000; // 10 minutes for manual auth

// ============================================================================
// REDIRECT DETECTION
// ============================================================================

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
 * Waits to see if the browser automatically completes auth (e.g., SSO with existing session).
 * @param {Page} page - The Puppeteer page instance
 * @param {number} timeoutMs - How long to wait for auto-auth
 * @returns {Promise<Object>} Object with success status and final hostname
 */
export async function waitForAutoAuth(page, timeoutMs = DEFAULT_AUTO_AUTH_TIMEOUT) {
  console.error(`[MCPBrowser] Checking for auto-authentication (${timeoutMs / 1000} sec)...`);
  
  const deadline = Date.now() + timeoutMs;
  
  while (Date.now() < deadline) {
    try {
      const checkUrl = page.url();
      
      // Auth complete when we leave the auth page
      // Browser handles redirects - we just need to detect when auth flow ends
      if (!isLikelyAuthUrl(checkUrl)) {
        const checkHostname = new URL(checkUrl).hostname;
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

// ============================================================================
// LOGIN PAGE DETECTION
// ============================================================================

/**
 * Detect if page appears to be a login page by analyzing page content.
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<{isLoginPage: boolean, indicators: string[]}>} Detection result with indicators found
 */
export async function detectLoginPage(page) {
  try {
    const result = await page.evaluate(() => {
      const indicators = [];
      
      // Check for password input fields
      const passwordFields = document.querySelectorAll('input[type="password"]');
      if (passwordFields.length > 0) {
        indicators.push('password field');
      }
      
      // Check for username/email fields near password fields
      const usernameFields = document.querySelectorAll(
        'input[type="email"], input[name*="user"], input[name*="email"], input[name*="login"], input[id*="user"], input[id*="email"]'
      );
      if (usernameFields.length > 0) {
        indicators.push('username/email field');
      }
      
      // Check for login-related buttons
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      const loginButtons = buttons.filter(btn => {
        const text = (btn.textContent || btn.value || '').toLowerCase();
        return text.includes('sign in') || text.includes('log in') || text.includes('login') || 
               text.includes('submit') || text.includes('continue');
      });
      if (loginButtons.length > 0) {
        indicators.push('login button');
      }
      
      // Check for common login form identifiers
      const forms = document.querySelectorAll('form[id*="login"], form[id*="signin"], form[class*="login"], form[class*="signin"]');
      if (forms.length > 0) {
        indicators.push('login form');
      }
      
      // Check page title
      const title = document.title.toLowerCase();
      if (title.includes('sign in') || title.includes('log in') || title.includes('login')) {
        indicators.push('login page title');
      }
      
      return {
        isLoginPage: indicators.length >= 2, // Require at least 2 indicators
        indicators
      };
    });
    
    return result;
  } catch (error) {
    // If page.evaluate fails (e.g., mock in tests), return safe default
    return { isLoginPage: false, indicators: [] };
  }
}

// ============================================================================
// MANUAL AUTH WITH STATUS CALLBACKS
// ============================================================================

const EXTENDED_LOGIN_TIMEOUT = 1200000; // 20 minutes when login page detected

/**
 * Wait for user to complete manual authentication.
 * Detects login pages and extends timeout, sends status updates via callback.
 * @param {Page} page - The Puppeteer page instance
 * @param {number} timeoutMs - Base timeout for manual auth
 * @param {Object} options - Optional settings
 * @param {Function} options.onStatusChange - Callback for status updates
 * @returns {Promise<Object>} Object with success status, final hostname, and optional error
 */
export async function waitForManualAuth(page, timeoutMs = DEFAULT_MANUAL_AUTH_TIMEOUT, options = {}) {
  const { onStatusChange } = options;
  
  // Detect if this is a login page requiring user input
  const loginDetection = await detectLoginPage(page);
  const isLoginPage = loginDetection.isLoginPage;
  
  // Extend timeout for login pages (user needs time to type credentials)
  const shouldExtendTimeout = isLoginPage && timeoutMs < EXTENDED_LOGIN_TIMEOUT;
  const effectiveTimeout = shouldExtendTimeout ? EXTENDED_LOGIN_TIMEOUT : timeoutMs;
  const effectiveTimeoutMinutes = Math.round(effectiveTimeout / 60000);
  
  // Log login page detection
  if (isLoginPage && shouldExtendTimeout) {
    console.error(`[MCPBrowser] 🔐 LOGIN PAGE DETECTED!`);
    console.error(`[MCPBrowser] Indicators found: ${loginDetection.indicators.join(', ')}`);
    console.error(`[MCPBrowser] Extended wait time to ${effectiveTimeoutMinutes} minutes for user authentication`);
  }
  
  console.error(`[MCPBrowser] Auto-authentication did not complete. Waiting for user...`);
  
  // Send initial waiting notification
  if (onStatusChange) {
    onStatusChange({
      status: 'waiting',
      message: isLoginPage
        ? `⏳ Waiting for you to complete authentication. Login page detected - take your time (${effectiveTimeoutMinutes} min timeout).`
        : `⏳ Waiting for authentication to complete (${effectiveTimeoutMinutes} min timeout)...`,
      isLoginPage,
      indicators: loginDetection.indicators,
      remainingSeconds: Math.round(effectiveTimeout / 1000),
      currentUrl: page.url()
    });
  }
  
  console.error(`[MCPBrowser] Waiting for user to complete authentication (${effectiveTimeoutMinutes} min timeout)...`);
  
  const deadline = Date.now() + effectiveTimeout;
  let lastStatusUpdate = Date.now();
  
  while (Date.now() < deadline) {
    try {
      const checkUrl = page.url();
      
      // Auth complete when we leave the auth page
      if (!isLikelyAuthUrl(checkUrl)) {
        const checkHostname = new URL(checkUrl).hostname;
        console.error(`[MCPBrowser] ✅ Authentication completed! Now at: ${checkUrl}`);
        
        if (onStatusChange) {
          onStatusChange({
            status: 'completed',
            message: `✅ Authentication completed!`,
            currentUrl: checkUrl
          });
        }
        
        return { success: true, hostname: checkHostname };
      }
      
      // Send periodic status updates (every 30 seconds)
      if (onStatusChange && Date.now() - lastStatusUpdate > 30000) {
        const remainingSeconds = Math.round((deadline - Date.now()) / 1000);
        onStatusChange({
          status: 'waiting',
          message: `⏳ Still waiting for authentication... (${Math.round(remainingSeconds / 60)} min remaining)`,
          remainingSeconds,
          currentUrl: checkUrl
        });
        lastStatusUpdate = Date.now();
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  const currentUrl = page.url();
  
  if (onStatusChange) {
    onStatusChange({
      status: 'timeout',
      message: `⚠️ Authentication timeout after ${effectiveTimeoutMinutes} minutes`,
      currentUrl
    });
  }
  
  return { 
    success: false, 
    error: `Authentication timeout after ${effectiveTimeoutMinutes} minutes`,
    hint: `Tab is left open at ${currentUrl}. Complete authentication and retry.`
  };
}
