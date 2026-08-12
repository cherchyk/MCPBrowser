const assert = require('assert');
const sinon = require('sinon');
const proxyquire = require('proxyquire');
const fsNative = require('fs').promises;
const osNative = require('os');
const path = require('path');
0.4.6
describe('Extension Tests', () => {
    const TEST_VERSION = '0.4.5';
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
                registerCommand: sinon.stub().returns({ dispose: sinon.stub() }),
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

            assert.strictEqual(await extension.checkNodeInstalled(), true);
        });

        it('should return false when npm is not available', async () => {
            execPromiseStub.rejects(new Error('command not found'));

            assert.strictEqual(await extension.checkNodeInstalled(), false);
        });

        it('should return false when npm command fails', async () => {
            execPromiseStub.rejects(new Error('npm failed'));

            assert.strictEqual(await extension.checkNodeInstalled(), false);
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

            assert.strictEqual(await extension.isMcpBrowserConfigured(), true);
        });

        it('should return false when file does not exist', async () => {
            const missingError = Object.assign(new Error('missing'), { code: 'ENOENT' });
            fsStub.promises.readFile.rejects(missingError);

            assert.strictEqual(await extension.isMcpBrowserConfigured(), false);
        });

        it('should return false when MCPBrowser is not in config', async () => {
            const mockConfig = {
                servers: {
                    OtherServer: {}
                }
            };
            fsStub.promises.readFile.resolves(JSON.stringify(mockConfig));

            assert.strictEqual(await extension.isMcpBrowserConfigured(), false);
        });

        it('should return false when servers object is missing', async () => {
            const mockConfig = {};
            fsStub.promises.readFile.resolves(JSON.stringify(mockConfig));

            assert.strictEqual(await extension.isMcpBrowserConfigured(), false);
        });
    });

    describe('getExtensionVersion', () => {
        it('should return the extension version from context', () => {
            const mockContext = {
                extension: { packageJSON: { version: TEST_VERSION } }
            };
            assert.strictEqual(extension.getExtensionVersion(mockContext), TEST_VERSION);
        });

        it('should return "unknown" when version is missing', () => {
            assert.strictEqual(extension.getExtensionVersion({}), 'unknown');
            assert.strictEqual(extension.getExtensionVersion(null), 'unknown');
            assert.strictEqual(extension.getExtensionVersion(undefined), 'unknown');
        });

        it('should return "unknown" when version is not a string', () => {
            const mockContext = {
                extension: { packageJSON: { version: 123 } }
            };
            assert.strictEqual(extension.getExtensionVersion(mockContext), 'unknown');
        });

        it('should return "unknown" when extension property is missing', () => {
            assert.strictEqual(extension.getExtensionVersion({ extension: null }), 'unknown');
            assert.strictEqual(extension.getExtensionVersion({ extension: {} }), 'unknown');
            assert.strictEqual(
                extension.getExtensionVersion({ extension: { packageJSON: {} } }),
                'unknown'
            );
        });
    });

    describe('installMcpBrowser', () => {
        it('should install latest from the configured registry', async () => {
            processStub.platform = 'win32';
            global.process = Object.assign({}, process, processStub);
            execPromiseStub.resolves({ stdout: 'installed' });
            vscodeStub.window.showInformationMessage.resolves();

            const result = await extension.installMcpBrowser({});

            assert.strictEqual(result, true);
            assert.strictEqual(execPromiseStub.firstCall.args[0], 'npm install -g mcpbrowser@latest');
        });

        it('does not invoke sudo on non-Windows platforms', async () => {
            processStub.platform = 'linux';
            processStub.getuid = sinon.stub().returns(1000);
            global.process = Object.assign({}, process, processStub);
            execPromiseStub.resolves({ stdout: 'installed' });

            assert.strictEqual(await extension.installMcpBrowser({}, { silent: true }), true);
            assert.strictEqual(execPromiseStub.callCount, 1);
            assert.strictEqual(execPromiseStub.firstCall.args[0], 'npm install -g mcpbrowser@latest');
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

        it('should not show notifications when silent option is true', async () => {
            processStub.platform = 'win32';
            global.process = Object.assign({}, process, processStub);
            execPromiseStub.resolves({ stdout: 'installed' });

            const mockContext = {
                extension: { packageJSON: { version: TEST_VERSION } }
            };

            const result = await extension.installMcpBrowser(mockContext, { silent: true });

            assert.strictEqual(result, true);
            assert(vscodeStub.window.showInformationMessage.notCalled);
        });

        it('should not show error notification on failure when silent', async () => {
            processStub.platform = 'win32';
            global.process = Object.assign({}, process, processStub);
            execPromiseStub.rejects(new Error('Installation failed'));

            const mockContext = {
                extension: { packageJSON: { version: '1.0.0' } }
            };

            const result = await extension.installMcpBrowser(mockContext, { silent: true });

            assert.strictEqual(result, false);
            assert(vscodeStub.window.showErrorMessage.notCalled);
            assert(vscodeStub.window.showInformationMessage.notCalled);
        });
    });

    describe('configureMcpBrowser latest version', () => {
        it('configures npx with latest and removes the old forced public registry', async () => {
            processStub.platform = 'win32';
            processStub.env = { APPDATA: 'C:\\Users\\test\\AppData\\Roaming' };
            global.process = Object.assign({}, process, processStub);
            fsStub.promises.readFile.resolves(JSON.stringify({
                servers: {
                    MCPBrowser: {
                        env: {
                            npm_config_registry: 'https://registry.npmjs.org',
                            KEEP_ME: 'value'
                        }
                    }
                }
            }));
            fsStub.promises.writeFile.resolves();

            await extension.configureMcpBrowser();

            const writtenConfig = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            assert.deepStrictEqual(
                writtenConfig.servers.MCPBrowser.args,
                ['-y', 'mcpbrowser@latest']
            );
            assert.deepStrictEqual(writtenConfig.servers.MCPBrowser.env, { KEEP_ME: 'value' });
        });

        it('creates a new config only when the file does not exist', async () => {
            processStub.platform = 'win32';
            processStub.env = { APPDATA: 'C:\\Users\\test\\AppData\\Roaming' };
            global.process = Object.assign({}, process, processStub);
            const missingError = Object.assign(new Error('missing'), { code: 'ENOENT' });
            fsStub.promises.readFile.rejects(missingError);
            fsStub.promises.mkdir.resolves();
            fsStub.promises.writeFile.resolves();

            await extension.configureMcpBrowser();

            assert(fsStub.promises.mkdir.calledOnce);
            const writtenConfig = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            assert.deepStrictEqual(
                writtenConfig.servers.MCPBrowser.args,
                ['-y', 'mcpbrowser@latest']
            );
        });

        it('does not overwrite malformed JSON', async () => {
            processStub.platform = 'win32';
            processStub.env = { APPDATA: 'C:\\Users\\test\\AppData\\Roaming' };
            global.process = Object.assign({}, process, processStub);
            fsStub.promises.readFile.resolves('{ malformed');

            await assert.rejects(extension.configureMcpBrowser(), SyntaxError);
            assert(fsStub.promises.writeFile.notCalled);
            assert(fsStub.promises.mkdir.notCalled);
        });
    });

    describe('removeMcpBrowser missing config', () => {
        it('returns false when the config file does not exist', async () => {
            processStub.platform = 'win32';
            processStub.env = { APPDATA: 'C:\\Users\\test\\AppData\\Roaming' };
            global.process = Object.assign({}, process, processStub);
            const missingError = Object.assign(new Error('missing'), { code: 'ENOENT' });
            fsStub.promises.readFile.rejects(missingError);

            assert.strictEqual(await extension.removeMcpBrowser(), false);
            assert(fsStub.promises.writeFile.notCalled);
        });
    });

    describe('isMcpBrowserConfigured errors', () => {
        it('returns false only when the config file does not exist', async () => {
            processStub.platform = 'win32';
            processStub.env = { APPDATA: 'C:\\Users\\test\\AppData\\Roaming' };
            global.process = Object.assign({}, process, processStub);
            const missingError = Object.assign(new Error('missing'), { code: 'ENOENT' });
            fsStub.promises.readFile.rejects(missingError);

            assert.strictEqual(await extension.isMcpBrowserConfigured(), false);
        });

        it('surfaces malformed JSON instead of treating it as unconfigured', async () => {
            processStub.platform = 'win32';
            processStub.env = { APPDATA: 'C:\\Users\\test\\AppData\\Roaming' };
            global.process = Object.assign({}, process, processStub);
            fsStub.promises.readFile.resolves('{ malformed');

            await assert.rejects(extension.isMcpBrowserConfigured(), SyntaxError);
        });
    });

    describe('activate', () => {
        it('should register both commands', async () => {
            const missingError = Object.assign(new Error('missing'), { code: 'ENOENT' });
            fsStub.promises.readFile.rejects(missingError);
            fsStub.promises.mkdir.resolves();
            fsStub.promises.writeFile.resolves();
            execPromiseStub.onFirstCall().resolves({ stdout: '11.0.0' });
            execPromiseStub.onSecondCall().resolves();
            const mockContext = {
                subscriptions: [],
                extension: { packageJSON: { version: TEST_VERSION } },
                globalState: {
                    get: sinon.stub().returns(false),
                    update: sinon.stub().resolves()
                }
            };

            await extension.activate(mockContext);

            assert(vscodeStub.commands.registerCommand.calledTwice);
            assert(vscodeStub.commands.registerCommand.calledWith('mcpbrowser.configure'));
            assert(vscodeStub.commands.registerCommand.calledWith('mcpbrowser.remove'));
        });

        it('writes mcp.json before the optional package pre-install completes', async () => {
            const missingError = Object.assign(new Error('missing'), { code: 'ENOENT' });
            fsStub.promises.readFile.rejects(missingError);
            fsStub.promises.mkdir.resolves();
            fsStub.promises.writeFile.resolves();
            execPromiseStub.onFirstCall().resolves({ stdout: '11.0.0' });
            execPromiseStub.onSecondCall().returns(new Promise(() => {}));
            const mockContext = {
                subscriptions: [],
                extension: { packageJSON: { version: TEST_VERSION } },
                globalState: {
                    get: sinon.stub().returns(false),
                    update: sinon.stub().resolves()
                }
            };

            await extension.activate(mockContext);

            assert(fsStub.promises.writeFile.calledOnce);
            const writtenConfig = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            assert.deepStrictEqual(
                writtenConfig.servers.MCPBrowser.args,
                ['-y', 'mcpbrowser@latest']
            );
        });

        it('surfaces malformed mcp.json without failing activation', async () => {
            fsStub.promises.readFile.resolves('{ malformed');
            const mockContext = {
                subscriptions: [],
                extension: { packageJSON: { version: TEST_VERSION } },
                globalState: {
                    get: sinon.stub().returns(false),
                    update: sinon.stub().resolves()
                }
            };

            await extension.activate(mockContext);

            assert(vscodeStub.window.showErrorMessage.calledOnce);
            assert.match(
                vscodeStub.window.showErrorMessage.firstCall.args[0],
                /could not read mcp\.json/
            );
            assert(fsStub.promises.writeFile.notCalled);
        });
    });

    describe('real mcp.json lifecycle', () => {
        let tempRoot;
        let previousAppData;

        beforeEach(async () => {
            tempRoot = await fsNative.mkdtemp(path.join(osNative.tmpdir(), 'mcpbrowser-extension-'));
            previousAppData = process.env.APPDATA;
            process.env.APPDATA = tempRoot;
            processStub.platform = 'win32';
            processStub.env = process.env;
            global.process = Object.assign({}, process, processStub);
        });

        afterEach(async () => {
            if (previousAppData === undefined) {
                delete process.env.APPDATA;
            } else {
                process.env.APPDATA = previousAppData;
            }
            await fsNative.rm(tempRoot, { recursive: true, force: true });
        });

        it('configures and removes MCPBrowser while preserving other servers', async () => {
            const realFsExtension = proxyquire.noCallThru()('../src/extension', {
                'vscode': vscodeStub,
                'os': osStub,
                'util': { promisify: () => execPromiseStub },
                'child_process': { exec: sinon.stub() }
            });
            const mcpPath = path.join(tempRoot, 'Code', 'User', 'mcp.json');
            await fsNative.mkdir(path.dirname(mcpPath), { recursive: true });
            await fsNative.writeFile(mcpPath, JSON.stringify({
                servers: {
                    ExistingServer: {
                        type: 'http',
                        url: 'https://example.test/mcp'
                    }
                },
                inputs: []
            }), 'utf8');

            await realFsExtension.configureMcpBrowser();

            let config = JSON.parse(await fsNative.readFile(mcpPath, 'utf8'));
            assert.deepStrictEqual(config.servers.MCPBrowser.args, ['-y', 'mcpbrowser@latest']);
            assert.strictEqual(config.servers.ExistingServer.url, 'https://example.test/mcp');
            assert.deepStrictEqual(config.inputs, []);

            assert.strictEqual(await realFsExtension.removeMcpBrowser(), true);

            config = JSON.parse(await fsNative.readFile(mcpPath, 'utf8'));
            assert.strictEqual(config.servers.MCPBrowser, undefined);
            assert.strictEqual(config.servers.ExistingServer.url, 'https://example.test/mcp');
            assert.deepStrictEqual(config.inputs, []);
            assert.strictEqual(await realFsExtension.removeMcpBrowser(), false);
        });
    });
});
