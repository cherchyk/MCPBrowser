import { ErrorResponse } from '../../../core/responses.js';
import { ExampleActionResponse } from '../helpers.js';
import { ITEM_BODY, ITEM_TITLE } from '../selectors.js';
import { PluginAction } from '../../../core/actions.js';

async function getItemDetail({ page, params }) {
  if (typeof params?.itemId !== 'string' || params.itemId.length === 0) {
    return new ErrorResponse('itemId is required.', ['Use list_items to see available item IDs.']);
  }

  const detail = await page.evaluate(
    ({ id, titleSelector, bodySelector }) => {
      const element = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!element) return null;
      return {
        id,
        title: element.querySelector(titleSelector)?.textContent?.trim() || '',
        body: element.querySelector(bodySelector)?.textContent?.trim() || '',
      };
    },
    {
      id: params.itemId,
      titleSelector: ITEM_TITLE,
      bodySelector: ITEM_BODY,
    },
  );

  if (!detail) {
    return new ErrorResponse(`Item '${params.itemId}' was not found.`, [
      'Verify the item ID.',
      'Use list_items to see available items.',
    ]);
  }

  return new ExampleActionResponse(detail, `Read example item '${detail.id}'.`, [
    'Use list_items to return to the item list.',
  ]);
}

export const getItemDetailAction = new PluginAction({
  name: 'get_item_detail',
  description: 'Get details for a specific item by ID',
  params: [{ name: 'itemId', type: 'string', description: 'Item identifier', required: true }],
  response: ExampleActionResponse,
  handler: getItemDetail,
});
