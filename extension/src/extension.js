const vscode = require('vscode');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

/**
 * Get the path to VS Code's mcp.json configuration file
 */
function getMcpConfigPath() {
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA, 'Code', 'User', 'mcp.json');
    }
    // macOS and Linux
    return path.join(os.homedir(), '.config', 'Code', 'User', 'mcp.json');
}

/**
 * Check if MCPBrowser is already configured in mcp.json
 */
async function isMcpBrowserConfigured() {
    try {
        const mcpPath = getMcpConfigPath();
        const content = await fs.readFile(mcpPath, 'utf-8');
        const config = JSON.parse(content);
        return config.servers && config.servers.MCPBrowser !== undefined;
    } catch (error) {
        // File doesn't exist or can't be read
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
        let installCmd = 'npm install -g mcpbrowser@latest';
        
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
        let config;

        try {
            const content = await fs.readFile(mcpPath, 'utf-8');
            config = JSON.parse(content);
        } catch (error) {
            // File doesn't exist, create new config
            config = { servers: {} };
            // Ensure directory exists
            await fs.mkdir(path.dirname(mcpPath), { recursive: true });
        }

        // Ensure servers object exists
        if (!config.servers) {
            config.servers = {};
        }

        // Add MCPBrowser configuration
        config.servers.MCPBrowser = {
            type: "stdio",
            command: "npx",
            args: ["-y", "mcpbrowser@latest"],
            description: "Use AUTOMATICALLY on 401/403 errors, login pages, SSO prompts, or anti-bot blocks. First domain request: ask user confirmation (browser opens for auth). Subsequent same-domain: use automatically (session preserved). Returns HTML from authenticated Chrome session. Handles Microsoft, GitHub, AWS, Google, corporate sites."
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

        if (config.servers && config.servers.MCPBrowser) {
            delete config.servers.MCPBrowser;
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
            'MCPBrowser is available! Would you like to configure it for GitHub Copilot?',
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
            
            // Step 1: Install npm package
            const installed = await installMcpBrowser();
            if (!installed) {
                return; // Installation failed, abort
            }
            
            // Step 2: Configure mcp.json
            await configureMcpBrowser();
            
            const restart = await vscode.window.showInformationMessage(
                '✓ MCPBrowser configured successfully! Restart VS Code to use it with GitHub Copilot.',
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
    deactivate
};
