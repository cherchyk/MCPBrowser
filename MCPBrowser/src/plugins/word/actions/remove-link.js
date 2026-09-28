import { PluginAction } from '../../../core/actions.js';
import { WordActionResponse } from '../helpers.js';
import { mutateLink } from './link-common.js';

function removeLink(options) {
  return mutateLink(options, true);
}

export const removeLinkAction = new PluginAction({
  name: 'remove_link',
  description: 'Remove hyperlink formatting from one exact text occurrence',
  params: [
    { name: 'query', type: 'string', description: 'Exact linked text', required: true },
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
  handler: removeLink,
});
