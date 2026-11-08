import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const pluginRoot = new URL('plugins/mcpbrowser/', root);
const readJson = (path, base = root) => JSON.parse(readFileSync(new URL(path, base), 'utf8'));
const manifest = readJson('plugin.json', pluginRoot);
const config = readJson('mcp.json', pluginRoot);
const npm = readJson('MCPBrowser/package.json');

test('plugin manifest uses the portable format and synchronized release metadata', () => {
  assert.equal(manifest.$schema, 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json');
  assert.equal(manifest.name, npm.name);
  assert.match(manifest.name, /^(?!.*(?:--|\.\.))[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/);
  assert.ok(manifest.name.length <= 64);
  assert.equal(manifest.version, npm.version);
  assert.equal(manifest.version, readJson('server.json').version);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.ok(manifest.description.length > 0);
  assert.equal(manifest.repository, 'https://github.com/cherchyk/MCPBrowser');
  assert.equal(manifest.author.name, 'cherchyk');
  assert.equal(manifest.license, 'MIT');
  for (const keyword of manifest.keywords) {
    assert.match(keyword, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  }
  assert.deepEqual(Object.keys(manifest).sort(), [
    '$schema',
    'author',
    'description',
    'homepage',
    'keywords',
    'license',
    'name',
    'repository',
    'version',
  ]);
});

test('portable MCP configuration launches exactly the reviewed npm version', () => {
  assert.deepEqual(config, {
    $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json',
    mcpServers: {
      mcpbrowser: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', `mcpbrowser@${manifest.version}`],
      },
    },
  });
  assert.equal(npm.mcpName, readJson('server.json').name);
});

test('the bundled skill is discoverable and references existing MCP tools', () => {
  const skillsRoot = new URL('skills/', pluginRoot);
  assert.deepEqual(readdirSync(skillsRoot), ['mcpbrowser']);
  const skill = readFileSync(new URL('mcpbrowser/SKILL.md', skillsRoot), 'utf8');
  const frontmatter = skill.match(/^---\r?\nname: ([^\r\n]+)\r?\ndescription: ([^\r\n]+)\r?\n---/);
  assert.ok(frontmatter, 'Skill must have name and description frontmatter');
  assert.equal(frontmatter[1], 'mcpbrowser');
  assert.ok(frontmatter[2].length > 0 && frontmatter[2].length <= 1024);
  const actionsRoot = new URL('MCPBrowser/src/actions/', root);
  const tools = new Set(
    readdirSync(actionsRoot)
      .filter((name) => name.endsWith('.js'))
      .flatMap((name) => {
        const source = readFileSync(new URL(name, actionsRoot), 'utf8');
        return [...source.matchAll(/name: '(browser_[a-z_]+)'/g)].map((match) => match[1]);
      }),
  );
  const references = [...skill.matchAll(/`(browser_[a-z_]+)`/g)].map((match) => match[1]);
  assert.ok(references.length > 0);
  for (const name of references) {
    assert.ok(tools.has(name), `Unknown MCP tool in skill: ${name}`);
  }
});

test('the standalone bundle includes the repository license', () => {
  assert.equal(
    readFileSync(new URL('LICENSE', pluginRoot), 'utf8').replaceAll('\r\n', '\n'),
    readFileSync(new URL('LICENSE', root), 'utf8').replaceAll('\r\n', '\n'),
  );
});
