import { PluginAction } from '../../../core/actions.js';
import { WordActionResponse } from '../helpers.js';
import { mutateLink } from './link-common.js';

function addLink(options) {
  return mutateLink(options, false);
}

export const addLinkAction = new PluginAction({
  name: 'add_link',
  description: 'Turn one exact text occurrence into a hyperlink',
  params: [
    { name: 'query', type: 'string', description: 'Exact link text', required: true },
    { name: 'url', type: 'string', description: 'http, https, or mailto URL', required: true },
    { name: 'occurrence', type: 'number', description: '1-based occurrence', required: false },
    {
      name: 'matchCase',
      type: 'boolean',
      description: 'Require matching case',
      required: false,
      default: false,
    },
  ],
  response: WordActionResponse,
  handler: addLink,
});
