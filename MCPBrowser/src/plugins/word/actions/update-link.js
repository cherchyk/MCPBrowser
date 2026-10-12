import { PluginAction } from '../../../core/actions.js';
import { WordActionResponse } from '../helpers.js';
import { mutateLink } from './link-common.js';

function updateLink(options) {
  return mutateLink(options, false);
}

export const updateLinkAction = new PluginAction({
  name: 'update_link',
  description: 'Update the hyperlink on one exact linked text occurrence',
  params: [
    { name: 'query', type: 'string', description: 'Exact linked text', required: true },
    { name: 'url', type: 'string', description: 'New http, https, or mailto URL', required: true },
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
  handler: updateLink,
});
