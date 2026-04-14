import type { ChatUISpecRenderContext, ProductPriceOriginalStyle } from '../types.js';
import { isSafeImageUrl } from '../../common/safe-html.js';
import { addImageErrorHandler } from '../../common/product-utils.js';

export function discountReasonFromProduct(product: Record<string, unknown> | undefined): string | undefined {
  if (!product) return undefined;
  const raw =
    product['discountReason'] ?? product['discount_reason'] ?? product['campaignReason'] ?? product['campaign_reason'];
  if (typeof raw !== 'string') return undefined;
  const t = raw.trim();
  return t.length > 0 ? t : undefined;
}

export function campaignReasonForDisplay(
  ctx: ChatUISpecRenderContext,
  product: Record<string, unknown> | undefined,
): string | undefined {
  if (ctx.productPriceUi?.showCampaignReason !== true) return undefined;
  return discountReasonFromProduct(product);
}

/**
 * Per-product `originalPriceStyle` / `price_original_style` override config.
 * Default `strikethrough`; `inline` uses a separator row without a strike line.
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

export function resolveCampaignBadgeLogoUrl(
  ctx: ChatUISpecRenderContext,
  product: Record<string, unknown> | undefined,
): string | undefined {
  const keys = ['campaignReasonLogoUrl', 'campaign_reason_logo_url', 'discountBadgeLogoUrl', 'discount_badge_logo_url'];
  for (const k of keys) {
    const v = product?.[k];
    if (typeof v === 'string' && v.trim()) {
      const u = v.trim();
      if (isSafeImageUrl(u)) return u;
    }
  }
  const fromConfig = ctx.productPriceUi?.campaignBadgeLogoUrl;
  if (typeof fromConfig === 'string' && fromConfig.trim()) {
    const u = fromConfig.trim();
    if (isSafeImageUrl(u)) return u;
  }
  return undefined;
}

/**
 * Single bordered badge: optional logo, campaign line (body text), sale price — gradient border, transparent fill.
 */
export function createCampaignPriceBadge(options: {
  reasonText: string;
  salePriceFormatted: string;
  logoUrl?: string;
}): HTMLElement {
  const badge = document.createElement('div');
  badge.className = 'gengage-chat-campaign-price-badge';
  badge.dataset['gengagePart'] = 'campaign-price-badge';

  if (options.logoUrl) {
    const logoWrap = document.createElement('div');
    logoWrap.className = 'gengage-chat-campaign-price-badge__logo';
    const img = document.createElement('img');
    img.alt = '';
    img.loading = 'lazy';
    img.src = options.logoUrl;
    addImageErrorHandler(img);
    logoWrap.appendChild(img);
    badge.appendChild(logoWrap);
  }

  const body = document.createElement('div');
  body.className = 'gengage-chat-campaign-price-badge__body';

  const reason = document.createElement('div');
  reason.className = 'gengage-chat-campaign-price-badge__reason';
  reason.textContent = options.reasonText;

  const sale = document.createElement('span');
  sale.className = 'gengage-chat-campaign-price-badge__sale';
  sale.textContent = options.salePriceFormatted;

  body.appendChild(reason);
  body.appendChild(sale);
  badge.appendChild(body);
  return badge;
}
