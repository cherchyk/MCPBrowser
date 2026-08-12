/**
 * MCPBrowser VS Code Extension — entry point
 *
 * ARCHITECTURE OVERVIEW
 * =====================
 * This extension manages two things:
 *   1. A globally-installed npm package (`mcpbrowser`) — the actual MCP server
 *   2. An editor-level mcp.json config file — tells VS Code/Kiro/Antigravity how to start the server
 *
 * LIFECYCLE
 * =========
 * On activation (onStartupFinished):
 *   - If MCPBrowser is already configured in mcp.json:
 *       → Silently update the npm package if the extension version changed (fire-and-forget).
 *   - If MCPBrowser is NOT configured:
 *       → Write mcp.json immediately, then silently pre-install the npm package.
 *
 * Manual commands:
 *   - "Configure MCPBrowser"  → writes config + optionally pre-installs package
 *   - "Remove MCPBrowser"     → deletes MCPBrowser entry from mcp.json
 *
 * VERSION STRATEGY
 * ================
 * - Install `mcpbrowser@latest` through the user's configured npm registry.
 * - Configure mcp.json with `mcpbrowser@latest` so each environment resolves the
 *   newest version available under its registry and quarantine policies.
 *
 * GLOBAL STATE KEYS (context.globalState)
 * =======================================
 * - `mcpbrowser.installedVersion` — extension version that last completed setup
 * - `mcpbrowser.dontAskAgain`     — user opted out of auto-configuration
 */
const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Cached Windows APPDATA path when running in WSL.
 * Resolved once at activation time via resolveWSLPaths().
 */
let cachedWSLAppData = null;

/**
 * Check if running inside Windows Subsystem for Linux (WSL).
 */
function isWSL() {
    return !!process.env.WSL_DISTRO_NAME;
}

/**
 * Resolve Windows APPDATA path from WSL for correct mcp.json location.
 * VS Code reads user-level mcp.json from the Windows side even when
 * the extension host runs in WSL via Remote-WSL.
 */
async function resolveWSLPaths() {
    if (!isWSL()) return;
    try {
        const { stdout } = await execPromise('cmd.exe /C "echo %APPDATA%"');
        const windowsPath = stdout.trim().replace(/\r?\n|\r/g, '');
        if (windowsPath && windowsPath !== '%APPDATA%') {
            const { stdout: wslPath } = await execPromise(`wslpath -u "${windowsPath}"`);
            cachedWSLAppData = wslPath.trim();
        }
    } catch (error) {
        // Could not resolve Windows path — fall back to Linux default
        console.log('MCPBrowser: Could not resolve Windows APPDATA from WSL:', error.message);
    }
}

/**
 * Editor configuration map for supported editors.
 * Each entry defines the MCP config file path and the JSON key used for servers.
 */
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
            // In WSL, VS Code reads mcp.json from the Windows side
            if (cachedWSLAppData) {
                return path.join(cachedWSLAppData, 'Code', 'User', 'mcp.json');
            }
            return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
        },
        serversKey: 'servers'
    }
};

/**
 * Detect the current editor based on vscode.env.appName
 * @returns {Object} Editor configuration with name, getConfigPath(), and serversKey
 */
function detectEditor() {
    const appName = (vscode.env.appName || '').toLowerCase();
    if (appName.includes('kiro')) return EDITOR_CONFIGS.kiro;
    if (appName.includes('antigravity')) return EDITOR_CONFIGS.antigravity;
    return EDITOR_CONFIGS.vscode;
}

/**
 * Get the path to the MCP configuration file for the current editor
 */
function getMcpConfigPath() {
    return detectEditor().getConfigPath();
}

/**
 * Get the JSON key used for the servers object in the current editor's MCP config.
 * VS Code uses "servers", Kiro and Antigravity use "mcpServers".
 */
function getServersKey() {
    return detectEditor().serversKey;
}

/**
 * Check if MCPBrowser is already configured in mcp.json
 */
async function isMcpBrowserConfigured() {
    try {
        const mcpPath = getMcpConfigPath();
        const content = await fs.readFile(mcpPath, 'utf-8');
        const config = JSON.parse(content);
        const key = getServersKey();
        const servers = config[key] || config.servers || config.mcpServers;
        return !!(servers && servers.MCPBrowser !== undefined);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

/**
 * Check if Node.js/npm is installed
 */
async function checkNodeInstalled() {
    try {
        await execPromise('npm --version');
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Read the extension version used to decide when setup should run again.
 *
 * @param {object} context - VS Code extension context (provides extension.packageJSON.version)
 * @returns {string} Extension version, or "unknown" for an invalid context
 */
function getExtensionVersion(context) {
    const version = context?.extension?.packageJSON?.version;
    if (typeof version === 'string' && version.length > 0) {
        return version;
    }
    return 'unknown';
}

/**
 * Install the latest MCPBrowser version exposed by the configured npm registry.
 *
 * @returns {Promise<boolean>} true if installation succeeded
 */
async function installMcpBrowser(_context, options = {}) {
    const { silent = false } = options;
    try {
        if (silent) {
            console.log('MCPBrowser: Installing npm package (mcpbrowser@latest)...');
        } else {
            vscode.window.showInformationMessage('Installing MCPBrowser npm package...');
        }

        await execPromise('npm install -g mcpbrowser@latest');

        if (silent) {
            console.log('MCPBrowser: npm package installed successfully.');
        } else {
            vscode.window.showInformationMessage('MCPBrowser package installed successfully!');
        }
        return true;
    } catch (error) {
        console.error('Error installing MCPBrowser:', error);
        if (!silent) {
            vscode.window.showErrorMessage(`Failed to install MCPBrowser: ${error.message}`);
        }
        return false;
    }
}

/**\n * Add or update MCPBrowser configuration in the editor's mcp.json.\n *\n * Idempotent \u2014 safe to call multiple times. Preserves user-set properties\n * (e.g. `autoApprove`, `env`) by spreading the existing config object first,\n * then overwriting our canonical fields (`type`, `command`, `args`, `description`).\n *\n * Multi-editor: writes to the correct config path and key for the detected editor\n * (VS Code uses `servers`, Kiro/Antigravity use `mcpServers`).\n */
async function configureMcpBrowser() {
    try {
        const mcpPath = getMcpConfigPath();
        const key = getServersKey();
        let config;

        try {
            const content = await fs.readFile(mcpPath, 'utf-8');
            config = JSON.parse(content);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            config = { [key]: {} };
            await fs.mkdir(path.dirname(mcpPath), { recursive: true });
        }

        // Ensure servers object exists under the correct key
        if (!config[key]) {
            config[key] = {};
        }

        // Preserve any existing user-set properties (e.g. autoApprove, env)
        const existing = config[key].MCPBrowser || {};

        // Resolve the latest version visible through the user's configured registry.
        const editor = detectEditor();
        const isVSCode = editor === EDITOR_CONFIGS.vscode;

        // On Windows, `npx` is a .cmd script that requires cmd.exe to execute.
        // VS Code handles this internally, but other editors (Antigravity, Kiro)
        // may use child_process.spawn() without shell:true, which fails to find
        // .cmd files. Wrapping with `cmd /c` ensures cross-editor compatibility.
        const isWindowsNonVSCode = process.platform === 'win32' && !isVSCode;
        const command = isWindowsNonVSCode ? "cmd" : "npx";
        const args = isWindowsNonVSCode
            ? ["/c", "npx", "-y", "mcpbrowser@latest"]
            : ["-y", "mcpbrowser@latest"];

        // For non-VS Code editors, only spread properties they support.
        // Fields like `type` and `description` are VS Code-specific and cause
        // config parse errors in other editors. `disabled` is valid in both
        // VS Code and Antigravity (set via their UI).
        const baseExisting = isVSCode
            ? existing
            : Object.fromEntries(
                Object.entries(existing).filter(([k]) =>
                    ['command', 'args', 'env', 'cwd', 'autoApprove', 'disabled'].includes(k)
                )
            );
        const { env: _existingEnv, ...baseExistingWithoutEnv } = baseExisting;

        const env = { ...(existing.env || {}) };
        if (env.npm_config_registry === "https://registry.npmjs.org") {
            delete env.npm_config_registry;
        }

        const mcpEntry = {
            ...baseExistingWithoutEnv,
            command,
            args,
            ...(Object.keys(env).length > 0 ? { env } : {}),
        };

        // `type` and `description` are VS Code-specific fields.
        // Antigravity and Kiro do not support them and fail to start
        // MCP servers when unknown fields are present.
        if (isVSCode) {
            mcpEntry.type = "stdio";
            mcpEntry.description = "Load and interact with any web page using a real browser with full JavaScript execution and login support. Use when: you need to fetch a webpage, read a link, open a URL, check a website, or access any HTTP/HTTPS resource — especially pages that require JavaScript rendering or user authentication. Handles login flows, SSO, CAPTCHA, and anti-bot protection automatically. Leverages the user's existing browser session. Works on all sites including those behind authentication.";
        }

        config[key].MCPBrowser = mcpEntry;

        // Write back to file with pretty formatting
        await fs.writeFile(mcpPath, JSON.stringify(config, null, 2), 'utf-8');

        return true;
    } catch (error) {
        console.error('Error configuring MCPBrowser:', error);
        throw error;
    }
}

/**
 * Remove MCPBrowser configuration from mcp.json
 */
async function removeMcpBrowser() {
    try {
        const mcpPath = getMcpConfigPath();
        const content = await fs.readFile(mcpPath, 'utf-8');
        const config = JSON.parse(content);
        const key = getServersKey();
        // Check editor's expected key first, then fall back
        const servers = config[key] || config.servers || config.mcpServers;
        const actualKey = config[key] ? key : (config.servers ? 'servers' : 'mcpServers');

        if (servers && servers.MCPBrowser) {
            delete config[actualKey].MCPBrowser;
            await fs.writeFile(mcpPath, JSON.stringify(config, null, 2), 'utf-8');
            return true;
        }

        return false;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return false;
        }
        console.error('Error removing MCPBrowser:', error);
        throw error;
    }
}

/**
 * Extension activation
 *
 * Flow:
 *   1. Resolve WSL paths (needed for correct mcp.json location)
 *   2. Register "Configure" and "Remove" commands
 *   3. Check if MCPBrowser is already configured in mcp.json:
 *      a. YES → silently update npm package if extension version changed (fire-and-forget)
 *      b. NO  → configure immediately, then silently pre-install the package
 *
 * Package installation is fire-and-forget so it does not block editor activation.
 * Configuration is awaited so mcp.json is present when activation completes.
 */
async function activate(context) {
    console.log('MCPBrowser extension is now active');

    // Resolve WSL paths before any config checks
    await resolveWSLPaths();

    // Register configure command
    let configureCommand = vscode.commands.registerCommand('mcpbrowser.configure', async () => {
        try {
            const configured = await isMcpBrowserConfigured();

            if (configured) {
                const action = await vscode.window.showWarningMessage(
                    'MCPBrowser is already configured. Do you want to update it?',
                    'Update',
                    'Cancel'
                );

                if (action !== 'Update') {
                    return;
                }
            }

            // Check if Node.js/npm is installed
            const nodeInstalled = await checkNodeInstalled();
            if (!nodeInstalled) {
                const action = await vscode.window.showErrorMessage(
                    'Node.js is not installed. MCPBrowser requires Node.js to function. Would you like to download it?',
                    'Download Node.js',
                    'Cancel'
                );

                if (action === 'Download Node.js') {
                    vscode.env.openExternal(vscode.Uri.parse('https://nodejs.org/'));
                }
                return;
            }

            // Write the configuration first. The entry uses npx, so the optional
            // global pre-install must not prevent MCPBrowser from being configured.
            await configureMcpBrowser();

            const installed = await installMcpBrowser(context);
            if (installed) {
                await context.globalState.update(
                    'mcpbrowser.installedVersion',
                    getExtensionVersion(context)
                );
            }

            vscode.window.showInformationMessage('✓ MCPBrowser configured successfully!');
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to configure MCPBrowser: ${error.message}`
            );
        }
    });

    // Register remove command
    let removeCommand = vscode.commands.registerCommand('mcpbrowser.remove', async () => {
        try {
            const confirm = await vscode.window.showWarningMessage(
                'Are you sure you want to remove MCPBrowser configuration?',
                'Remove',
                'Cancel'
            );

            if (confirm !== 'Remove') {
                return;
            }

            const removed = await removeMcpBrowser();

            if (removed) {
                vscode.window.showInformationMessage(
                    '✓ MCPBrowser configuration removed. Restart VS Code for changes to take effect.'
                );
            } else {
                vscode.window.showInformationMessage(
                    'MCPBrowser was not configured.'
                );
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to remove MCPBrowser: ${error.message}`
            );
        }
    });

    context.subscriptions.push(configureCommand);
    context.subscriptions.push(removeCommand);

    // ── Auto-update or first-time setup ──────────────────────────────────────
    // Package updates are fire-and-forget so they never block activation.
    // Race note: if a user triggers "Configure MCPBrowser" command while the
    // background install is still running, both may write mcp.json. This is safe
    // because configureMcpBrowser() is idempotent — the last write wins with
    // identical content.
    let configured;
    try {
        configured = await isMcpBrowserConfigured();
    } catch (error) {
        console.error('MCPBrowser: Could not read mcp.json:', error.message);
        vscode.window.showErrorMessage(
            `MCPBrowser could not read mcp.json: ${error.message}`
        );
        return;
    }
    if (configured) {
        // PATH A — Already configured: silently update npm package when the
        // extension version changes (e.g., marketplace auto-updated the extension).
        // Also re-writes mcp.json to pick up any config structure changes.
        const currentVersion = getExtensionVersion(context);
        const lastSetupVersion = context.globalState.get('mcpbrowser.installedVersion');
        if (lastSetupVersion !== currentVersion) {
            installMcpBrowser(context, { silent: true }).then(installed => {
                if (installed) {
                    context.globalState.update('mcpbrowser.installedVersion', currentVersion);
                    configureMcpBrowser().catch(err =>
                        console.error('MCPBrowser: Failed to update mcp.json:', err.message)
                    );
                }
            });
        }
    } else {
        // PATH B — Not configured: auto-install + auto-configure on first activation.
        // The `dontAskAgain` flag was originally for the interactive prompt; it now
        // also prevents silent auto-configuration (user explicitly opted out).
        const dontAskAgain = context.globalState.get('mcpbrowser.dontAskAgain', false);
        if (!dontAskAgain) {
            const nodeInstalled = await checkNodeInstalled();
            if (nodeInstalled) {
                try {
                    // The configured command uses npx, so writing mcp.json must not
                    // depend on the optional global package pre-install succeeding.
                    await configureMcpBrowser();
                    console.log('MCPBrowser: Auto-configured successfully.');
                } catch (err) {
                    console.error('MCPBrowser: Auto-configure failed:', err.message);
                    vscode.window.showErrorMessage(
                        `Failed to configure MCPBrowser automatically: ${err.message}`
                    );
                    return;
                }

                installMcpBrowser(context, { silent: true }).then(installed => {
                    if (installed) {
                        context.globalState.update(
                            'mcpbrowser.installedVersion',
                            getExtensionVersion(context)
                        );
                    }
                });
            }
        }
    }
}

/**
 * Extension deactivation
 */
function deactivate() {}

module.exports = {
    activate,
    deactivate,
    // Exported for testing — used by tests/extension.test.js
    EDITOR_CONFIGS,
    detectEditor,
    getMcpConfigPath,
    getServersKey,
    checkNodeInstalled,
    isMcpBrowserConfigured,
    configureMcpBrowser,
    removeMcpBrowser,
    installMcpBrowser,
    getExtensionVersion,
    isWSL,
    resolveWSLPaths,
    // Allow tests to set/reset the cached WSL AppData path
    _setCachedWSLAppData: (val) => { cachedWSLAppData = val; },
    _getCachedWSLAppData: () => cachedWSLAppData
};
