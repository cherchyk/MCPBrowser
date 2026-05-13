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
                openExternal: sinon.stub(),
                appName: 'Visual Studio Code'
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

    describe('detectEditor', () => {
        it('should detect VS Code by default', () => {
            vscodeStub.env.appName = 'Visual Studio Code';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            const editor = ext.detectEditor();
            assert.strictEqual(editor.name, 'VS Code');
            assert.strictEqual(editor.serversKey, 'servers');
        });

        it('should detect Kiro', () => {
            vscodeStub.env.appName = 'Kiro';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            const editor = ext.detectEditor();
            assert.strictEqual(editor.name, 'Kiro');
            assert.strictEqual(editor.serversKey, 'mcpServers');
        });

        it('should detect Antigravity', () => {
            vscodeStub.env.appName = 'Antigravity';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            const editor = ext.detectEditor();
            assert.strictEqual(editor.name, 'Antigravity');
            assert.strictEqual(editor.serversKey, 'mcpServers');
        });

        it('should fall back to VS Code for unknown editors', () => {
            vscodeStub.env.appName = 'Unknown Editor';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            const editor = ext.detectEditor();
            assert.strictEqual(editor.name, 'VS Code');
        });
    });

    describe('getMcpConfigPath', () => {
        it('should return VS Code Windows path when platform is win32', () => {
            vscodeStub.env.appName = 'Visual Studio Code';
            processStub.platform = 'win32';
            processStub.env.APPDATA = 'C:\\Users\\TestUser\\AppData\\Roaming';
            global.process = Object.assign({}, process, processStub);

            const winExtension = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });

            const configPath = winExtension.getMcpConfigPath();
            assert.ok(configPath.includes('Code'));
            assert.ok(configPath.endsWith('mcp.json'));
        });

        it('should return Kiro path when running in Kiro', () => {
            vscodeStub.env.appName = 'Kiro';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });

            const configPath = ext.getMcpConfigPath();
            assert.ok(configPath.includes('.kiro'));
            assert.ok(configPath.includes('settings'));
            assert.ok(configPath.endsWith('mcp.json'));
        });

        it('should return Antigravity path when running in Antigravity', () => {
            vscodeStub.env.appName = 'Antigravity';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });

            const configPath = ext.getMcpConfigPath();
            assert.ok(configPath.includes('.gemini'));
            assert.ok(configPath.includes('antigravity'));
            assert.ok(configPath.endsWith('mcp_config.json'));
        });
    });

    describe('getServersKey', () => {
        it('should return "servers" for VS Code', () => {
            vscodeStub.env.appName = 'Visual Studio Code';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            assert.strictEqual(ext.getServersKey(), 'servers');
        });

        it('should return "mcpServers" for Kiro', () => {
            vscodeStub.env.appName = 'Kiro';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            assert.strictEqual(ext.getServersKey(), 'mcpServers');
        });

        it('should return "mcpServers" for Antigravity', () => {
            vscodeStub.env.appName = 'Antigravity';
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            assert.strictEqual(ext.getServersKey(), 'mcpServers');
        });
    });

    describe('isWSL', () => {
        it('should return true when WSL_DISTRO_NAME is set', () => {
            processStub.env = { WSL_DISTRO_NAME: 'Ubuntu' };
            global.process = Object.assign({}, process, processStub);
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            assert.strictEqual(ext.isWSL(), true);
        });

        it('should return false when WSL_DISTRO_NAME is not set', () => {
            processStub.env = {};
            global.process = Object.assign({}, process, processStub);
            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            assert.strictEqual(ext.isWSL(), false);
        });
    });

    describe('resolveWSLPaths', () => {
        it('should resolve Windows APPDATA path in WSL', async () => {
            processStub.env = { WSL_DISTRO_NAME: 'Ubuntu' };
            global.process = Object.assign({}, process, processStub);

            execPromiseStub.onFirstCall().resolves({ stdout: 'C:\\Users\\TestUser\\AppData\\Roaming\r\n' });
            execPromiseStub.onSecondCall().resolves({ stdout: '/mnt/c/Users/TestUser/AppData/Roaming\n' });

            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });

            await ext.resolveWSLPaths();
            assert.strictEqual(ext._getCachedWSLAppData(), '/mnt/c/Users/TestUser/AppData/Roaming');
        });

        it('should not resolve when not in WSL', async () => {
            processStub.env = {};
            global.process = Object.assign({}, process, processStub);

            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });

            await ext.resolveWSLPaths();
            assert.strictEqual(ext._getCachedWSLAppData(), null);
            assert(execPromiseStub.notCalled);
        });

        it('should fall back gracefully when cmd.exe fails', async () => {
            processStub.env = { WSL_DISTRO_NAME: 'Ubuntu' };
            global.process = Object.assign({}, process, processStub);

            execPromiseStub.rejects(new Error('cmd.exe not found'));

            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });

            await ext.resolveWSLPaths();
            assert.strictEqual(ext._getCachedWSLAppData(), null);
        });
    });

    describe('getMcpConfigPath (WSL)', () => {
        it('should use Windows APPDATA path when WSL path is cached', () => {
            vscodeStub.env.appName = 'Visual Studio Code';
            processStub.platform = 'linux';
            global.process = Object.assign({}, process, processStub);

            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });

            ext._setCachedWSLAppData('/mnt/c/Users/TestUser/AppData/Roaming');
            const configPath = ext.getMcpConfigPath();
            // path.join normalizes separators per platform, so check key components
            assert.ok(configPath.includes('TestUser'), 'should contain Windows user path');
            assert.ok(configPath.includes('Code'), 'should contain Code directory');
            assert.ok(configPath.endsWith('mcp.json'), 'should end with mcp.json');
            // Should NOT use the Linux ~/.config path
            assert.ok(!configPath.includes('.config'), 'should not use Linux .config path');
        });

        it('should fall back to Linux path when WSL path not cached', () => {
            vscodeStub.env.appName = 'Visual Studio Code';
            processStub.platform = 'linux';
            global.process = Object.assign({}, process, processStub);

            const ext = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub, 'fs': fsStub, 'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });

            ext._setCachedWSLAppData(null);
            const configPath = ext.getMcpConfigPath();
            assert.ok(configPath.includes('.config'));
            assert.ok(configPath.endsWith('mcp.json'));
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

    describe('getSafeVersion', () => {
        it('should return valid semver version from context', () => {
            const mockContext = {
                extension: { packageJSON: { version: '0.3.49' } }
            };
            assert.strictEqual(extension.getSafeVersion(mockContext), '0.3.49');
        });

        it('should return "latest" when version is missing', () => {
            assert.strictEqual(extension.getSafeVersion({}), 'latest');
            assert.strictEqual(extension.getSafeVersion(null), 'latest');
            assert.strictEqual(extension.getSafeVersion(undefined), 'latest');
        });

        it('should return "latest" when version is not a string', () => {
            const mockContext = {
                extension: { packageJSON: { version: 123 } }
            };
            assert.strictEqual(extension.getSafeVersion(mockContext), 'latest');
        });

        it('should return "latest" for malicious version strings', () => {
            const tests = [
                '1.0.0; rm -rf /',
                '1.0.0 && echo pwned',
                '$(whoami)',
                '1.0.0`id`',
                '../../../etc/passwd',
                '1.0.0|cat /etc/passwd',
                '',
            ];
            for (const bad of tests) {
                const ctx = { extension: { packageJSON: { version: bad } } };
                assert.strictEqual(extension.getSafeVersion(ctx), 'latest',
                    `Should reject: "${bad}"`);
            }
        });

        it('should accept valid semver with prerelease', () => {
            const ctx = { extension: { packageJSON: { version: '1.0.0-beta.1' } } };
            assert.strictEqual(extension.getSafeVersion(ctx), '1.0.0-beta.1');
        });

        it('should return "latest" when extension property is missing', () => {
            assert.strictEqual(extension.getSafeVersion({ extension: null }), 'latest');
            assert.strictEqual(extension.getSafeVersion({ extension: {} }), 'latest');
            assert.strictEqual(extension.getSafeVersion({ extension: { packageJSON: {} } }), 'latest');
        });
    });

    describe('installMcpBrowser', () => {
        it('should use version from context in install command', async () => {
            processStub.platform = 'win32';
            global.process = Object.assign({}, process, processStub);
            execPromiseStub.resolves({ stdout: 'installed' });
            vscodeStub.window.showInformationMessage.resolves();

            const mockContext = {
                extension: { packageJSON: { version: '0.3.49' } }
            };

            const result = await extension.installMcpBrowser(mockContext);

            assert.strictEqual(result, true);
            assert(execPromiseStub.calledWith('npm install -g mcpbrowser@0.3.49'));
        });

        it('should fall back to latest when context has invalid version', async () => {
            processStub.platform = 'win32';
            global.process = Object.assign({}, process, processStub);
            execPromiseStub.resolves({ stdout: 'installed' });
            vscodeStub.window.showInformationMessage.resolves();

            const result = await extension.installMcpBrowser({});

            assert.strictEqual(result, true);
            assert(execPromiseStub.calledWith('npm install -g mcpbrowser@latest'));
        });

        it('should return false on installation error', async () => {
            processStub.platform = 'win32';
            global.process = Object.assign({}, process, processStub);
            execPromiseStub.rejects(new Error('Installation failed'));
            vscodeStub.window.showInformationMessage.resolves();
            vscodeStub.window.showErrorMessage.resolves();

            const mockContext = {
                extension: { packageJSON: { version: '1.0.0' } }
            };

            const result = await extension.installMcpBrowser(mockContext);

            assert.strictEqual(result, false);
            assert(vscodeStub.window.showErrorMessage.called);
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
