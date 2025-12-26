// Test setup and global configuration
const sinon = require('sinon');

// Global beforeEach and afterEach hooks
beforeEach(function() {
    // Any global setup before each test
});

afterEach(function() {
    // Restore all sinon stubs after each test
    sinon.restore();
});
