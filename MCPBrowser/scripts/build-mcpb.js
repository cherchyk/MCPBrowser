#!/usr/bin/env node
/**
 * Build script for MCP Bundle (.mcpb) format.
 * Creates a portable ZIP archive that MCP clients can install with one click.
 * 
 * Usage: node scripts/build-mcpb.js
 * Output: dist/mcpbrowser-<version>.mcpb
 * 
 * See: https://github.com/modelcontextprotocol/mcpb/blob/main/MANIFEST.md
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, cpSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// 1. Read package.json for version and metadata
// ---------------------------------------------------------------------------
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

// ---------------------------------------------------------------------------
// 2. Dynamically import action modules to extract tool name + description
// ---------------------------------------------------------------------------
async function getTools() {
  const actionFiles = [
    'fetch-page.js', 'get-current-html.js', 'take-screenshot.js',
    'detect-forms.js', 'click-element.js', 'type-text.js',
    'scroll-page.js', 'navigate-history.js', 'execute-javascript.js',
    'close-tab.js', 'plugin-info.js', 'plugin-action.js'
  ];

  const tools = [];
  for (const file of actionFiles) {
    const mod = await import(pathToFileURL(join(ROOT, 'src', 'actions', file)).href);
    // Each module exports a *_TOOL constant
    const toolExport = Object.values(mod).find(v => v && typeof v === 'object' && v.name && v.description);
    if (toolExport) {
      tools.push({ name: toolExport.name, description: toolExport.description });
    }
  }
  return tools;
}

// ---------------------------------------------------------------------------
// 3. Import prompts
// ---------------------------------------------------------------------------
async function getPrompts() {
  const { PROMPTS } = await import(pathToFileURL(join(ROOT, 'src', 'core', 'prompts.js')).href);
  return PROMPTS.map(p => ({
    name: p.name,
    description: p.description,
    arguments: p.arguments?.map(a => a.name) || []
  }));
}

// ---------------------------------------------------------------------------
// 4. Build manifest.json
// ---------------------------------------------------------------------------
async function buildManifest() {
  const tools = await getTools();
  const prompts = await getPrompts();

  return {
    manifest_version: "0.3",
    name: "mcpbrowser",
    display_name: "MCP Browser",
    version: pkg.version,
    description: pkg.description,
    long_description: "Browser automation MCP server that connects to the user's existing Chromium-based browser (Chrome, Edge, Brave) with all cookies, logins, and SSO sessions intact. Provides 12 tools for fetching pages, clicking elements, typing text, taking screenshots, detecting forms, executing JavaScript, and more. Includes site-specific plugins for optimized interactions with known services.",
    author: {
      name: "cherchyk",
      url: "https://github.com/cherchyk"
    },
    repository: {
      type: "git",
      url: "https://github.com/cherchyk/MCPBrowser.git"
    },
    homepage: "https://github.com/cherchyk/MCPBrowser#readme",
    support: "https://github.com/cherchyk/MCPBrowser/issues",
    icon: "icon.png",
    license: "MIT",
    server: {
      type: "node",
      entry_point: "server/src/mcp-browser.js",
      mcp_config: {
        command: "node",
        args: ["${__dirname}/server/src/mcp-browser.js"],
        env: {}
      }
    },
    tools,
    tools_generated: false,
    prompts,
    prompts_generated: false,
    keywords: [
      "browser", "web-automation", "puppeteer", "chrome", "edge",
      "authentication", "sso", "mcp-server", "scraping"
    ],
    compatibility: {
      platforms: ["darwin", "win32", "linux"],
      runtimes: {
        node: ">=18.0.0"
      }
    }
  };
}

// ---------------------------------------------------------------------------
// 5. Package into .mcpb (ZIP)
// ---------------------------------------------------------------------------
async function build() {
  const distDir = join(ROOT, 'dist');
  const stageDir = join(distDir, '_mcpb_stage');

  // Clean previous build
  if (existsSync(stageDir)) rmSync(stageDir, { recursive: true });
  mkdirSync(join(stageDir, 'server'), { recursive: true });

  // Generate manifest.json
  const manifest = await buildManifest();
  writeFileSync(join(stageDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`✅ manifest.json (${manifest.tools.length} tools, ${manifest.prompts.length} prompts)`);

  // Copy icon
  const iconSrc = join(ROOT, '..', 'VSCodeExtension', 'icon.png');
  if (existsSync(iconSrc)) {
    cpSync(iconSrc, join(stageDir, 'icon.png'));
    console.log('✅ icon.png');
  } else {
    console.log('⚠️  icon.png not found at VSCodeExtension/icon.png — skipping');
  }

  // Copy server files (src/ + package.json)
  cpSync(join(ROOT, 'src'), join(stageDir, 'server', 'src'), { recursive: true });
  cpSync(join(ROOT, 'package.json'), join(stageDir, 'server', 'package.json'));
  console.log('✅ server/src + server/package.json');

  // Install production dependencies in staging (clean, minimal node_modules)
  console.log('📦 Installing production dependencies...');
  execSync('npm install --omit=dev --ignore-scripts', {
    cwd: join(stageDir, 'server'),
    stdio: 'pipe'
  });
  // Move node_modules up to bundle root (MCPB convention)
  const nmStaged = join(stageDir, 'server', 'node_modules');
  if (existsSync(nmStaged)) {
    cpSync(nmStaged, join(stageDir, 'node_modules'), { recursive: true });
    rmSync(nmStaged, { recursive: true });
  }
  console.log('✅ node_modules (production only)');

  // Create .mcpb ZIP using .NET ZipFile (fast, cross-platform on PowerShell/Node)
  const outFile = join(distDir, `mcpbrowser-${pkg.version}.mcpb`);
  if (existsSync(outFile)) rmSync(outFile);

  if (process.platform === 'win32') {
    // .NET ZipFile is orders of magnitude faster than Compress-Archive
    execSync(
      `powershell -NoProfile -Command "Add-Type -Assembly System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory('${stageDir}', '${outFile}')"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`cd "${stageDir}" && zip -r "${outFile}" .`, { stdio: 'inherit' });
  }

  // Clean staging (use system rmdir on Windows — much faster for deep node_modules)
  if (process.platform === 'win32') {
    execSync(`rmdir /s /q "${stageDir}"`, { stdio: 'pipe' });
  } else {
    rmSync(stageDir, { recursive: true });
  }

  const stats = readFileSync(outFile);
  const sizeMB = (stats.length / 1024 / 1024).toFixed(2);
  console.log(`\n📦 ${outFile}`);
  console.log(`   Size: ${sizeMB} MB`);
  console.log(`   Version: ${pkg.version}`);
  console.log(`   Tools: ${manifest.tools.length}`);
  console.log(`   Prompts: ${manifest.prompts.length}`);
}

build().catch(err => {
  console.error('❌ Build failed:', err.message);
  process.exit(1);
});
