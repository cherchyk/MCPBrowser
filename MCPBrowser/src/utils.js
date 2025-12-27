/**
 * Utility functions for MCPBrowser
 */

/**
 * Truncate a string to a maximum length, adding "... [truncated]" if truncated.
 * @param {string} str - The string to truncate
 * @param {number} max - Maximum length
 * @returns {string} The original or truncated string
 */
export function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? `${str.slice(0, max)}... [truncated]` : str;
}

/**
 * Extract base domain from hostname (e.g., "mail.google.com" → "google.com")
 * @param {string} hostname - The hostname to parse
 * @returns {string} The base domain
 */
export function getBaseDomain(hostname) {
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    return parts.slice(-2).join('.');
  }
  return hostname;
}

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
