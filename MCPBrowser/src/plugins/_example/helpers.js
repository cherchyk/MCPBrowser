import { MCPResponse } from '../../core/responses.js';

export class ExampleActionResponse extends MCPResponse {
  constructor(data, summary, nextSteps = []) {
    super(nextSteps);
    this.data = data;
    this.summary = summary;
  }

  _getAdditionalFields() {
    return { data: this.data };
  }

  getTextSummary() {
    return this.summary;
  }
}

export function validateLimit(value) {
  const limit = value ?? 10;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('limit must be an integer between 1 and 100');
  }
  return limit;
}
