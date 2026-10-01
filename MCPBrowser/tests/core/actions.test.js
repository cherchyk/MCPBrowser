import assert from 'assert';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { Action, CoreAction, PluginAction, definePluginActions } from '../../src/core/actions.js';
import { MCPResponse } from '../../src/core/responses.js';
import { ACTIONS as coreActions } from '../../src/actions/index.js';
import { ACTIONS as exampleActions } from '../../src/plugins/_example/actions/index.js';
import { ACTIONS as gcalActions } from '../../src/plugins/gcal/actions/index.js';
import { ACTIONS as gmailActions } from '../../src/plugins/gmail/actions/index.js';
import { ACTIONS as wordActions } from '../../src/plugins/word/actions/index.js';
import { PLUGINS } from '../../src/plugins/index.js';
import { CorePlugin } from '../../src/core/plugins.js';
import { CLI_REGISTRY } from '../../src/cli/registry.js';

class TestResponse extends MCPResponse {}
class OtherResponse extends MCPResponse {}

for (const action of coreActions) {
  assert.ok(action instanceof CoreAction, `${action.tool.name} must be a CoreAction`);
  assert.strictEqual(action.id, action.tool.name);
  assert.ok(action.tool.inputSchema, `${action.tool.name} must define inputSchema`);
  assert.ok(action.response === MCPResponse || action.response.prototype instanceof MCPResponse);
  assert.strictEqual(typeof action.handler, 'function');
  assert.strictEqual(typeof action.execute, 'function');
}

const response = new TestResponse();
const syncAction = new Action({
  tool: { name: 'sync' },
  response: TestResponse,
  handler: () => response,
});
assert.strictEqual(syncAction.execute(), response);

const asyncAction = new Action({
  tool: { name: 'async' },
  response: TestResponse,
  handler: async () => response,
});
assert.strictEqual(await asyncAction.execute(), response);

const invalidAction = new Action({
  tool: { name: 'invalid' },
  response: TestResponse,
  handler: () => ({}),
});
assert.throws(() => invalidAction.execute(), /must return an MCPResponse/);

const wrongResponseAction = new Action({
  tool: { name: 'wrong-response' },
  response: TestResponse,
  handler: () => new OtherResponse(),
});
assert.throws(() => wrongResponseAction.execute(), /must return TestResponse/);

const [pluginAction] = definePluginActions(TestResponse, [
  {
    name: 'example',
    description: 'Example action',
    params: [
      { name: 'query', type: 'string', description: 'Search text', required: true },
      { name: 'limit', type: 'number', required: false, default: 10 },
    ],
    execute: ({ params }) => new TestResponse([params.query]),
  },
]);
assert.ok(pluginAction instanceof PluginAction);
assert.deepStrictEqual(pluginAction.tool.inputSchema.required, ['query']);
assert.strictEqual(pluginAction.tool.inputSchema.properties.limit.default, 10);
assert.strictEqual(pluginAction.toInfo().inputSchema, pluginAction.tool.inputSchema);
assert.ok(pluginAction.execute({ page: {}, params: { query: 'ok' } }) instanceof TestResponse);

for (const action of [...exampleActions, ...gcalActions, ...gmailActions, ...wordActions]) {
  assert.ok(action instanceof PluginAction, `${action.name} must be a PluginAction`);
  assert.ok(action.tool.inputSchema, `${action.name} must define inputSchema`);
  assert.ok(action.tool.outputSchema, `${action.name} must define outputSchema`);
}

for (const plugin of PLUGINS) {
  assert.ok(plugin instanceof CorePlugin, `${plugin.id} must be a CorePlugin`);
  assert.strictEqual(plugin.id, plugin.manifest.name);
}

const cliDefinitionCount = coreActions.reduce((count, action) => {
  if (!action.cli) return count;
  return count + (Array.isArray(action.cli) ? action.cli.length : 1);
}, 0);
assert.strictEqual(CLI_REGISTRY.length, cliDefinitionCount);
for (const entry of CLI_REGISTRY) {
  assert.ok(
    coreActions.some((action) => action.tool === entry.tool && action.execute === entry.action),
  );
}

for (const { relativePath, actions, constructorName } of [
  { relativePath: '../../src/actions/', actions: coreActions, constructorName: 'CoreAction' },
  {
    relativePath: '../../src/plugins/_example/actions/',
    actions: exampleActions,
    constructorName: 'PluginAction',
  },
  {
    relativePath: '../../src/plugins/gcal/actions/',
    actions: gcalActions,
    constructorName: 'PluginAction',
  },
  {
    relativePath: '../../src/plugins/gmail/actions/',
    actions: gmailActions,
    constructorName: 'PluginAction',
  },
  {
    relativePath: '../../src/plugins/word/actions/',
    actions: wordActions,
    constructorName: 'PluginAction',
  },
]) {
  const folder = fileURLToPath(new URL(relativePath, import.meta.url));
  const descriptorCount = readdirSync(folder)
    .filter((file) => file.endsWith('.js') && file !== 'index.js')
    .reduce((count, file) => {
      const source = readFileSync(new URL(file, new URL(relativePath, import.meta.url)), 'utf8');
      if (source.includes(`new ${constructorName}(`)) {
        assert.strictEqual(
          (source.match(/^export\s+/gm) || []).length,
          1,
          `${relativePath}${file} must export only its action descriptor`,
        );
      }
      return count + (source.match(new RegExp(`new ${constructorName}\\(`, 'g')) || []).length;
    }, 0);
  assert.strictEqual(
    actions.length,
    descriptorCount,
    `${relativePath} index must export every action descriptor`,
  );
}

console.log(
  `✅ ${coreActions.length} core actions and all plugin actions satisfy the shared contract`,
);
