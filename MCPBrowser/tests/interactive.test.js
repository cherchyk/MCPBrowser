import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { 
  clickElement, 
  typeText, 
  getInteractiveElements, 
  waitForElement,
  fetchPage,
  getBrowser,
  closeBrowser
} from '../src/mcp-browser.js';

/**
 * Tests for interactive browser functionality
 * These tests verify that the browser can interact with page elements
 * like clicking, typing, and waiting for elements.
 */

describe('Interactive Browser Functionality', () => {
  const testUrl = 'https://example.com';
  
  before(async () => {
    // Ensure we have a browser connection
    await getBrowser();
  });

  after(async () => {
    // Close browser connection to allow tests to exit
    await closeBrowser();
  });

  describe('clickElement', () => {
    it('should require url parameter', async () => {
      try {
        await clickElement({});
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.match(err.message, /url parameter is required/);
      }
    });

    it('should require either selector or text parameter', async () => {
      try {
        await clickElement({ url: testUrl });
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.match(err.message, /Either selector or text parameter is required/);
      }
    });

    it('should return error if page not loaded', async () => {
      const result = await clickElement({ 
        url: 'https://unloaded-domain-test.com', 
        selector: 'button' 
      });
      assert.strictEqual(result.success, false);
      assert.match(result.error, /No open page found/);
    });
  });

  describe('typeText', () => {
    it('should require url parameter', async () => {
      try {
        await typeText({});
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.match(err.message, /url parameter is required/);
      }
    });

    it('should require selector parameter', async () => {
      try {
        await typeText({ url: testUrl });
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.match(err.message, /selector parameter is required/);
      }
    });

    it('should require text parameter', async () => {
      try {
        await typeText({ url: testUrl, selector: 'input' });
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.match(err.message, /text parameter is required/);
      }
    });

    it('should return error if page not loaded', async () => {
      const result = await typeText({ 
        url: 'https://unloaded-domain-test.com', 
        selector: 'input',
        text: 'test' 
      });
      assert.strictEqual(result.success, false);
      assert.match(result.error, /No open page found/);
    });
  });

  describe('getInteractiveElements', () => {
    it('should require url parameter', async () => {
      try {
        await getInteractiveElements({});
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.match(err.message, /url parameter is required/);
      }
    });

    it('should return error if page not loaded', async () => {
      const result = await getInteractiveElements({ 
        url: 'https://unloaded-domain-test.com'
      });
      assert.strictEqual(result.success, false);
      assert.match(result.error, /No open page found/);
    });

    it('should respect limit parameter', async () => {
      // First fetch a page
      await fetchPage({ url: testUrl });
      
      const result = await getInteractiveElements({ 
        url: testUrl,
        limit: 5
      });
      
      if (result.success) {
        assert.ok(result.count <= 5, 'Should respect limit parameter');
        assert.ok(Array.isArray(result.elements), 'Should return elements array');
      }
    });
  });

  describe('waitForElement', () => {
    it('should require url parameter', async () => {
      try {
        await waitForElement({});
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.match(err.message, /url parameter is required/);
      }
    });

    it('should require either selector or text parameter', async () => {
      try {
        await waitForElement({ url: testUrl });
        assert.fail('Should have thrown an error');
      } catch (err) {
        assert.match(err.message, /Either selector or text parameter is required/);
      }
    });

    it('should return error if page not loaded', async () => {
      const result = await waitForElement({ 
        url: 'https://unloaded-domain-test.com',
        selector: 'div'
      });
      assert.strictEqual(result.success, false);
      assert.match(result.error, /No open page found/);
    });
  });

  describe('Integration test with real page', () => {
    it('should find interactive elements on example.com', async () => {
      // Fetch the page first
      const fetchResult = await fetchPage({ url: testUrl });
      assert.strictEqual(fetchResult.success, true, `Should successfully fetch page: ${fetchResult.error || 'no error'}`);
      
      // Get interactive elements
      const elementsResult = await getInteractiveElements({ url: testUrl });
      assert.strictEqual(elementsResult.success, true, 'Should successfully get elements');
      assert.ok(elementsResult.count >= 0, 'Should return element count');
      assert.ok(Array.isArray(elementsResult.elements), 'Should return elements array');
    });
  });
});
