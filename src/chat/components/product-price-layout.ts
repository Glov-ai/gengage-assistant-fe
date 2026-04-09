import type { ChatUISpecRenderContext, ProductPriceOriginalStyle } from '../types.js';

export function discountReasonFromProduct(product: Record<string, unknown> | undefined): string | undefined {
  if (!product) return undefined;
  const raw =
    product['discountReason'] ??
    product['discount_reason'] ??
    product['campaignReason'] ??
    product['campaign_reason'];
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

/** Campaign/discount reason line only when `productPriceUi.showCampaignReason === true`. */
export function campaignReasonForDisplay(
  ctx: ChatUISpecRenderContext,
  product: Record<string, unknown> | undefined,
): string | undefined {
  if (ctx.productPriceUi?.showCampaignReason !== true) return undefined;
  return discountReasonFromProduct(product);
}

/**
 * Per-product `originalPriceStyle` / `price_original_style` overrides widget config.
 * Default: `strikethrough`; `inline` = side-by-side row without strike-through on list price.
 */
export function resolveOriginalPriceStyle(
  ctx: ChatUISpecRenderContext,
  product: Record<string, unknown> | undefined,
): ProductPriceOriginalStyle {
  const fromProduct = product?.['originalPriceStyle'] ?? product?.['price_original_style'];
  if (fromProduct === 'inline' || fromProduct === 'strikethrough') return fromProduct;
  const fromConfig = ctx.productPriceUi?.originalPriceStyle;
  if (fromConfig === 'inline' || fromConfig === 'strikethrough') return fromConfig;
  return 'strikethrough';
}

export function createCampaignReasonElement(text: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'gengage-chat-campaign-reason';
  el.textContent = text;
  return el;
}
