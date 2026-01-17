/**
 * Base browser class for MCPBrowser
 * All browser implementations should extend this class
 */

export class BaseBrowser {
  constructor() {
    this.browser = null;
  }

  /**
   * Connect to the browser and return browser instance
   * Must be implemented by subclasses
   * @returns {Promise<{browser: Browser}>}
   */
  async connect() {
    throw new Error('connect() must be implemented by subclass');
  }

  /**
   * Disconnect from the browser
   * Must be implemented by subclasses
   * @returns {Promise<void>}
   */
  async disconnect() {
    throw new Error('disconnect() must be implemented by subclass');
  }

  /**
   * Get the browser type name
   * @returns {string}
   */
  getType() {
    return 'base';
  }

  /**
   * Check if this browser is available on the system
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return false;
  }

  /**
   * Check if browser uses CDP (Chrome DevTools Protocol)
   * @returns {boolean}
   */
  usesCDP() {
    return false;
  }
}
