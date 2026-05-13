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
 * Install MCPBrowser npm package globally
 */
async function installMcpBrowser() {
    try {
        vscode.window.showInformationMessage('Installing MCPBrowser npm package...');
        
        // Try with sudo if in Linux/Mac environment (like dev containers)
        let installCmd = 'npm install -g mcpbrowser@0.3.1';
        
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
        
        vscode.window.showInformationMessage('MCPBrowser package installed successfully!');
        return true;
    } catch (error) {
        console.error('Error installing MCPBrowser:', error);
        vscode.window.showErrorMessage(`Failed to install MCPBrowser: ${error.message}`);
        return false;
    }
}

/**
 * Add MCPBrowser configuration to mcp.json
 */
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

        // Preserve any existing user-set properties (e.g. autoApprove)
        const existing = config[key].MCPBrowser || {};

        // Add MCPBrowser configuration, merging with existing user properties
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
 * Check if MCPBrowser npm package is installed
 */
async function checkMcpBrowserInstalled() {
    try {
        const { exec } = require('child_process');
        return new Promise((resolve) => {
            exec('npm list -g mcpbrowser', (error, stdout, stderr) => {
                // If package is found globally or locally, it will be in stdout
                resolve(stdout.includes('mcpbrowser'));
            });
        });
    } catch (error) {
        return false;
    }
}

/**
 * Show notification to configure MCPBrowser
 */
async function showConfigurationPrompt(context) {
    const configured = await isMcpBrowserConfigured();
    
    if (!configured) {
        const action = await vscode.window.showInformationMessage(
            'MCPBrowser is available! Would you like to configure it?',
            'Configure Now',
            'Not Now',
            "Don't Ask Again"
        );

        if (action === 'Configure Now') {
            vscode.commands.executeCommand('mcpbrowser.configure');
        } else if (action === "Don't Ask Again") {
            // Store in workspace state to not show again
            context.globalState.update('mcpbrowser.dontAskAgain', true);
        }
    }
}

/**
 * Extension activation
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
            const installed = await installMcpBrowser();
            if (!installed) {
                return; // Installation failed, abort
            }
            
            // Step 2: Configure mcp.json
            await configureMcpBrowser();
            
            const restart = await vscode.window.showInformationMessage(
                '✓ MCPBrowser configured successfully! Restart your editor to use it with your AI agent.',
                'Restart Now',
                'Later'
            );

            if (restart === 'Restart Now') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
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

    // Show configuration prompt if not already configured and user hasn't dismissed
    const dontAskAgain = context.globalState.get('mcpbrowser.dontAskAgain', false);
    if (!dontAskAgain) {
        // Wait a bit after startup to not be intrusive
        setTimeout(() => {
            showConfigurationPrompt(context);
        }, 5000);
    }
}

/**
 * Extension deactivation
 */
function deactivate() {}

module.exports = {
    activate,
    deactivate,
    // Exported for testing
    EDITOR_CONFIGS,
    detectEditor,
    getMcpConfigPath,
    getServersKey,
    checkNodeInstalled,
    isMcpBrowserConfigured,
    configureMcpBrowser,
    removeMcpBrowser,
    installMcpBrowser,
    checkMcpBrowserInstalled,
    showConfigurationPrompt,
    isWSL,
    resolveWSLPaths,
    // Allow tests to set/reset the cached WSL path
    _setCachedWSLAppData: (val) => { cachedWSLAppData = val; },
    _getCachedWSLAppData: () => cachedWSLAppData
};
