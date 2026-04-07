/**
 * search-emails.js — Search emails using Gmail's search functionality.
 *
 * Tier usage:
 *   T1: gmailNavigate to #search/<query>
 *   T4: EMAIL_ROW + NO_RESULTS selectors for result detection
 */

import { ErrorResponse } from '../../../core/responses.js';
import {
  checkPrecondition,
  gmailNavigate,
  waitForGmail,
  extractEmailRows,
  GmailActionResponse
} from '../helpers.js';
import { EMAIL_ROW, NO_RESULTS } from '../selectors.js';

/**
 * Search emails by query string.
 * @param {object} opts
 * @param {import('puppeteer-core').Page} opts.page
 * @param {object} opts.params
 * @param {string} opts.params.query - Gmail search query
 * @param {number} [opts.params.limit=25] - Maximum results to return
 * @returns {Promise<GmailActionResponse|ErrorResponse>}
 */
export async function searchEmails({ page, params }) {
  // Validate query
  if (!params.query || !params.query.trim()) {
    return new ErrorResponse(
      'Search query is required.',
      [
        'Provide a query string, e.g. search_emails({ query: "from:boss subject:urgent" })',
        'Use list_emails to browse without a search query'
      ]
    );
  }

  // Precondition: must be on Gmail
  const pre = await checkPrecondition(page, 'on_gmail');
  if (!pre.met) {
    return new ErrorResponse(pre.error, [
      pre.suggestion || "Use fetch_webpage({ url: 'https://mail.google.com' }) to open Gmail first."
    ]);
  }

  const query = params.query.trim();
  const limit = params.limit || 25;

  // T1: Navigate to search results
  await gmailNavigate(page, '#search/' + encodeURIComponent(query));

  // Wait for either email rows or no-results indicator
  let hasResults = true;
  try {
    await waitForGmail(page, EMAIL_ROW);
  } catch {
    // Check if no-results indicator is present instead
    const noResults = await page.$(NO_RESULTS);
    if (noResults) {
      hasResults = false;
    } else {
      // Neither rows nor no-results — re-throw the timeout
      throw new Error(
        `Gmail search did not return results within the timeout. ` +
        `Query: "${query}". The page may still be loading.`
      );
    }
  }

  if (!hasResults) {
    return new GmailActionResponse(
      { emails: [], query, resultCount: 0 },
      `No results found for "${query}".`,
      [
        'Try a different or broader search query',
        'Use list_emails to browse the inbox instead'
      ]
    );
  }

  // T3+T4: Extract search results
  const emails = await extractEmailRows(page, limit);

  return new GmailActionResponse(
    { emails, query, resultCount: emails.length },
    `Found ${emails.length} result(s) for "${query}".`,
    [
      'Use read_email to open a specific result',
      'Refine your search with Gmail search operators (from:, to:, subject:, has:attachment)',
      'Use list_emails to return to the inbox'
    ]
  );
}
