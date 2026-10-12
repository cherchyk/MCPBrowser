import { PluginAction } from './actions.js';

export const CURRENT_PLUGIN_INTERFACE_VERSION = 2;

export class CorePlugin {
  /**
   * @param {object} definition
   * @param {object} definition.manifest
   * @param {(url: string, html: string) => {matched: boolean, confidence?: number}} definition.matchesPage
   * @param {PluginAction[]} definition.actions
   * @param {() => object} definition.getInfo
   */
  constructor({ manifest, matchesPage, actions, getInfo }) {
    validateManifest(manifest);
    if (typeof matchesPage !== 'function') {
      throw new TypeError(`Plugin "${manifest.name}" matchesPage must be a function`);
    }
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new TypeError(`Plugin "${manifest.name}" actions must be a non-empty array`);
    }
    if (typeof getInfo !== 'function') {
      throw new TypeError(`Plugin "${manifest.name}" getInfo must be a function`);
    }

    const actionNames = new Set();
    for (const action of actions) {
      if (!(action instanceof PluginAction)) {
        throw new TypeError(`Plugin "${manifest.name}" actions must be PluginAction instances`);
      }
      if (actionNames.has(action.name)) {
        throw new TypeError(`Plugin "${manifest.name}" has duplicate action "${action.name}"`);
      }
      actionNames.add(action.name);
    }

    Object.defineProperty(this, 'id', {
      value: manifest.name,
      enumerable: true,
      writable: false,
      configurable: false,
    });
    this.manifest = manifest;
    this.actions = actions;
    this.matchesPage = matchesPage;
    this.getInfo = getInfo;
  }

  getActions() {
    return this.actions;
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    throw new TypeError('Plugin manifest must be an object');
  }

  const requiredStrings = ['name', 'version', 'description'];
  for (const field of requiredStrings) {
    if (typeof manifest[field] !== 'string' || manifest[field].length === 0) {
      throw new TypeError(`Plugin manifest ${field} must be a non-empty string`);
    }
  }
  if (!Number.isInteger(manifest.interfaceVersion)) {
    throw new TypeError('Plugin manifest interfaceVersion must be an integer');
  }
  if (manifest.interfaceVersion !== CURRENT_PLUGIN_INTERFACE_VERSION) {
    throw new TypeError(
      `Plugin "${manifest.name}" interfaceVersion ${manifest.interfaceVersion} is not compatible (expected ${CURRENT_PLUGIN_INTERFACE_VERSION})`,
    );
  }
  if (!Array.isArray(manifest.urlPatterns) || manifest.urlPatterns.length === 0) {
    throw new TypeError(`Plugin "${manifest.name}" urlPatterns must be a non-empty array`);
  }
}
