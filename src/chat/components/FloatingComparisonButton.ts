/**
 * Floating comparison button.
 *
 * Renders a fixed-position button at the bottom of the product grid wrapper
 * that appears when 2+ products are selected for comparison.
 * Click dispatches a `getComparisonTable` action with the selected SKUs.
 *
 * XSS safety: All text set via textContent.
 */

import type { ChatUISpecRenderContext } from '../types.js';

/**
 * Creates a floating comparison button element.
 * Only meaningful when `selectedSkus.length >= 2`.
 *
 * @param selectedSkus - Array of selected product SKU strings
 * @param ctx - Render context with onAction and i18n
 * @returns The button element
 */
export function renderFloatingComparisonButton(selectedSkus: string[], ctx: ChatUISpecRenderContext): HTMLElement {
  const button = document.createElement('button');
  button.className = 'gengage-chat-comparison-floating-btn';
  button.type = 'button';

  const label = ctx.i18n?.compareSelected ?? 'Karşılaştır';
  button.textContent = `${label} (${selectedSkus.length})`;

  button.addEventListener('click', () => {
    ctx.onAction({
      title: label,
      type: 'getComparisonTable',
      payload: { sku_list: [...selectedSkus] },
    });
  });

  return button;
}
