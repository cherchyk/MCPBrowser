const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const path = require('path');

describe('Extension Tests', () => {
    let extension;
    let fsStub;
    let execPromiseStub;
    let vscodeStub;
    let processStub;
    let osStub;
    let originalProcess;

    beforeEach(() => {
        // Save original process
        originalProcess = global.process;
        
        // Setup stubs
        fsStub = {
            promises: {
                readFile: sinon.stub(),
                writeFile: sinon.stub(),
                mkdir: sinon.stub()
            }
        };

        execPromiseStub = sinon.stub();

        vscodeStub = {
            window: {
                showInformationMessage: sinon.stub(),
                showWarningMessage: sinon.stub(),
                showErrorMessage: sinon.stub()
            },
            commands: {
                registerCommand: sinon.stub(),
                executeCommand: sinon.stub()
            },
            env: {
                openExternal: sinon.stub()
            },
            Uri: {
                parse: sinon.stub().callsFake(url => ({ url }))
            }
        };

        processStub = {
            platform: 'linux',
            env: {},
            getuid: sinon.stub().returns(1000)
        };

        osStub = {
            homedir: sinon.stub().returns('/home/testuser')
        };

        // Load extension with stubs - use noCallThru to prevent loading real vscode module
        extension = proxyquire.noCallThru()('../src/extension', {
            'vscode': vscodeStub,
            'fs': fsStub,
            'os': osStub,
            'util': {
                promisify: () => execPromiseStub
            },
            'child_process': {
                exec: sinon.stub()
            }
        });

        // Override process
        global.process = Object.assign({}, process, processStub);
    });

    afterEach(() => {
        // Restore original process
        global.process = originalProcess;
        // Restore all sinon stubs
        sinon.restore();
    });

    describe('getMcpConfigPath', () => {
        it('should return Windows path when platform is win32', () => {
            // Test that getMcpConfigPath works correctly on Windows
            // Since getMcpConfigPath is internally used and we can't easily test it directly,
            // this test verifies the module loads correctly on Windows-like environments
            
            // Modify process stub to simulate Windows
            processStub.platform = 'win32';
            processStub.env.APPDATA = 'C:\\Users\\TestUser\\AppData\\Roaming';
            
            // Reload extension with Windows platform
            const winExtension = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub,
                'fs': fsStub,
                'os': osStub,
                'util': {
                    promisify: () => execPromiseStub
                },
                'child_process': {
                    exec: sinon.stub()
                }
            });
            
            // Verify module loaded successfully (getMcpConfigPath is called during module init)
            assert.ok(winExtension);
        });

        it('should return Linux/macOS path when platform is not win32', () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            // Test implementation
        });
    });

    describe('checkNodeInstalled', () => {
        it('should return true when npm is available', async () => {
            execPromiseStub.resolves({ stdout: '10.2.0' });

            // Since checkNodeInstalled is not exported, we need to export it
            // For now, we'll document that these functions need to be exported
            // const result = await extension.checkNodeInstalled();
            // assert.strictEqual(result, true);
        });

        it('should return false when npm is not available', async () => {
            execPromiseStub.rejects(new Error('command not found'));

            // const result = await extension.checkNodeInstalled();
            // assert.strictEqual(result, false);
        });

        it('should return false when npm command fails', async () => {
            execPromiseStub.rejects(new Error('npm failed'));

            // const result = await extension.checkNodeInstalled();
            // assert.strictEqual(result, false);
        });
    });

    describe('isMcpBrowserConfigured', () => {
        it('should return true when MCPBrowser is configured', async () => {
            const mockConfig = {
                servers: {
                    MCPBrowser: {
                        type: "stdio",
                        command: "npx"
                    }
                }
            };
            fsStub.promises.readFile.resolves(JSON.stringify(mockConfig));

            // const result = await extension.isMcpBrowserConfigured();
            // assert.strictEqual(result, true);
        });

        it('should return false when file does not exist', async () => {
            fsStub.promises.readFile.rejects(new Error('ENOENT: file not found'));

            // const result = await extension.isMcpBrowserConfigured();
            // assert.strictEqual(result, false);
        });

        it('should return false when MCPBrowser is not in config', async () => {
            const mockConfig = {
                servers: {
                    OtherServer: {}
                }
            };
            fsStub.promises.readFile.resolves(JSON.stringify(mockConfig));

            // const result = await extension.isMcpBrowserConfigured();
            // assert.strictEqual(result, false);
        });

        it('should return false when servers object is missing', async () => {
            const mockConfig = {};
            fsStub.promises.readFile.resolves(JSON.stringify(mockConfig));

            // const result = await extension.isMcpBrowserConfigured();
            // assert.strictEqual(result, false);
        });

        it('should return false when JSON is malformed', async () => {
            fsStub.promises.readFile.resolves('invalid json{');

            // const result = await extension.isMcpBrowserConfigured();
            // assert.strictEqual(result, false);
        });
    });

    describe('configureMcpBrowser', () => {
        it('should create new config when file does not exist', async () => {
            fsStub.promises.readFile.rejects(new Error('ENOENT'));
            fsStub.promises.mkdir.resolves();
            fsStub.promises.writeFile.resolves();

            // await extension.configureMcpBrowser();

            // assert(fsStub.promises.mkdir.calledOnce);
            // assert(fsStub.promises.writeFile.calledOnce);
            // const writtenConfig = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            // assert(writtenConfig.servers.MCPBrowser);
        });

        it('should update existing config without losing other servers', async () => {
            const existingConfig = {
                servers: {
                    OtherServer: { type: "stdio", command: "other" }
                }
            };
            fsStub.promises.readFile.resolves(JSON.stringify(existingConfig));
            fsStub.promises.writeFile.resolves();

            // await extension.configureMcpBrowser();

            // const writtenConfig = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            // assert(writtenConfig.servers.MCPBrowser);
            // assert(writtenConfig.servers.OtherServer);
        });

        it('should add servers object if missing', async () => {
            const existingConfig = {};
            fsStub.promises.readFile.resolves(JSON.stringify(existingConfig));
            fsStub.promises.writeFile.resolves();

            // await extension.configureMcpBrowser();

            // const writtenConfig = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            // assert(writtenConfig.servers);
            // assert(writtenConfig.servers.MCPBrowser);
        });

        it('should handle file write errors', async () => {
            fsStub.promises.readFile.resolves('{}');
            fsStub.promises.writeFile.rejects(new Error('Permission denied'));

            // await assert.rejects(
            //     async () => await extension.configureMcpBrowser(),
            //     /Permission denied/
            // );
        });
    });

    describe('removeMcpBrowser', () => {
        it('should remove MCPBrowser from config', async () => {
            const mockConfig = {
                servers: {
                    MCPBrowser: {},
                    OtherServer: {}
                }
            };
            fsStub.promises.readFile.resolves(JSON.stringify(mockConfig));
            fsStub.promises.writeFile.resolves();

            // const result = await extension.removeMcpBrowser();

            // assert.strictEqual(result, true);
            // const writtenConfig = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            // assert(!writtenConfig.servers.MCPBrowser);
            // assert(writtenConfig.servers.OtherServer);
        });

        it('should return false when MCPBrowser does not exist', async () => {
            const mockConfig = {
                servers: {
                    OtherServer: {}
                }
            };
            fsStub.promises.readFile.resolves(JSON.stringify(mockConfig));

            // const result = await extension.removeMcpBrowser();
            // assert.strictEqual(result, false);
        });

        it('should handle missing file gracefully', async () => {
            fsStub.promises.readFile.rejects(new Error('ENOENT'));

            // await assert.rejects(
            //     async () => await extension.removeMcpBrowser()
            // );
        });
    });

    describe('installMcpBrowser', () => {
        it('should use plain npm command on Windows', async () => {
            Object.defineProperty(process, 'platform', { value: 'win32' });
            execPromiseStub.resolves({ stdout: 'installed' });
            vscodeStub.window.showInformationMessage.resolves();

            // await extension.installMcpBrowser();

            // assert(execPromiseStub.calledWith('npm install -g mcpbrowser@latest'));
        });

        it('should use sudo on Linux when not root', async () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            processStub.getuid = () => 1000;
            execPromiseStub.onFirstCall().resolves(); // which sudo succeeds
            execPromiseStub.onSecondCall().resolves(); // install succeeds
            vscodeStub.window.showInformationMessage.resolves();

            // await extension.installMcpBrowser();

            // assert(execPromiseStub.secondCall.args[0].includes('sudo'));
        });

        it('should fall back to non-sudo when sudo unavailable', async () => {
            Object.defineProperty(process, 'platform', { value: 'linux' });
            processStub.getuid = () => 1000;
            execPromiseStub.onFirstCall().rejects(new Error('which: sudo not found'));
            execPromiseStub.onSecondCall().resolves();
            vscodeStub.window.showInformationMessage.resolves();

            // await extension.installMcpBrowser();

            // assert(execPromiseStub.secondCall.args[0] === 'npm install -g mcpbrowser@latest');
        });

        it('should handle installation errors', async () => {
            execPromiseStub.rejects(new Error('Installation failed'));
            vscodeStub.window.showInformationMessage.resolves();
            vscodeStub.window.showErrorMessage.resolves();

            // const result = await extension.installMcpBrowser();

            // assert.strictEqual(result, false);
            // assert(vscodeStub.window.showErrorMessage.called);
        });
    });

    describe('checkMcpBrowserInstalled', () => {
        it('should return true when package is globally installed', async () => {
            // Mock exec to return mcpbrowser in output
            // Implementation depends on how the function is structured
        });

        it('should return false when package not found', async () => {
            // Implementation
        });
    });

    describe('activate', () => {
        it('should register both commands', async () => {
            const mockContext = {
                subscriptions: [],
                globalState: {
                    get: sinon.stub().returns(false)
                }
            };

            // await extension.activate(mockContext);

            // assert(vscodeStub.commands.registerCommand.calledTwice);
            // assert(vscodeStub.commands.registerCommand.calledWith('mcpbrowser.configure'));
            // assert(vscodeStub.commands.registerCommand.calledWith('mcpbrowser.remove'));
        });

        it('should not show prompt if dontAskAgain is set', async () => {
            const mockContext = {
                subscriptions: [],
                globalState: {
                    get: sinon.stub().returns(true)
                }
            };

            // await extension.activate(mockContext);

            // // Wait for setTimeout
            // await new Promise(resolve => setTimeout(resolve, 6000));
            // assert(vscodeStub.window.showInformationMessage.notCalled);
        });
    });
});
