const assert = require('assert');
const path = require('path');
const proxyquire = require('proxyquire');
const sinon = require('sinon');

describe('MCPBrowser extension', () => {
    let extension;
    let fsStub;
    let vscodeStub;
    let execPromiseStub;
    let context;

    beforeEach(() => {
        const missingFileError = Object.assign(new Error('ENOENT'), {
            code: 'ENOENT'
        });
        fsStub = {
            promises: {
                access: sinon.stub().resolves(),
                readFile: sinon.stub().rejects(missingFileError),
                writeFile: sinon.stub().resolves(),
                mkdir: sinon.stub().resolves()
            }
        };
        execPromiseStub = sinon.stub();

        class McpStdioServerDefinition {
            constructor(label, command, args, env, version) {
                this.label = label;
                this.command = command;
                this.args = args;
                this.env = env;
                this.version = version;
            }
        }

        vscodeStub = {
            window: {
                showInformationMessage: sinon.stub(),
                showErrorMessage: sinon.stub()
            },
            commands: {
                registerCommand: sinon.stub().callsFake((_name, handler) => ({
                    dispose: sinon.stub(),
                    handler
                }))
            },
            env: {
                appName: 'Visual Studio Code'
            },
            lm: {
                registerMcpServerDefinitionProvider: sinon.stub().returns({
                    dispose: sinon.stub()
                })
            },
            McpStdioServerDefinition,
            Uri: {
                file: sinon.stub().callsFake(fsPath => ({ fsPath }))
            }
        };

        extension = proxyquire.noCallThru()('../src/extension', {
            vscode: vscodeStub,
            fs: fsStub,
            os: {
                homedir: sinon.stub().returns('/home/testuser')
            },
            util: {
                promisify: () => execPromiseStub
            },
            child_process: {
                exec: sinon.stub()
            }
        });

        context = {
            extensionPath: path.join('C:', 'extensions', 'mcpbrowser'),
            extension: {
                packageJSON: {
                    version: '0.4.2'
                }
            },
            subscriptions: []
        };
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('editor detection', () => {
        it('detects VS Code', () => {
            assert.strictEqual(extension.detectEditor().name, 'VS Code');
            assert.strictEqual(extension.getServersKey(), 'servers');
        });

        it('detects Kiro', () => {
            vscodeStub.env.appName = 'Kiro';
            assert.strictEqual(extension.detectEditor().name, 'Kiro');
            assert.strictEqual(extension.getServersKey(), 'mcpServers');
        });

        it('detects Antigravity', () => {
            vscodeStub.env.appName = 'Antigravity';
            assert.strictEqual(extension.detectEditor().name, 'Antigravity');
            assert.strictEqual(extension.getServersKey(), 'mcpServers');
        });
    });

    describe('bundled server definition', () => {
        it('uses the canonical MCP server ID and bundled entry point', () => {
            const definition = extension.createMcpServerDefinition(context);

            assert.strictEqual(definition.label, 'io.github.cherchyk/mcpbrowser');
            assert.strictEqual(definition.command, process.execPath);
            assert.deepStrictEqual(definition.args, [
                path.join(context.extensionPath, 'server', 'src', 'mcp-browser.js')
            ]);
            assert.deepStrictEqual(definition.env, { ELECTRON_RUN_AS_NODE: '1' });
            assert.strictEqual(definition.version, '0.4.2');
        });

        it('registers a native MCP provider', async () => {
            const disposable = extension.registerMcpProvider(context);

            assert(disposable);
            assert(vscodeStub.lm.registerMcpServerDefinitionProvider.calledOnceWith('mcpbrowser'));

            const provider =
                vscodeStub.lm.registerMcpServerDefinitionProvider.firstCall.args[1];
            const definitions = await provider.provideMcpServerDefinitions();
            assert.strictEqual(definitions[0].label, 'io.github.cherchyk/mcpbrowser');

            await provider.resolveMcpServerDefinition(definitions[0]);
            assert(fsStub.promises.access.calledWith(
                path.join(context.extensionPath, 'server', 'src', 'mcp-browser.js')
            ));
        });

        it('reports a missing bundled server', async () => {
            fsStub.promises.access.rejects(new Error('missing'));

            await assert.rejects(
                extension.ensureBundledServer(context),
                /Bundled MCPBrowser server is missing/
            );
        });
    });

    describe('legacy editor configuration', () => {
        beforeEach(() => {
            vscodeStub.env.appName = 'Kiro';
        });

        it('writes a local bundled command without npm or npx', async () => {
            fsStub.promises.readFile.rejects(Object.assign(new Error('ENOENT'), {
                code: 'ENOENT'
            }));

            await extension.configureMcpBrowser(context);

            const written = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            const server = written.mcpServers['io.github.cherchyk/mcpbrowser'];

            assert.strictEqual(server.command, process.execPath);
            assert.deepStrictEqual(server.args, [
                path.join(context.extensionPath, 'server', 'src', 'mcp-browser.js')
            ]);
            assert.strictEqual(server.env.ELECTRON_RUN_AS_NODE, '1');
            assert(!JSON.stringify(server).includes('npm'));
            assert(!JSON.stringify(server).includes('npx'));
        });

        it('migrates the legacy MCPBrowser configuration key', async () => {
            fsStub.promises.readFile.resolves(JSON.stringify({
                mcpServers: {
                    MCPBrowser: {
                        autoApprove: ['browser_fetch_webpage']
                    }
                }
            }));

            await extension.configureMcpBrowser(context);

            const written = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            assert(!written.mcpServers.MCPBrowser);
            assert.deepStrictEqual(
                written.mcpServers['io.github.cherchyk/mcpbrowser'].autoApprove,
                ['browser_fetch_webpage']
            );
        });

        it('removes canonical and legacy configuration entries', async () => {
            fsStub.promises.readFile.resolves(JSON.stringify({
                mcpServers: {
                    MCPBrowser: {},
                    'io.github.cherchyk/mcpbrowser': {},
                    other: {}
                }
            }));

            assert.strictEqual(await extension.removeMcpBrowser(), true);

            const written = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            assert.deepStrictEqual(written.mcpServers, { other: {} });
        });
    });

    describe('activation', () => {
        it('registers the provider and commands in VS Code', async () => {
            await extension.activate(context);

            assert(vscodeStub.lm.registerMcpServerDefinitionProvider.calledOnce);
            assert(vscodeStub.commands.registerCommand.calledTwice);
            assert.strictEqual(context.subscriptions.length, 3);
            assert(fsStub.promises.writeFile.notCalled);
        });

        it('removes the legacy npx entry during provider migration', async () => {
            fsStub.promises.readFile.resolves(JSON.stringify({
                servers: {
                    MCPBrowser: {
                        command: 'npx',
                        args: ['-y', 'mcpbrowser@latest']
                    },
                    other: {}
                }
            }));

            await extension.activate(context);

            const written = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            assert.deepStrictEqual(written.servers, { other: {} });
            assert(vscodeStub.lm.registerMcpServerDefinitionProvider.calledOnce);
        });

        it('falls back to bundled mcp.json configuration without the provider API', async () => {
            vscodeStub.lm = {};
            vscodeStub.window.showInformationMessage
                .onFirstCall()
                .resolves('Configure Now');
            fsStub.promises.readFile.rejects(Object.assign(new Error('ENOENT'), {
                code: 'ENOENT'
            }));

            await extension.activate(context);

            const written = JSON.parse(fsStub.promises.writeFile.firstCall.args[1]);
            assert(written.servers['io.github.cherchyk/mcpbrowser']);
            assert.strictEqual(context.subscriptions.length, 2);
        });
    });
});
