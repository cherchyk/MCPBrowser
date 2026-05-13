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
 *       → Silently install npm package + write mcp.json (fire-and-forget, no user prompt).
 *   - Both paths are non-blocking — they do NOT await, so activation returns immediately.
 *
 * Manual commands:
 *   - "Configure MCPBrowser"  → interactive install + config (shows progress toasts)
 *   - "Remove MCPBrowser"     → deletes MCPBrowser entry from mcp.json
 *
 * VERSION STRATEGY
 * ================
 * - `installMcpBrowser()` installs `mcpbrowser@<extension-version>` globally as a cache.
 * - mcp.json args use `mcpbrowser@latest` so npx resolves the latest at runtime.
 * - The global install ensures npx doesn't need to download on first run.
 * - `getSafeVersion(context)` validates the version string against semver to prevent
 *   command injection (the version is interpolated into a shell command).
 *
 * GLOBAL STATE KEYS (context.globalState)
 * =======================================
 * - `mcpbrowser.installedVersion` — last npm-installed version (avoids redundant installs)
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
        return servers && servers.MCPBrowser !== undefined;
    } catch (error) {
        // File doesn't exist or can't be read
        return false;
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
 * Read the extension version from context.extension.packageJSON and validate it.
 * Returns the version if it matches semver, otherwise returns 'latest'.
 *
 * SECURITY: This value is interpolated into a shell command (`npm install -g mcpbrowser@<version>`).
 * The semver regex rejects anything that could be used for command injection.
 * See: installMcpBrowser()
 *
 * @param {object} context - VS Code extension context (provides extension.packageJSON.version)
 * @returns {string} Validated semver version or 'latest'
 */
function getSafeVersion(context) {
    const version = context?.extension?.packageJSON?.version;
    if (typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(version)) {
        return version;
    }
    return 'latest';
}

/**\n * Install MCPBrowser npm package globally.\n *\n * This installs a PINNED version (`mcpbrowser@<extension-version>`) as a global npm package.\n * The purpose is to pre-cache the package so that `npx -y mcpbrowser@latest` in mcp.json\n * resolves instantly without downloading. See VERSION STRATEGY in the file header.\n *\n * When `silent` is true (used during auto-update/auto-configure), notifications are\n * suppressed and output goes to console only — the user sees no toasts.\n *\n * @param {object} context - VS Code extension context (for getSafeVersion)\n * @param {object} [options] - Options\n * @param {boolean} [options.silent=false] - When true, suppress notification toasts (logs to console only)\n * @returns {Promise<boolean>} true if install succeeded\n */
async function installMcpBrowser(context, options = {}) {
    const { silent = false } = options;
    try {
        const safeVersion = getSafeVersion(context);

        if (silent) {
            console.log(`MCPBrowser: Installing npm package (mcpbrowser@${safeVersion})...`);
        } else {
            vscode.window.showInformationMessage('Installing MCPBrowser npm package...');
        }
        
        // Try with sudo if in Linux/Mac environment (like dev containers)
        let installCmd = `npm install -g mcpbrowser@${safeVersion}`;
        
        // Check if we need sudo (Linux/Mac and not running as root)
        if (process.platform !== 'win32' && process.getuid && process.getuid() !== 0) {
            // Check if sudo is available
            try {
                await execPromise('which sudo');
                installCmd = 'sudo ' + installCmd;
            } catch {
                // sudo not available, try without it
            }
        }
        
        await execPromise(installCmd);
        
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
            // File doesn't exist, create new config
            config = { [key]: {} };
            // Ensure directory exists
            await fs.mkdir(path.dirname(mcpPath), { recursive: true });
        }

        // Ensure servers object exists under the correct key
        if (!config[key]) {
            config[key] = {};
        }

        // Preserve any existing user-set properties (e.g. autoApprove, env)
        const existing = config[key].MCPBrowser || {};

        // Merge: user properties (spread first) are overridden by our canonical fields.
        // We intentionally use `mcpbrowser@latest` in args — npx resolves the @latest
        // dist-tag at runtime. The global install done by installMcpBrowser() is just
        // a cache so npx doesn't need to download. See VERSION STRATEGY in file header.
        config[key].MCPBrowser = {
            ...existing,
            type: "stdio",
            command: "npx",
            args: ["-y", "mcpbrowser@latest"],
            description: "Load and interact with any web page using a real browser with full JavaScript execution and login support. Use when: you need to fetch a webpage, read a link, open a URL, check a website, or access any HTTP/HTTPS resource — especially pages that require JavaScript rendering or user authentication. Handles login flows, SSO, CAPTCHA, and anti-bot protection automatically. Leverages the user's existing browser session. Works on all sites including those behind authentication."
        };

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
        console.error('Error removing MCPBrowser:', error);
        throw error;
    }
}

/**
 * Check if MCPBrowser npm package is installed globally.
 * NOTE: Currently unused — kept for potential future diagnostics / troubleshooting commands.
 */
async function checkMcpBrowserInstalled() {
    try {
        return new Promise((resolve) => {
            exec('npm list -g mcpbrowser', (error, stdout, stderr) => {
                resolve(stdout.includes('mcpbrowser'));
            });
        });
    } catch (error) {
        return false;
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
 *      b. NO  → silently install + configure (fire-and-forget), unless user opted out
 *
 * IMPORTANT: Steps 3a and 3b are fire-and-forget (not awaited) so they don't block
 * editor activation. Errors are caught and logged to console.
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
            
            // Step 1: Install npm package
            const installed = await installMcpBrowser(context);
            if (!installed) {
                return; // Installation failed, abort
            }
            
            // Step 2: Configure mcp.json
            await configureMcpBrowser();

            // Track installed version to avoid redundant auto-updates
            context.globalState.update('mcpbrowser.installedVersion', getSafeVersion(context));
            
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
    // Both paths are fire-and-forget (not awaited) so they never block activation.
    // Race note: if a user triggers "Configure MCPBrowser" command while the
    // background install is still running, both may write mcp.json. This is safe
    // because configureMcpBrowser() is idempotent — the last write wins with
    // identical content.
    const configured = await isMcpBrowserConfigured();
    if (configured) {
        // PATH A — Already configured: silently update npm package when the
        // extension version changes (e.g., marketplace auto-updated the extension).
        // Also re-writes mcp.json to pick up any config structure changes.
        const currentVersion = getSafeVersion(context);
        const lastInstalled = context.globalState.get('mcpbrowser.installedVersion');
        if (lastInstalled !== currentVersion) {
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
                installMcpBrowser(context, { silent: true }).then(async installed => {
                    if (installed) {
                        try {
                            await configureMcpBrowser();
                            context.globalState.update('mcpbrowser.installedVersion', getSafeVersion(context));
                            console.log('MCPBrowser: Auto-configured successfully.');
                        } catch (err) {
                            console.error('MCPBrowser: Auto-configure failed:', err.message);
                        }
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
    checkMcpBrowserInstalled,   // NOTE: currently unused in production code
    getSafeVersion,
    isWSL,
    resolveWSLPaths,
    // Allow tests to set/reset the cached WSL AppData path
    _setCachedWSLAppData: (val) => { cachedWSLAppData = val; },
    _getCachedWSLAppData: () => cachedWSLAppData
};
