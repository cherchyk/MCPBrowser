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
    return {
      content: [
        {
          type: "text",
          text: this.getTextSummary()
        }
      ],
      isError: false,
      structuredContent: this.toJSON()
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
