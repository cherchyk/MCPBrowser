/**
 * Authentication flow handling for MCPBrowser
 */

import logger from './logger.js';

// Consider user active on the login page if they interacted within this window (ms)
const INTERACTION_RECENT_MS = 15000;
// Emit a periodic log while we keep waiting due to user activity (ms)
const INTERACTION_LOG_INTERVAL_MS = 60000;

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
// AUTH WAITING
// ============================================================================

/**
 * Wait for authentication to complete. Two-phase approach:
 * 1. Quick SSO/cookie check (5s, fast poll) — handles auto-auth
 * 2. Manual auth with login page detection (10-20 min, slow poll)
 *
 * @param {Page} page - The Puppeteer page instance
 * @returns {Promise<{success: boolean, hostname?: string, error?: string, hint?: string}>}
 */
export async function waitForAuth(page) {
  await ensureInteractionTracker(page);

  // Phase 1: Quick SSO/cookie check (5s)
  logger.info('Checking for auto-authentication (5s)...');
  const auto = await pollUntilAuthDone(page, 5000, 500);
  if (auto.success) {
    logger.info(`Auto-authentication successful: ${page.url()}`);
    return auto;
  }

  // Phase 2: Manual auth — detect login page to pick timeout
  const { isLoginPage } = await detectLoginPage(page);
  const timeout = isLoginPage ? 1200000 : 600000; // 20 min for login pages, 10 min otherwise
  const timeoutMinutes = Math.round(timeout / 60000);

  if (isLoginPage) {
    logger.info(`Login page detected: ${page.url()}`);
  }
  logger.info(`Waiting for manual authentication (${timeoutMinutes} min timeout)...`);

  const result = await pollUntilAuthDone(page, timeout, 2000);
  if (result.success) {
    logger.info(`Manual authentication successful: ${page.url()}`);
  }
  return result;
}

/**
 * Poll page.url() until it leaves an auth URL, or timeout.
 * @param {Page} page - The Puppeteer page instance
 * @param {number} timeout - Max wait in ms
 * @param {number} interval - Poll interval in ms
 * @returns {Promise<{success: boolean, hostname?: string, error?: string, hint?: string}>}
 */
export async function pollUntilAuthDone(page, timeout, interval) {
  const deadline = Date.now() + timeout;
  let lastInteractionLog = 0;

  while (Date.now() < deadline) {
    try {
      const url = page.url();
      if (!isLikelyAuthUrl(url)) {
        return { success: true, hostname: new URL(url).hostname };
      }

      // If user is actively interacting (typing/clicking), keep waiting without logging noise
      const recentInteraction = await hasRecentInteraction(page);
      if (recentInteraction) {
        const now = Date.now();
        if (now - lastInteractionLog >= INTERACTION_LOG_INTERVAL_MS) {
          const waitedMs = now + interval - (deadline - timeout); // elapsed since start of this poll
          const waitedSeconds = Math.round(waitedMs / 1000);
          logger.info(`User activity detected on auth page; waiting for user to finish... (waited ~${waitedSeconds}s)`);
          lastInteractionLog = now;
        }
        await new Promise(r => setTimeout(r, interval));
        continue;
      }
    } catch {
      // Page not accessible — keep waiting
    }
    await new Promise(r => setTimeout(r, interval));
  }

  const currentUrl = (() => { try { return page.url(); } catch { return 'unknown'; } })();
  const minutes = Math.round(timeout / 60000);
  return {
    success: false,
    error: `Authentication timeout after ${minutes} minutes`,
    hint: `Tab is left open at ${currentUrl}. Complete authentication and retry.`
  };
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
    return await page.evaluate(() => {
      const indicators = [];

      if (document.querySelectorAll('input[type="password"]').length > 0)
        indicators.push('password field');

      if (document.querySelectorAll(
        'input[type="email"], input[name*="user"], input[name*="email"], input[name*="login"], input[id*="user"], input[id*="email"]'
      ).length > 0)
        indicators.push('username/email field');

      const loginBtn = Array.from(document.querySelectorAll('button, input[type="submit"]'))
        .some(btn => /sign in|log in|login|submit|continue/i.test(btn.textContent || btn.value || ''));
      if (loginBtn) indicators.push('login button');

      if (document.querySelectorAll('form[id*="login"], form[id*="signin"], form[class*="login"], form[class*="signin"]').length > 0)
        indicators.push('login form');

      const title = document.title.toLowerCase();
      if (title.includes('sign in') || title.includes('log in') || title.includes('login'))
        indicators.push('login page title');

      return { isLoginPage: indicators.length >= 2, indicators };
    });
  } catch {
    return { isLoginPage: false, indicators: [] };
  }
}

// ============================================================================
// USER INTERACTION TRACKING
// ============================================================================

/**
 * Inject lightweight listeners to record recent user interaction on the page.
 * Stored on window.__mcpAuthLastInteraction.
 */
async function ensureInteractionTracker(page) {
  try {
    await page.evaluate(() => {
      if (window.__mcpAuthTrackerInstalled) return;
      const updateInteraction = () => { window.__mcpAuthLastInteraction = Date.now(); };
      ['pointerdown', 'keydown', 'input', 'paste'].forEach(evt => {
        window.addEventListener(evt, updateInteraction, { capture: true, passive: true });
      });
      window.__mcpAuthTrackerInstalled = true;
    });
  } catch {
    // best effort
  }
}

/**
 * Check if user interacted with the page recently.
 * @param {Page} page
 * @returns {Promise<boolean>}
 */
async function hasRecentInteraction(page) {
  try {
    const last = await page.evaluate(() => window.__mcpAuthLastInteraction || 0);
    return last > 0 && (Date.now() - last) < INTERACTION_RECENT_MS;
  } catch {
    return false;
  }
}
