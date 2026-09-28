import {
  ErrorResponse,
  HttpStatusResponse,
  InformationalResponse,
  MCPResponse,
} from './responses.js';

/**
 * Shared action contract for core tools and plugin actions.
 *
 * @template {MCPResponse} TResponse
 */
export class Action {
  /**
   * @param {object} definition
   * @param {object} definition.tool
   * @param {new (...args: any[]) => TResponse} definition.response
   * @param {(...args: any[]) => TResponse | Promise<TResponse>} definition.handler
   */
  constructor({ tool, response, handler }) {
    if (!tool || typeof tool !== 'object') {
      throw new TypeError('Action tool must be an object');
    }
    if (typeof tool.name !== 'string' || tool.name.length === 0) {
      throw new TypeError('Action tool.name must be a non-empty string');
    }
    if (
      typeof response !== 'function' ||
      (response !== MCPResponse && !(response.prototype instanceof MCPResponse))
    ) {
      throw new TypeError(`Action "${tool.name}" response must extend MCPResponse`);
    }
    if (typeof handler !== 'function') {
      throw new TypeError(`Action "${tool.name}" handler must be a function`);
    }

    Object.defineProperty(this, 'id', {
      value: tool.name,
      enumerable: true,
      writable: false,
      configurable: false,
    });
    this.tool = tool;
    this.response = response;
    this.handler = handler;
    this.execute = this.execute.bind(this);
  }

  /**
   * Execute the action and enforce the common response contract.
   * @param {...any} args
   * @returns {TResponse | Promise<TResponse>}
   */
  execute(...args) {
    const result = this.handler(...args);
    if (result && typeof result.then === 'function') {
      return result.then((response) => this._validateResponse(response));
    }
    return this._validateResponse(result);
  }

  /**
   * @param {unknown} response
   * @returns {TResponse}
   * @protected
   */
  _validateResponse(response) {
    if (!(response instanceof MCPResponse)) {
      throw new TypeError(`Action "${this.tool.name}" must return an MCPResponse`);
    }
    const isStandardAlternative =
      response instanceof ErrorResponse ||
      response instanceof InformationalResponse ||
      response instanceof HttpStatusResponse;
    if (
      this.response !== MCPResponse &&
      !(response instanceof this.response) &&
      !isStandardAlternative
    ) {
      throw new TypeError(
        `Action "${this.tool.name}" must return ${this.response.name} or a standard alternative response`,
      );
    }
    return /** @type {TResponse} */ (response);
  }
}

/**
 * An action exposed directly as an MCP tool.
 *
 * @template {MCPResponse} TResponse
 * @extends {Action<TResponse>}
 */
export class CoreAction extends Action {
  /**
   * @param {object} definition
   * @param {import('@modelcontextprotocol/sdk/types.js').Tool} definition.tool
   * @param {new (...args: any[]) => TResponse} definition.response
   * @param {(params: object) => TResponse | Promise<TResponse>} definition.handler
   * @param {object|object[]} [definition.cli]
   */
  constructor(definition) {
    super(definition);
    if (!definition.tool.inputSchema || definition.tool.inputSchema.type !== 'object') {
      throw new TypeError(
        `Core action "${definition.tool.name}" must define an object inputSchema`,
      );
    }
    if (definition.cli !== undefined) {
      const cliDefinitions = Array.isArray(definition.cli) ? definition.cli : [definition.cli];
      if (
        cliDefinitions.length === 0 ||
        cliDefinitions.some((cli) => !cli || typeof cli !== 'object')
      ) {
        throw new TypeError(
          `Core action "${definition.tool.name}" cli must contain command definitions`,
        );
      }
      if (cliDefinitions.some((cli) => typeof cli.cmd !== 'string' || cli.cmd.length === 0)) {
        throw new TypeError(
          `Core action "${definition.tool.name}" cli commands must have a non-empty cmd`,
        );
      }
    }
    this.cli = definition.cli ?? null;
  }
}

/**
 * A site-specific action dispatched through browser_plugin_action.
 *
 * @template {MCPResponse} TResponse
 * @extends {Action<TResponse>}
 */
export class PluginAction extends Action {
  /**
   * @param {object} definition
   * @param {string} definition.name
   * @param {string} definition.description
   * @param {Array<object>} definition.params
   * @param {new (...args: any[]) => TResponse} definition.response
   * @param {(context: {page: object, params: object}) => TResponse | Promise<TResponse>} definition.handler
   */
  constructor({ name, description, params, response, handler }) {
    if (typeof description !== 'string' || description.length === 0) {
      throw new TypeError(`Plugin action "${name || '?'}" description must be a non-empty string`);
    }
    if (!Array.isArray(params)) {
      throw new TypeError(`Plugin action "${name || '?'}" params must be an array`);
    }

    super({
      tool: {
        name,
        description,
        inputSchema: paramsToInputSchema(params),
        outputSchema: {
          type: 'object',
          properties: {
            nextSteps: { type: 'array', items: { type: 'string' } },
          },
          required: ['nextSteps'],
          additionalProperties: true,
        },
      },
      response,
      handler,
    });

    this.params = params;
  }

  get name() {
    return this.tool.name;
  }

  get description() {
    return this.tool.description;
  }

  toInfo() {
    return {
      name: this.name,
      description: this.description,
      params: this.params,
      inputSchema: this.tool.inputSchema,
      outputSchema: this.tool.outputSchema,
    };
  }
}

/**
 * Convert plugin parameter metadata to the JSON Schema used by the shared contract.
 * @param {Array<object>} params
 * @returns {object}
 */
function paramsToInputSchema(params) {
  const properties = {};
  const required = [];

  for (const param of params) {
    if (!param || typeof param.name !== 'string' || param.name.length === 0) {
      throw new TypeError('Plugin action parameter name must be a non-empty string');
    }
    if (typeof param.type !== 'string' || param.type.length === 0) {
      throw new TypeError(
        `Plugin action parameter "${param.name}" type must be a non-empty string`,
      );
    }

    properties[param.name] = {
      type: param.type,
      ...(param.description ? { description: param.description } : {}),
      ...(param.default !== undefined ? { default: param.default } : {}),
    };
    if (param.required === true) {
      required.push(param.name);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
    additionalProperties: false,
  };
}

/**
 * Define a set of plugin actions that share a response class.
 * @template {MCPResponse} TResponse
 * @param {new (...args: any[]) => TResponse} response
 * @param {Array<{name: string, description: string, params: Array<object>, execute: Function}>} definitions
 * @returns {Array<PluginAction<TResponse>>}
 */
export function definePluginActions(response, definitions) {
  if (!Array.isArray(definitions)) {
    throw new TypeError('Plugin action definitions must be an array');
  }
  return definitions.map(
    ({ name, description, params, execute }) =>
      new PluginAction({
        name,
        description,
        params,
        response,
        handler: execute,
      }),
  );
}
