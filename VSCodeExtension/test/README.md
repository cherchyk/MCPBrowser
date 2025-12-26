# Extension Tests

This directory contains unit tests for the MCPBrowser VS Code extension.

## Setup

Install test dependencies:

```bash
npm install --save-dev mocha sinon proxyquire @types/mocha
```

## Running Tests

```bash
npm test
```

## Test Structure

- `extension.test.js` - Main test file for extension.js functions
- `setup.js` - Global test setup and configuration
- `mocha.opts` - Mocha configuration options

## Making Functions Testable

Currently, most functions in `extension.js` are not exported. To make them testable, you have two options:

### Option 1: Export functions for testing (Recommended)

Add to the bottom of `extension.js`:

```javascript
module.exports = {
    activate,
    deactivate,
    // Export for testing
    getMcpConfigPath,
    checkNodeInstalled,
    isMcpBrowserConfigured,
    configureMcpBrowser,
    removeMcpBrowser,
    installMcpBrowser,
    checkMcpBrowserInstalled,
    showConfigurationPrompt
};
```

### Option 2: Use proxyquire or rewire

The test file uses `proxyquire` to inject mocks, but functions still need to be exported.

## Test Coverage

The test file includes tests for:

- ✅ `getMcpConfigPath()` - Path resolution for different platforms
- ✅ `checkNodeInstalled()` - Node.js/npm detection
- ✅ `isMcpBrowserConfigured()` - Configuration file checking
- ✅ `configureMcpBrowser()` - Configuration file creation/update
- ✅ `removeMcpBrowser()` - Configuration removal
- ✅ `installMcpBrowser()` - Package installation with platform-specific logic
- ✅ `checkMcpBrowserInstalled()` - Package installation verification
- ✅ `activate()` - Extension activation and command registration

## Next Steps

1. Export functions from `extension.js`
2. Uncomment test implementations in `extension.test.js`
3. Run `npm test` to verify all tests pass
4. Add integration tests for command workflows
