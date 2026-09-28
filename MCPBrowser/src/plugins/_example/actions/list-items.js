import { ExampleActionResponse, validateLimit } from '../helpers.js';
import { ITEM_DATE, ITEM_ROW, ITEM_TITLE } from '../selectors.js';
import { PluginAction } from '../../../core/actions.js';

async function listItems({ page, params }) {
  const limit = validateLimit(params?.limit);
  const items = await page.evaluate(
    ({ rowSelector, titleSelector, dateSelector, maxItems }) =>
      Array.from(document.querySelectorAll(rowSelector))
        .slice(0, maxItems)
        .map((row) => ({
          title: row.querySelector(titleSelector)?.textContent?.trim() || 'Untitled',
          date: row.querySelector(dateSelector)?.textContent?.trim() || '',
        })),
    {
      rowSelector: ITEM_ROW,
      titleSelector: ITEM_TITLE,
      dateSelector: ITEM_DATE,
      maxItems: limit,
    },
  );

  return new ExampleActionResponse(items, `Example action returned ${items.length} item(s).`, [
    'Use get_item_detail to read a specific item.',
  ]);
}

export const listItemsAction = new PluginAction({
  name: 'list_items',
  description: 'List items from the example page',
  params: [
    {
      name: 'limit',
      type: 'number',
      description: 'Maximum number of items to return (default: 10)',
      required: false,
      default: 10,
    },
  ],
  response: ExampleActionResponse,
  handler: listItems,
});
