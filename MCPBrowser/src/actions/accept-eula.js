/**
 * accept-eula.js - Accept the End User License Agreement
 * This tool must be called before any other MCPBrowser tools can be used.
 */

import { MCPResponse } from '../core/responses.js';
import { acceptEula, isEulaAccepted, EULA_URL } from '../core/eula.js';
import logger from '../core/logger.js';

/**
 * @typedef {import('@modelcontextprotocol/sdk/types.js').Tool} Tool
 */

// ============================================================================
// EULA CHECK HELPER
// ============================================================================

/**
 * Check if EULA acceptance is required before executing a tool.
 * @param {string} toolName - The name of the tool being called
 * @returns {Object|null} MCP-formatted response if EULA not accepted, null if OK to proceed
 */
export function requireEulaAcceptance(toolName) {
  if (isEulaAccepted()) {
    return null;
  }
  
  logger.info(`Tool ${toolName} requested - EULA acceptance required`);
  return new EulaPendingResponse(
    EULA_URL,
    [],
    toolName
  ).toMcpFormat();
}

// ============================================================================
// RESPONSE CLASSES
// ============================================================================

/**
 * Response when EULA needs to be accepted (shown before acceptance)
 */
export class EulaPendingResponse extends MCPResponse {
  /**
   * @param {string} eulaUrl - URL to the EULA
   * @param {string[]} nextSteps - Suggested next actions
   * @param {string} [attemptedAction] - The tool the user tried to use (optional)
   */
  constructor(eulaUrl, nextSteps, attemptedAction = null) {
    super(nextSteps);
    
    if (typeof eulaUrl !== 'string') {
      throw new TypeError('eulaUrl must be a string');
    }
    
    this.eulaUrl = eulaUrl;
    this.accepted = false;
    this.attemptedAction = attemptedAction;
    this.requiresUserConfirmation = true;
  }

  _getAdditionalFields() {
    return {
      accepted: this.accepted,
      eulaUrl: this.eulaUrl,
      requiresUserConfirmation: this.requiresUserConfirmation,
      ...(this.attemptedAction && { attemptedAction: this.attemptedAction })
    };
  }

  getTextSummary() {
    return `STOP - EXPLICIT USER CONFIRMATION REQUIRED !!!

Use ask questions tool to show a Yes/No options asking the user: "Do you accept the MCPBrowser EULA at ${this.eulaUrl}?"

DO NOT call accept_eula until the user explicitly selects "Yes".
If the user selects "No" or does not respond, DO NOT proceed.

When calling accept_eula, you MUST set userExplicitlyConfirmed=true ONLY if user said Yes.`;
  }
}

/**
 * Response for successful EULA acceptance
 */
export class EulaAcceptedResponse extends MCPResponse {
  /**
   * @param {string} eulaUrl - URL to the EULA that was accepted
   * @param {string[]} nextSteps - Suggested next actions
   */
  constructor(eulaUrl, nextSteps) {
    super(nextSteps);
    
    if (typeof eulaUrl !== 'string') {
      throw new TypeError('eulaUrl must be a string');
    }
    
    this.eulaUrl = eulaUrl;
    this.accepted = true;
  }

  _getAdditionalFields() {
    return {
      accepted: this.accepted,
      eulaUrl: this.eulaUrl
    };
  }

  getTextSummary() {
    return `EULA accepted (${this.eulaUrl}). You now have full access to MCPBrowser tools.`;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

/**
 * @type {Tool}
 */
export const ACCEPT_EULA_TOOL = {
  name: "accept_eula",
  description: "CRITICAL: You MUST ask the user 'Do you accept the MCPBrowser EULA?' and wait for their explicit 'Yes' response BEFORE calling this tool. Set userExplicitlyConfirmed=true ONLY if the user explicitly said 'Yes' or 'I accept'. If the user has not responded or said 'No', DO NOT call this tool. Calling this tool without user consent violates the EULA terms.",
  inputSchema: {
    type: "object",
    properties: {
      userExplicitlyConfirmed: {
        type: "boolean",
        description: "REQUIRED: Must be true. Set to true ONLY if the user explicitly said 'Yes' or 'I accept' to the EULA prompt. Never set to true without explicit user confirmation."
      }
    },
    required: ["userExplicitlyConfirmed"]
  }
};

// ============================================================================
// TOOL IMPLEMENTATION
// ============================================================================

/**
 * Handle EULA acceptance
 * @param {Object} args - Tool arguments
 * @param {boolean} args.userExplicitlyConfirmed - Whether user explicitly confirmed acceptance
 * @returns {Promise<MCPResponse>} Response indicating EULA status
 */
export async function handleAcceptEula(args) {
  const { userExplicitlyConfirmed } = args;
  
  logger.debug(`accept_eula called with userExplicitlyConfirmed: ${userExplicitlyConfirmed}`);
  
  // If already accepted and calling again, just confirm
  if (isEulaAccepted()) {
    logger.info('EULA already accepted');
    return new EulaAcceptedResponse(
      EULA_URL,
      [
        'Use fetch_webpage to navigate to a URL',
        'Use get_current_html to see the current page content'
      ]
    );
  }
  
  // CRITICAL: Validate user explicitly confirmed
  if (userExplicitlyConfirmed !== true) {
    logger.warn('accept_eula called without userExplicitlyConfirmed=true - rejecting');
    return new EulaPendingResponse(
      EULA_URL,
      [
        'Ask the user: "Do you accept the MCPBrowser EULA?"',
        'Wait for explicit "Yes" response',
        'Then call accept_eula with userExplicitlyConfirmed=true'
      ]
    );
  }
  
  // Accept the EULA
  acceptEula(EULA_URL);
  logger.info('EULA accepted with explicit user confirmation');
  
  return new EulaAcceptedResponse(
    EULA_URL,
    [
      'Use fetch_webpage to navigate to a URL',
      'Use click_element to interact with page elements',
      'Use type_text to enter text into forms'
    ]
  );
}
