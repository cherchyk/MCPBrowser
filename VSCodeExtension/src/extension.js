/**
 * MCPBrowser VS Code extension entry point.
 *
 * VS Code receives MCPBrowser through the native MCP definition provider API.
 * Compatible editors without that API can opt in to a generated MCP config that
 * launches the server bundled in this extension.
 */
const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const MCP_PROVIDER_ID = 'mcpbrowser';
const MCP_SERVER_ID = 'io.github.cherchyk/mcpbrowser';
const MCP_SERVER_LABEL = 'MCPBrowser';
const LEGACY_SERVER_ID = 'MCPBrowser';
const BUNDLED_SERVER_ENTRY = path.join('server', 'src', 'mcp-browser.js');

let cachedWSLAppData = null;

function isWSL() {
    return !!process.env.WSL_DISTRO_NAME;
}

async function resolveWSLPaths() {
    if (!isWSL()) {
        return;
    }

    try {
        const { stdout } = await execPromise('cmd.exe /C "echo %APPDATA%"');
        const windowsPath = stdout.trim().replace(/\r?\n|\r/g, '');
        if (windowsPath && windowsPath !== '%APPDATA%') {
            const { stdout: wslPath } = await execPromise(`wslpath -u "${windowsPath}"`);
            cachedWSLAppData = wslPath.trim();
        }
    } catch (error) {
        console.log('MCPBrowser: Could not resolve Windows APPDATA from WSL:', error.message);
    }
}

const EDITOR_CONFIGS = {
    kiro: {
        name: 'Kiro',
        getConfigPath: () => path.join(os.homedir(), '.kiro', 'settings', 'mcp.json'),
        serversKey: 'mcpServers'
    },
    antigravity: {
        name: 'Antigravity',
        getConfigPath: () => path.join(os.homedir(), '.gemini', 'antigravity', 'mcp_config.json'),
        serversKey: 'mcpServers'
    },
    vscode: {
        name: 'VS Code',
        getConfigPath: () => {
            if (process.platform === 'win32') {
                return path.join(process.env.APPDATA, 'Code', 'User', 'mcp.json');
            }
            if (cachedWSLAppData) {
                return path.join(cachedWSLAppData, 'Code', 'User', 'mcp.json');
            }
            return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
        },
        serversKey: 'servers'
    }
};

function detectEditor() {
    const appName = (vscode.env.appName || '').toLowerCase();
    if (appName.includes('kiro')) {
        return EDITOR_CONFIGS.kiro;
    }
    if (appName.includes('antigravity')) {
        return EDITOR_CONFIGS.antigravity;
    }
    return EDITOR_CONFIGS.vscode;
}

function getMcpConfigPath() {
    return detectEditor().getConfigPath();
}

function getServersKey() {
    return detectEditor().serversKey;
}

function getSafeVersion(context) {
    const version = context?.extension?.packageJSON?.version;
    return typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)
        ? version
        : '0.0.0';
}

function getBundledServerPath(context) {
    if (!context?.extensionPath) {
        throw new Error('MCPBrowser extension path is unavailable.');
    }
    return path.join(context.extensionPath, BUNDLED_SERVER_ENTRY);
}

async function ensureBundledServer(context) {
    const serverPath = getBundledServerPath(context);
    try {
        await fs.access(serverPath);
    } catch {
        throw new Error(
            `Bundled MCPBrowser server is missing at ${serverPath}. Reinstall the extension.`
        );
    }
    return serverPath;
}

function createMcpServerDefinition(context) {
    const serverPath = getBundledServerPath(context);
    const definition = new vscode.McpStdioServerDefinition(
        MCP_SERVER_LABEL,
        process.execPath,
        [serverPath],
        { ELECTRON_RUN_AS_NODE: '1' },
        getSafeVersion(context)
    );
    definition.cwd = vscode.Uri.file(path.dirname(serverPath));
    return definition;
}

function registerMcpProvider(context) {
    if (!vscode.lm?.registerMcpServerDefinitionProvider) {
        return undefined;
    }

    return vscode.lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, {
        provideMcpServerDefinitions: async () => [createMcpServerDefinition(context)],
        resolveMcpServerDefinition: async server => {
            await ensureBundledServer(context);
            return server;
        }
    });
}

async function readMcpConfig() {
    const mcpPath = getMcpConfigPath();
    const key = getServersKey();

    try {
        return {
            mcpPath,
            key,
            config: JSON.parse(await fs.readFile(mcpPath, 'utf-8'))
        };
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
        await fs.mkdir(path.dirname(mcpPath), { recursive: true });
        return { mcpPath, key, config: { [key]: {} } };
    }
}

async function isMcpBrowserConfigured() {
    try {
        const content = await fs.readFile(getMcpConfigPath(), 'utf-8');
        const config = JSON.parse(content);
        const servers = config[getServersKey()] || config.servers || config.mcpServers;
        return !!(servers?.[MCP_SERVER_ID] || servers?.[LEGACY_SERVER_ID]);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

async function configureMcpBrowser(context) {
    const serverPath = await ensureBundledServer(context);
    const { mcpPath, key, config } = await readMcpConfig();
    config[key] ||= {};

    const existing = config[key][MCP_SERVER_ID] || config[key][LEGACY_SERVER_ID] || {};
    delete config[key][LEGACY_SERVER_ID];

    config[key][MCP_SERVER_ID] = {
        ...existing,
        command: process.execPath,
        args: [serverPath],
        env: {
            ...(existing.env || {}),
            ELECTRON_RUN_AS_NODE: '1'
        }
    };

    await fs.writeFile(mcpPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
}

async function removeMcpBrowser() {
    try {
        const mcpPath = getMcpConfigPath();
        const config = JSON.parse(await fs.readFile(mcpPath, 'utf-8'));
        const key = getServersKey();
        const servers = config[key] || config.servers || config.mcpServers;

        if (!servers) {
            return false;
        }

        const existed = !!(servers[MCP_SERVER_ID] || servers[LEGACY_SERVER_ID]);
        delete servers[MCP_SERVER_ID];
        delete servers[LEGACY_SERVER_ID];

        if (existed) {
            await fs.writeFile(mcpPath, JSON.stringify(config, null, 2), 'utf-8');
        }
        return existed;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

async function activate(context) {
    console.log('MCPBrowser extension is active');
    await resolveWSLPaths();

    const editor = detectEditor();
    const isVSCode = editor === EDITOR_CONFIGS.vscode;
    const usesNativeProvider =
        isVSCode && !!vscode.lm?.registerMcpServerDefinitionProvider;

    if (usesNativeProvider) {
        // Previous extension versions wrote an npx-based entry to mcp.json.
        // Remove it before registering the bundled provider to avoid duplicate tools.
        try {
            await removeMcpBrowser();
        } catch (error) {
            console.warn('MCPBrowser: Could not remove legacy MCP configuration:', error.message);
        }
        const provider = registerMcpProvider(context);
        context.subscriptions.push(provider);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('mcpbrowser.configure', async () => {
            try {
                if (usesNativeProvider) {
                    await ensureBundledServer(context);
                    vscode.window.showInformationMessage(
                        `${MCP_SERVER_LABEL} is registered by the MCPBrowser extension.`
                    );
                    return;
                }

                await configureMcpBrowser(context);
                vscode.window.showInformationMessage(
                    `MCPBrowser configured for ${editor.name}. Restart the editor to apply it.`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to configure MCPBrowser: ${error.message}`);
            }
        }),
        vscode.commands.registerCommand('mcpbrowser.remove', async () => {
            try {
                if (usesNativeProvider) {
                    await removeMcpBrowser();
                    vscode.window.showInformationMessage(
                        'Disable or uninstall the MCPBrowser extension to remove its MCP server.'
                    );
                    return;
                }

                const removed = await removeMcpBrowser();
                vscode.window.showInformationMessage(
                    removed
                        ? `MCPBrowser configuration removed from ${editor.name}.`
                        : 'MCPBrowser was not configured.'
                );
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to remove MCPBrowser configuration: ${error.message}`
                );
            }
        })
    );

    if (!usesNativeProvider && !(await isMcpBrowserConfigured())) {
        const action = await vscode.window.showInformationMessage(
            `MCPBrowser is available for ${editor.name}. Configure the bundled server?`,
            'Configure Now',
            'Not Now'
        );
        if (action === 'Configure Now') {
            await configureMcpBrowser(context);
            vscode.window.showInformationMessage(
                `MCPBrowser configured for ${editor.name}. Restart the editor to apply it.`
            );
        }
    }
}

function deactivate() {}

module.exports = {
    activate,
    deactivate,
    EDITOR_CONFIGS,
    MCP_PROVIDER_ID,
    MCP_SERVER_ID,
    MCP_SERVER_LABEL,
    detectEditor,
    getMcpConfigPath,
    getServersKey,
    getSafeVersion,
    getBundledServerPath,
    ensureBundledServer,
    createMcpServerDefinition,
    registerMcpProvider,
    isMcpBrowserConfigured,
    configureMcpBrowser,
    removeMcpBrowser,
    isWSL,
    resolveWSLPaths,
    _setCachedWSLAppData: value => {
        cachedWSLAppData = value;
    },
    _getCachedWSLAppData: () => cachedWSLAppData
};
