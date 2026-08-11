const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const extensionRoot = path.resolve(__dirname, '..');
const repositoryRoot = path.resolve(extensionRoot, '..');
const sourceRoot = path.join(repositoryRoot, 'MCPBrowser');
const sourceEntryRoot = path.join(sourceRoot, 'src');
const destinationRoot = path.join(extensionRoot, 'server');

const extensionPackage = JSON.parse(
    fs.readFileSync(path.join(extensionRoot, 'package.json'), 'utf8')
);
const serverPackage = JSON.parse(
    fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8')
);

if (extensionPackage.version !== serverPackage.version) {
    throw new Error(
        `Extension version ${extensionPackage.version} does not match server version ${serverPackage.version}.`
    );
}

fs.rmSync(destinationRoot, { recursive: true, force: true });
fs.mkdirSync(destinationRoot, { recursive: true });

const bundledPackage = {
    name: serverPackage.name,
    version: serverPackage.version,
    mcpName: serverPackage.mcpName,
    private: true,
    type: serverPackage.type,
    main: serverPackage.main,
    description: serverPackage.description,
    homepage: serverPackage.homepage,
    engines: serverPackage.engines
};

fs.writeFileSync(
    path.join(destinationRoot, 'package.json'),
    `${JSON.stringify(bundledPackage, null, 2)}\n`
);

const pluginRegistryPath = path.join(sourceEntryRoot, 'plugins.json');
const pluginRegistry = JSON.parse(fs.readFileSync(pluginRegistryPath, 'utf8'));
const enabledPlugins = Array.isArray(pluginRegistry.enabled)
    ? [...new Set(pluginRegistry.enabled)]
    : [];

const entryPoints = {
    'src/mcp-browser': path.join(sourceEntryRoot, 'mcp-browser.js')
};

for (const pluginName of enabledPlugins) {
    if (typeof pluginName !== 'string' || !/^[a-z0-9_-]+$/i.test(pluginName)) {
        throw new Error(`Invalid enabled plugin name: ${JSON.stringify(pluginName)}.`);
    }

    const pluginEntry = path.join(sourceEntryRoot, 'plugins', pluginName, 'index.js');
    if (!fs.existsSync(pluginEntry)) {
        throw new Error(`Enabled plugin entry point is missing: ${pluginEntry}.`);
    }
    entryPoints[`plugins/${pluginName}/index`] = pluginEntry;
}

fs.copyFileSync(pluginRegistryPath, path.join(destinationRoot, 'plugins.json'));

esbuild.buildSync({
    entryPoints,
    outdir: destinationRoot,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    minify: true,
    legalComments: 'eof',
    chunkNames: 'chunks/[name]-[hash]',
    banner: {
        js: "import { createRequire as __createRequire } from 'node:module';const require=__createRequire(import.meta.url);"
    },
    logLevel: 'info'
});

console.log(
    `Prepared bundled MCPBrowser ${serverPackage.version} with ${enabledPlugins.length} enabled plugin(s) in ${destinationRoot}`
);
