/**
 * Base Response Classes for MCPBrowser
 * Defines base response types that all tool-specific responses extend.
 * Tool-specific response classes are defined in their respective action files.
 * 
 * Note: Per MCP spec, success/error is indicated by the isError flag at protocol level,
 * not in structuredContent. Response classes contain only data fields.
 */

// ============================================================================
// BASE RESPONSE CLASSES
// ============================================================================

/**
 * Base class for all successful MCP tool responses
 * Contains only data fields - success/error indicated by isError at protocol level
 */
export class MCPResponse {
  /**
   * @param {string[]} nextSteps - Array of suggested next actions
   */
  constructor(nextSteps = []) {
    if (!Array.isArray(nextSteps)) {
      throw new TypeError('nextSteps must be an array');
    }
    if (!nextSteps.every(step => typeof step === 'string')) {
      throw new TypeError('All nextSteps must be strings');
    }
    
    this.nextSteps = nextSteps;
  }

  /**
   * Converts the response to a plain object for JSON serialization
   * @returns {Object}
   */
  toJSON() {
    return {
      nextSteps: this.nextSteps,
      ...this._getAdditionalFields()
    };
  }

  /**
   * Formats this response into MCP-compliant protocol response
   * Per MCP spec:
   * - Success responses have structuredContent (validated against outputSchema)
   * - Error responses have text content only, no structuredContent
   * - isError flag indicates success/error at protocol level
   * @returns {Object} MCP-compliant response with content, isError, and optionally structuredContent
   */
  toMcpFormat() {
    const structured = this.toJSON();
    return {
      content: [
        {
          type: "text",
          text: this.getTextSummary()
        },
        {
          // Per MCP spec (2025-11-25): a tool returning structured content SHOULD
          // also return the serialized JSON in a TextContent block, so clients
          // that do not consume structuredContent still receive the full data.
          type: "text",
          text: JSON.stringify(structured)
        }
      ],
      isError: false,
      structuredContent: structured
    };
  }

  /**
   * Generate human-readable text summary for this response
   * Subclasses should override this to provide tool-specific summaries
   * @returns {string}
   */
  getTextSummary() {
    return "Operation completed successfully";
  }

  /**
   * Override this in subclasses to add specific fields
   * @protected
   * @returns {Object}
   */
  _getAdditionalFields() {
    return {};
  }
}

/**
 * Response for informational/soft-failure scenarios
 * Used when an operation cannot proceed but it's not a hard error
 * Examples: prerequisite not met, resource doesn't exist yet, user action needed
 * Shows as normal response (not red) while conveying the situation
 */
export class InformationalResponse extends MCPResponse {
  /**
   * @param {string} message - Informational message explaining the situation
   * @param {string} reason - Why the operation couldn't proceed
   * @param {string[]} nextSteps - Suggested actions to resolve the situation
   */
  constructor(message, reason, nextSteps = []) {
    super(nextSteps);
    if (typeof message !== 'string') {
      throw new TypeError('message must be a string');
    }
    if (typeof reason !== 'string') {
      throw new TypeError('reason must be a string');
    }
    
    this.message = message;
    this.reason = reason;
  }

  /**
   * @protected
   * @returns {Object}
   */
  _getAdditionalFields() {
    return {
      message: this.message,
      reason: this.reason,
      status: 'action_required'
    };
  }

  /**
   * @returns {string}
   */
  getTextSummary() {
    let summary = `${this.message}\n\nReason: ${this.reason}`;
    if (this.nextSteps && this.nextSteps.length > 0) {
      summary += `\n\nSuggested actions:\n${this.nextSteps.map(s => `- ${s}`).join('\n')}`;
    }
    return summary;
  }

  /**
   * Informational responses omit structuredContent to avoid schema violations —
   * their fields (message, reason, status) don't match tool-specific outputSchemas.
   * The serialized JSON is still provided as a text block for JSON-consuming
   * clients; per the MCP spec, structuredContent is validated only when present.
   * @returns {Object} MCP-compliant response with text content (no structuredContent)
   */
  toMcpFormat() {
    return {
      content: [
        {
          type: "text",
          text: this.getTextSummary()
        },
        {
          type: "text",
          text: JSON.stringify(this.toJSON())
        }
      ],
      isError: false
    };
  }
}

/**
 * HTTP status code descriptions for common codes
 */
const HTTP_STATUS_DESCRIPTIONS = {
  // 4xx Client Errors
  400: 'Bad Request - The server could not understand the request',
  401: 'Unauthorized - Authentication is required',
  403: 'Forbidden - Access to this resource is denied',
  404: 'Not Found - The requested page does not exist',
  405: 'Method Not Allowed - The HTTP method is not supported',
  408: 'Request Timeout - The server timed out waiting for the request',
  410: 'Gone - The resource has been permanently removed',
  429: 'Too Many Requests - Rate limit exceeded',
  451: 'Unavailable For Legal Reasons - Access blocked for legal reasons',
  
  // 5xx Server Errors
  500: 'Internal Server Error - The server encountered an error',
  501: 'Not Implemented - The server does not support this functionality',
  502: 'Bad Gateway - Invalid response from upstream server',
  503: 'Service Unavailable - The server is temporarily unavailable',
  504: 'Gateway Timeout - Upstream server did not respond in time',
  520: 'Web Server Returned Unknown Error',
  521: 'Web Server Is Down',
  522: 'Connection Timed Out',
  523: 'Origin Is Unreachable',
  524: 'A Timeout Occurred'
};

/**
 * Get suggested next steps based on HTTP status code
 * @param {number} statusCode - The HTTP status code
 * @param {string} url - The URL that returned this status
 * @returns {string[]} Suggested next steps
 */
function getHttpStatusNextSteps(statusCode, url) {
  const baseSteps = ['Check if the URL is correct'];
  
  if (statusCode === 401 || statusCode === 403) {
    return [
      'Authentication may be required - try logging in first',
      'Check if you have permission to access this resource',
      "Use MCPBrowser's browser_fetch_webpage to navigate to the login page first"
    ];
  }
  
  if (statusCode === 404) {
    return [
      'Verify the URL is correct',
      'The page may have been moved or deleted',
      'Try navigating to the site\'s homepage instead'
    ];
  }
  
  if (statusCode === 429) {
    return [
      'Rate limit exceeded - wait a few minutes before retrying',
      'Reduce request frequency',
      "Call MCPBrowser's browser_fetch_webpage again after waiting"
    ];
  }
  
  if (statusCode >= 500 && statusCode < 600) {
    return [
      'The server is experiencing issues',
      "Wait a moment and try again with MCPBrowser's browser_fetch_webpage",
      'Check if the service has a status page for outages'
    ];
  }
  
  return [
    ...baseSteps,
    'Try again later if this is a temporary issue',
    "Call MCPBrowser's browser_fetch_webpage to retry the request"
  ];
}

/**
 * Response for HTTP status codes (4xx, 5xx)
 * NOT shown as an error (not red) - these are valid HTTP responses, not MCP failures
 * The server responded correctly, just not with a 2xx success code
 */
export class HttpStatusResponse extends MCPResponse {
  /**
   * @param {string} url - The URL that was requested
   * @param {number} statusCode - The HTTP status code
   * @param {string} statusText - The HTTP status text
   * @param {string} html - Any HTML content returned (may be error page)
   * @param {string[]} [nextSteps] - Optional custom next steps (auto-generated if not provided)
   */
  constructor(url, statusCode, statusText, html, nextSteps = null) {
    const autoNextSteps = nextSteps || getHttpStatusNextSteps(statusCode, url);
    super(autoNextSteps);
    
    if (typeof url !== 'string') {
      throw new TypeError('url must be a string');
    }
    if (typeof statusCode !== 'number') {
      throw new TypeError('statusCode must be a number');
    }
    if (typeof statusText !== 'string') {
      throw new TypeError('statusText must be a string');
    }
    if (typeof html !== 'string') {
      throw new TypeError('html must be a string');
    }
    
    this.url = url;
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.html = html;
    this.statusCategory = statusCode >= 500 ? 'server_error' : 'client_error';
    this.description = HTTP_STATUS_DESCRIPTIONS[statusCode] || statusText;
  }

  /**
   * @protected
   * @returns {Object}
   */
  _getAdditionalFields() {
    return {
      url: this.url,
      statusCode: this.statusCode,
      statusText: this.statusText,
      statusCategory: this.statusCategory,
      description: this.description,
      html: this.html
    };
  }

  /**
   * @returns {string}
   */
  getTextSummary() {
    let summary = `HTTP ${this.statusCode} ${this.statusText}\n`;
    summary += `URL: ${this.url}\n`;
    summary += `\n${this.description}`;
    
    if (this.nextSteps && this.nextSteps.length > 0) {
      summary += `\n\nSuggested actions:\n${this.nextSteps.map(s => `- ${s}`).join('\n')}`;
    }
    return summary;
  }

  /**
   * HTTP status responses omit structuredContent to avoid schema violations —
   * their fields (url, statusCode, etc.) don't match tool-specific outputSchemas.
   * The serialized JSON is still provided as a text block for JSON-consuming
   * clients; per the MCP spec, structuredContent is validated only when present.
   * @returns {Object} MCP-compliant response with text content (no structuredContent)
   */
  toMcpFormat() {
    return {
      content: [
        {
          type: "text",
          text: this.getTextSummary()
        },
        {
          type: "text",
          text: JSON.stringify(this.toJSON())
        }
      ],
      isError: false
    };
  }
}

/**
 * Response for failed operations (any tool)
 * Per MCP spec, errors use text content only, no structuredContent
 */
export class ErrorResponse {
  /**
   * @param {string} message - Error message
   * @param {string[]} nextSteps - Suggested recovery actions
   */
  constructor(message, nextSteps = []) {
    if (typeof message !== 'string') {
      throw new TypeError('message must be a string');
    }
    if (!Array.isArray(nextSteps)) {
      throw new TypeError('nextSteps must be an array');
    }
    if (!nextSteps.every(step => typeof step === 'string')) {
      throw new TypeError('All nextSteps must be strings');
    }
    
    this.message = message;
    this.nextSteps = nextSteps;
  }

  /**
   * Formats error response into MCP-compliant protocol response
   * Per MCP spec: errors have text content only, no structuredContent
   * @returns {Object} MCP-compliant error response
   */
  toMcpFormat() {
    let textSummary = `Error: ${this.message}`;
    if (this.nextSteps && this.nextSteps.length > 0) {
      textSummary += `\n\nSuggested actions:\n${this.nextSteps.map(s => `- ${s}`).join('\n')}`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: textSummary
        }
      ],
      isError: true
      // No structuredContent for errors per MCP spec
    };
  }
}
