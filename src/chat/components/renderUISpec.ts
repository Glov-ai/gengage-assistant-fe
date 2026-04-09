/**
 * Renders a json-render UISpec into DOM elements.
 *
 * XSS safety: All text is set via textContent. URLs are validated for safe protocols.
 * No innerHTML is used anywhere in this module.
 */

import type { UISpec, UIElement, ActionPayload } from '../../common/types.js';
import { renderUISpecWithRegistry } from '../../common/renderer/index.js';
import type { UISpecDomRegistry, UISpecDomUnknownRenderer } from '../../common/renderer/index.js';
import type { ChatUISpecRenderContext, ProductSortState } from '../types.js';
import { formatPrice } from '../../common/price-formatter.js';
import type { PriceFormatConfig } from '../../common/price-formatter.js';
import { renderComparisonTable } from './ComparisonTable.js';
import type { ComparisonProduct, ComparisonAttribute } from './ComparisonTable.js';
import { renderReviewHighlights as renderReviewHighlightsComponent } from './ReviewHighlights.js';
import { renderAITopPicks } from './AITopPicks.js';
import { renderGroundingReviewCard } from './GroundingReviewCard.js';
import { renderAIGroupingCards } from './AIGroupingCards.js';
import { renderAISuggestedSearchCards } from './AISuggestedSearchCards.js';
import { renderFloatingComparisonButton } from './FloatingComparisonButton.js';
import { renderProsAndCons } from './ProsAndCons.js';
import { renderCategoriesContainer } from './CategoriesContainer.js';
import { renderHandoffNotice } from './HandoffNotice.js';
import { renderProductSummaryCard } from './ProductSummaryCard.js';
import { isSafeUrl, safeSetAttribute } from '../../common/safe-html.js';
import {
  clampRating,
  clampDiscount,
  addImageErrorHandler,
  createStarRatingElement,
} from '../../common/product-utils.js';
import {
  campaignReasonForDisplay,
  createCampaignReasonElement,
  resolveOriginalPriceStyle,
} from './product-price-layout.js';
import type { ProductPriceOriginalStyle } from '../types.js';

export type UISpecRenderContext = ChatUISpecRenderContext;

export type ChatUISpecRegistry = UISpecDomRegistry<UISpecRenderContext>;

export type { PriceFormatConfig };

/** @deprecated Use context.isMobile instead. Kept as fallback for custom renderers. */
function isMobileViewport(): boolean {
  return window.innerWidth < 768;
}

const DEFAULT_CHAT_UI_SPEC_REGISTRY: ChatUISpecRegistry = {
  ActionButtons: ({ element, context }) => renderActionButtons(element, context),
  ActionButton: ({ element, context }) => renderActionButton(element, context),
  ProductCard: ({ element, context }) => renderProductCard(element, context),
  ProductDetailsPanel: ({ element, context }) => renderProductDetailsPanel(element, context),
  ProductGrid: ({ element, spec, renderElement, context }) => renderProductGrid(element, spec, renderElement, context),
  ReviewHighlights: ({ element, context }) =>
    renderReviewHighlightsComponent(element, {
      emptyReviewsMessage: context.i18n?.emptyReviewsMessage,
      reviewFilterPositive: context.i18n?.reviewFilterPositive,
      reviewFilterNegative: context.i18n?.reviewFilterNegative,
      reviewCustomersMentionSingular: context.i18n?.reviewCustomersMentionSingular,
      reviewCustomersMentionPlural: context.i18n?.reviewCustomersMentionPlural,
      reviewSubjectsHeading: context.i18n?.reviewSubjectsHeading,
    }),
  ComparisonTable: ({ element, context }) => renderComparisonTableElement(element, context),
  AITopPicks: ({ element, context }) => renderAITopPicks(element, context),
  GroundingReviewCard: ({ element, context }) => renderGroundingReviewCard(element, context),
  AIGroupingCards: ({ element, context }) => renderAIGroupingCards(element, context),
  AISuggestedSearchCards: ({ element, context }) => renderAISuggestedSearchCards(element, context),
  ProsAndCons: ({ element }) => renderProsAndCons(element),
  CategoriesContainer: ({ element, context }) => renderCategoriesContainer(element, context),
  HandoffNotice: ({ element, context }) => renderHandoffNotice(element, context),
  ProductSummaryCard: ({ element, context }) => renderProductSummaryCard(element, context),
  Divider: ({ element }) => renderDivider(element),
};

export const defaultChatUnknownUISpecRenderer: UISpecDomUnknownRenderer<UISpecRenderContext> = ({
  element,
  renderElement,
}) => {
  if (import.meta.env?.DEV) {
    console.warn(`[gengage] Unknown ui_spec component type: ${element.type}`);
  }
  if (!element.children || element.children.length === 0) {
    return null;
  }
  const wrapper = document.createElement('div');
  for (const childId of element.children) {
    const rendered = renderElement(childId);
    if (rendered) wrapper.appendChild(rendered);
  }
  return wrapper;
};

export function createDefaultChatUISpecRegistry(): ChatUISpecRegistry {
  return { ...DEFAULT_CHAT_UI_SPEC_REGISTRY };
}

export function renderUISpec(
  spec: UISpec,
  ctx: UISpecRenderContext,
  registry = DEFAULT_CHAT_UI_SPEC_REGISTRY,
  unknownRenderer: UISpecDomUnknownRenderer<UISpecRenderContext> = defaultChatUnknownUISpecRenderer,
): HTMLElement {
  return renderUISpecWithRegistry({
    spec,
    context: ctx,
    registry,
    containerClassName: 'gengage-chat-uispec',
    unknownRenderer,
  });
}

function renderActionButtons(element: UIElement, ctx: UISpecRenderContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-action-buttons';

  const buttons = element.props?.['buttons'] as Array<{ label: string; action: ActionPayload }> | undefined;

  if (buttons) {
    for (const btn of buttons) {
      const button = document.createElement('button');
      button.className = 'gengage-chat-action-btn';
      button.textContent = btn.label;
      button.addEventListener('click', () => ctx.onAction(btn.action));
      container.appendChild(button);
    }
  }

  return container;
}

function renderActionButton(element: UIElement, ctx: UISpecRenderContext): HTMLElement {
  const button = document.createElement('button');
  button.className = 'gengage-chat-action-btn';
  const label = element.props?.['label'];
  if (typeof label === 'string') button.textContent = label;
  const action = element.props?.['action'] as ActionPayload | undefined;
  if (action) {
    button.addEventListener('click', () => ctx.onAction(action));
  }
  return button;
}

function fillProductCardPriceBlock(
  priceBlock: HTMLElement,
  ctx: UISpecRenderContext,
  product: Record<string, unknown>,
  price: string,
  originalPrice: string | undefined,
): void {
  priceBlock.replaceChildren();
  const style = resolveOriginalPriceStyle(ctx, product);
  const hasDiscount = !!(originalPrice && price && originalPrice !== price);
  if (!price || parseFloat(price) <= 0) return;

  if (hasDiscount && style === 'inline') {
    priceBlock.classList.add('gengage-chat-product-card-price-block--inline');
    const row = document.createElement('div');
    row.className = 'gengage-chat-product-card-price-row';
    const cur = document.createElement('span');
    cur.className = 'gengage-chat-product-card-current-price';
    cur.textContent = formatPrice(price, ctx.pricing);
    const sep = document.createElement('span');
    sep.className = 'gengage-chat-product-card-price-sep';
    sep.setAttribute('aria-hidden', 'true');
    const orig = document.createElement('span');
    orig.className = 'gengage-chat-product-card-original-price';
    orig.textContent = formatPrice(originalPrice, ctx.pricing);
    row.appendChild(cur);
    row.appendChild(sep);
    row.appendChild(orig);
    priceBlock.appendChild(row);
    return;
  }

  priceBlock.classList.remove('gengage-chat-product-card-price-block--inline');
  const current = document.createElement('span');
  current.className = 'gengage-chat-product-card-current-price';
  current.textContent = formatPrice(price, ctx.pricing);
  priceBlock.appendChild(current);
  if (hasDiscount) {
    priceBlock.appendChild(document.createTextNode(' '));
    const orig = document.createElement('span');
    orig.className = 'gengage-chat-product-card-original-price';
    orig.textContent = formatPrice(originalPrice!, ctx.pricing);
    priceBlock.appendChild(orig);
  }
}

function fillProductDetailsPriceRow(
  priceRow: HTMLElement,
  ctx: UISpecRenderContext,
  product: Record<string, unknown>,
  price: string,
  originalPrice: string | undefined,
  style: ProductPriceOriginalStyle,
  hasDiscount: boolean,
): void {
  priceRow.classList.remove('gengage-chat-product-details-price--inline');
  priceRow.replaceChildren();
  priceRow.className = 'gengage-chat-product-details-price';
  if (hasDiscount && style === 'inline') {
    priceRow.classList.add('gengage-chat-product-details-price--inline');
    const cur = document.createElement('span');
    cur.className = 'gengage-chat-product-details-current-price';
    cur.textContent = formatPrice(price, ctx.pricing);
    const sep = document.createElement('span');
    sep.className = 'gengage-chat-product-details-price-sep';
    sep.setAttribute('aria-hidden', 'true');
    const oldP = document.createElement('span');
    oldP.className = 'gengage-chat-product-details-original-price';
    oldP.textContent = formatPrice(originalPrice!, ctx.pricing);
    priceRow.appendChild(cur);
    priceRow.appendChild(sep);
    priceRow.appendChild(oldP);
  } else {
    if (hasDiscount) {
      const oldPrice = document.createElement('span');
      oldPrice.className = 'gengage-chat-product-details-original-price';
      oldPrice.textContent = formatPrice(originalPrice!, ctx.pricing);
      priceRow.appendChild(oldPrice);
      priceRow.appendChild(document.createTextNode(' '));
    }
    const currentPrice = document.createElement('span');
    currentPrice.className = 'gengage-chat-product-details-current-price';
    currentPrice.textContent = formatPrice(price, ctx.pricing);
    priceRow.appendChild(currentPrice);
  }

  const discountPercent = productNumber(product, 'discountPercent', 'price_discount_rate');
  if (typeof discountPercent === 'number' && discountPercent > 0) {
    const discountBadge = document.createElement('span');
    discountBadge.className = 'gengage-chat-product-details-discount-badge';
    discountBadge.textContent = `%${clampDiscount(discountPercent)}`;
    priceRow.appendChild(discountBadge);
  }
}

function renderProductCard(element: UIElement, ctx: UISpecRenderContext): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-product-card gds-card gds-product-card gds-card-interactive';

  // Product data may be nested under `product` prop (adapter) or flat in props
  const product = (element.props?.['product'] ?? element.props) as Record<string, unknown> | undefined;
  if (!product) return card;

  // Store SKU as data attribute for comparison mode DOM refresh
  const productSku = product['sku'] as string | undefined;
  if (productSku) card.dataset['sku'] = productSku;
  const action = element.props?.['action'] as ActionPayload | undefined;

  // Make card clickable to show detail in panel (disabled in comparison select mode)
  if (ctx.onProductSelect || action) {
    card.classList.add('gds-clickable');
    card.addEventListener('click', (e) => {
      // Check live DOM: if card is inside a comparison wrapper, mode is active
      if (card.parentElement?.classList.contains('gengage-chat-comparison-select-wrapper')) return;
      if ((e.target as HTMLElement).closest('.gengage-chat-product-card-atc')) return;
      if ((e.target as HTMLElement).closest('.gengage-chat-product-card-cta')) return;
      if (action) {
        ctx.onAction(action);
        return;
      }
      ctx.onProductSelect?.(product);
    });
  }

  const imageUrl = product['imageUrl'] as string | undefined;
  if (imageUrl && isSafeUrl(imageUrl)) {
    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'gengage-chat-product-card-img-wrapper';

    const img = document.createElement('img');
    img.className = 'gengage-chat-product-card-img';
    img.loading = 'lazy';
    safeSetAttribute(img, 'src', imageUrl);
    const name = product['name'] as string | undefined;
    if (name) img.alt = name;
    addImageErrorHandler(img);
    imgWrapper.appendChild(img);

    // Discount badge (top-left of image)
    const discountPercent = product['discountPercent'] as number | undefined;
    if (typeof discountPercent === 'number' && discountPercent > 0) {
      const badge = document.createElement('span');
      badge.className = 'gengage-chat-product-card-discount-badge';
      badge.textContent = `%${clampDiscount(discountPercent)}`;
      imgWrapper.appendChild(badge);
    }

    const imgActions = document.createElement('div');
    imgActions.className = 'gengage-chat-product-card-img-actions';

    // Favorite (top of action stack — matches retail card reference)
    const favSku = product['sku'] as string | undefined;
    if (favSku && ctx.onFavoriteToggle) {
      const heart = document.createElement('button');
      heart.className = 'gengage-chat-favorite-btn';
      heart.type = 'button';
      heart.dataset.gengageFavoriteSku = favSku;
      heart.setAttribute('aria-label', ctx.i18n?.addToFavoritesLabel ?? 'Add to favorites');
      const isFav = ctx.favoritedSkus?.has(favSku) ?? false;
      if (isFav) heart.classList.add('gengage-chat-favorite-btn--active');
      const svgFill = isFav ? 'currentColor' : 'none';
      heart.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${svgFill}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      heart.addEventListener('click', (e) => {
        e.stopPropagation();
        heart.classList.toggle('gengage-chat-favorite-btn--active');
        const svg = heart.querySelector('svg');
        if (svg) {
          svg.setAttribute(
            'fill',
            heart.classList.contains('gengage-chat-favorite-btn--active') ? 'currentColor' : 'none',
          );
        }
        ctx.onFavoriteToggle!(favSku, product);
      });
      imgActions.appendChild(heart);
    }

    // Find similar — icon button + visually hidden label (panel: always visible stack)
    const findSimilarSku = product['sku'] as string | undefined;
    const findSimilarLabel = ctx.i18n?.findSimilarLabel ?? 'Find Similar';
    if (findSimilarSku) {
      const pill = document.createElement('button');
      pill.className = 'gengage-chat-find-similar-pill';
      pill.type = 'button';
      pill.setAttribute('aria-label', findSimilarLabel);
      pill.dataset['tooltip'] = findSimilarLabel;
      pill.innerHTML =
        `<span class="gengage-chat-find-similar-pill-icon" aria-hidden="true">` +
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">` +
        `<circle cx="10.5" cy="10.5" r="6.5"/>` +
        `<path d="M16 16l5.5 5.5"/>` +
        `</svg></span>`;
      const pillText = document.createElement('span');
      pillText.className = 'gengage-chat-find-similar-pill-text';
      pillText.textContent = findSimilarLabel;
      pill.appendChild(pillText);
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.onAction({
          title: findSimilarLabel,
          type: 'findSimilar',
          payload: { sku: findSimilarSku, ...(imageUrl ? { image_url: imageUrl } : {}) },
        });
      });
      imgActions.appendChild(pill);
    }

    if (imgActions.childElementCount > 0) {
      imgWrapper.appendChild(imgActions);
    }

    card.appendChild(imgWrapper);
  }

  const body = document.createElement('div');
  body.className = 'gengage-chat-product-card-body';

  const brand = product['brand'] as string | undefined;
  if (brand) {
    const brandEl = document.createElement('div');
    brandEl.className = 'gengage-chat-product-card-brand';
    brandEl.textContent = brand;
    body.appendChild(brandEl);
  }

  const rating = product['rating'];
  const reviewCount = product['reviewCount'];
  const price = product['price'] as string | undefined;
  const originalPrice = product['originalPrice'] as string | undefined;
  const priceAsync = product['price_async'] as boolean | undefined;
  const campaignReason = campaignReasonForDisplay(ctx, product);
  const priceStyle = resolveOriginalPriceStyle(ctx, product);
  const hasCardDiscount = !!(originalPrice && price && originalPrice !== price && parseFloat(price) > 0);
  const useCardPriceStack = !!(campaignReason || (hasCardDiscount && priceStyle === 'inline'));

  const hasNumericRating = typeof rating === 'number' && Number.isFinite(rating) && rating > 0;
  const metaRow = document.createElement('div');
  metaRow.className = 'gengage-chat-product-card-meta-row';

  const priceBlock = document.createElement('div');
  // Keep .gengage-chat-product-card-price for tests and legacy selectors
  priceBlock.className = 'gengage-chat-product-card-price gengage-chat-product-card-price-block';

  const priceOuter: HTMLElement = useCardPriceStack
    ? (() => {
        const stack = document.createElement('div');
        stack.className = 'gengage-chat-product-card-price-stack';
        if (campaignReason) stack.appendChild(createCampaignReasonElement(campaignReason));
        stack.appendChild(priceBlock);
        return stack;
      })()
    : priceBlock;

  if (priceAsync === true) {
    const skeleton = document.createElement('span');
    skeleton.className = 'gengage-chat-price-skeleton';
    priceBlock.appendChild(skeleton);
    setTimeout(() => {
      if (!skeleton.parentElement) return;
      if (price && parseFloat(price) > 0) {
        fillProductCardPriceBlock(
          priceBlock,
          ctx,
          product,
          price,
          product['originalPrice'] as string | undefined,
        );
      } else {
        skeleton.remove();
      }
    }, 300);
  } else if (price && parseFloat(price) > 0) {
    fillProductCardPriceBlock(priceBlock, ctx, product, price, originalPrice);
  }

  if (priceBlock.childElementCount > 0 || priceAsync === true) {
    metaRow.appendChild(priceOuter);
  }

  if (hasNumericRating) {
    const ratingCompact = document.createElement('div');
    ratingCompact.className = 'gengage-chat-product-card-rating gengage-chat-product-card-rating-compact';
    const rc = clampRating(rating);
    const labelParts = [`${rc.toFixed(1)}`, 'out of 5 stars'];
    if (typeof reviewCount === 'number' && Number.isFinite(reviewCount)) {
      labelParts.push(`(${reviewCount} reviews)`);
    }
    ratingCompact.setAttribute('aria-label', labelParts.join(' '));
    const starEl = document.createElement('span');
    starEl.className = 'gengage-chat-product-card-rating-compact-star';
    starEl.setAttribute('aria-hidden', 'true');
    starEl.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.58 5.23 5.77.84-4.17 4.07.98 5.75L12 16.78l-5.16 2.71.99-5.75L3.66 9.67l5.76-.84L12 3.6z"/></svg>';
    const valEl = document.createElement('span');
    valEl.className = 'gengage-chat-product-card-rating-compact-value';
    valEl.textContent = rc.toFixed(1);
    ratingCompact.appendChild(starEl);
    ratingCompact.appendChild(valEl);
    metaRow.appendChild(ratingCompact);
  }

  if (metaRow.childElementCount === 0) {
    metaRow.classList.add('gengage-chat-product-card-meta-row--empty');
    metaRow.setAttribute('aria-hidden', 'true');
  }
  body.appendChild(metaRow);

  const name = product['name'] as string | undefined;
  if (name) {
    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-product-card-name';
    nameEl.textContent = name;
    nameEl.title = name;
    body.appendChild(nameEl);
  }

  // Stock indicator
  const inStock = product['inStock'];
  if (typeof inStock === 'boolean') {
    const stock = document.createElement('div');
    stock.className = `gengage-chat-product-card-stock ${inStock ? 'is-in-stock' : 'is-out-of-stock'}`;
    stock.textContent = inStock
      ? (ctx.i18n?.inStockLabel ?? 'In Stock')
      : (ctx.i18n?.outOfStockLabel ?? 'Out of Stock');
    body.appendChild(stock);
  }

  card.appendChild(body);

  const url = product['url'] as string | undefined;
  const sku = product['sku'] as string | undefined;
  const cartCode = product['cartCode'] as string | undefined;

  const hasCart = !!(cartCode && sku && inStock !== false);
  const ctaLabel = ctx.i18n?.productCtaLabel ?? 'View';

  if (hasCart) {
    const buyFooter = document.createElement('div');
    buyFooter.className = 'gengage-chat-product-card-buy-footer';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'gengage-chat-product-card-buy-trigger';
    trigger.textContent = ctaLabel;
    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      ctx.onAction({
        title: ctx.i18n?.addToCartButton ?? ctaLabel,
        type: 'addToCart',
        payload: { sku: sku!, cartCode: cartCode!, quantity: 1 },
      });
    });

    buyFooter.appendChild(trigger);
    card.appendChild(buyFooter);
  } else if (action) {
    const cta = document.createElement('button');
    cta.className = 'gengage-chat-product-card-cta';
    cta.type = 'button';
    cta.textContent = action.type === 'launchSingleProduct' ? ctaLabel : action.title || ctaLabel;
    cta.addEventListener('click', (e) => {
      if (card.parentElement?.classList.contains('gengage-chat-comparison-select-wrapper')) {
        e.stopPropagation();
        return;
      }
      ctx.onAction(action);
    });
    card.appendChild(cta);
  } else if (url && isSafeUrl(url)) {
    const cta = document.createElement('a');
    cta.className = 'gengage-chat-product-card-cta';
    safeSetAttribute(cta, 'href', url);
    safeSetAttribute(cta, 'target', '_blank');
    safeSetAttribute(cta, 'rel', 'noopener noreferrer');
    cta.textContent = ctaLabel;
    cta.addEventListener('click', (e) => {
      if (card.parentElement?.classList.contains('gengage-chat-comparison-select-wrapper')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (ctx.onProductClick && sku) {
        e.preventDefault();
        ctx.onProductClick({ sku, url });
      }
    });
    card.appendChild(cta);
  }

  // Wrap with checkbox overlay when comparison select mode is active
  if (ctx.comparisonSelectMode && sku && ctx.onToggleComparisonSku) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gengage-chat-comparison-select-wrapper';
    const isSelected = ctx.comparisonSelectedSkus?.includes(sku) ?? false;
    if (isSelected) wrapper.classList.add('gengage-chat-comparison-select-wrapper--selected');

    const productName = (product['name'] as string | undefined) ?? sku;
    const hintText =
      ctx.i18n?.comparisonSelectCardHint ?? 'Tap anywhere on the card to add or remove it from comparison.';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', `${String(productName)}. ${hintText}`);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'gengage-chat-comparison-checkbox';
    toggle.dataset['selected'] = isSelected ? 'true' : 'false';
    toggle.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    const icon = document.createElement('span');
    icon.className = 'gengage-chat-comparison-checkbox-icon';
    icon.innerHTML = isSelected
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'
      : '<span class="gengage-chat-comparison-checkbox-dot"></span>';
    const label = document.createElement('span');
    label.className = 'gengage-chat-comparison-checkbox-label';
    label.textContent = isSelected
      ? (ctx.i18n?.comparisonSelectedLabel ?? 'Selected')
      : (ctx.i18n?.comparisonSelectLabel ?? 'Select to compare');
    toggle.appendChild(icon);
    toggle.appendChild(label);
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      ctx.onToggleComparisonSku?.(sku);
    });

    const hint = document.createElement('div');
    hint.className = 'gengage-chat-comparison-card-hint';
    hint.setAttribute('aria-hidden', 'true');
    hint.textContent = hintText;

    // Clicking anywhere on the card toggles comparison selection — no product detail navigation.
    // Do NOT manually flip checkbox.checked here: onToggleComparisonSku triggers
    // _refreshComparisonUI which syncs checkbox state from the canonical Set.
    wrapper.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.gengage-chat-comparison-checkbox')) return;
      e.stopPropagation();
      ctx.onToggleComparisonSku?.(sku);
    });

    wrapper.appendChild(toggle);
    wrapper.appendChild(hint);
    wrapper.appendChild(card);
    return wrapper;
  }

  return card;
}

/* clampRating, clampDiscount, addImageErrorHandler, renderStarRating
   are imported from ../../common/product-utils.js */

type ProductFeatureEntry = { key: string; value: string };
type ProductDescriptionContent = { text: string; html?: string };

const COLOR_VARIANT_NAMES = new Set(['color', 'colour', 'renk', 'renk kodu', 'color code']);
const SIZE_VARIANT_NAMES = new Set(['size', 'beden', 'boyut']);
const FINISH_VARIANT_NAMES = new Set(['finish', 'bitiş', 'bitişi']);
const VARIANT_ARRAY_KEYS = [
  'variants',
  'variantOptions',
  'variant_options',
  'productVariants',
  'product_variants',
  'options',
];
const PRODUCT_DESCRIPTION_ALLOWED_TAGS = new Set([
  'H2',
  'H3',
  'H4',
  'P',
  'BR',
  'UL',
  'OL',
  'LI',
  'STRONG',
  'B',
  'EM',
  'I',
]);
const PRODUCT_DESCRIPTION_BLOCKED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED']);

function productString(product: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = product[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
}

function productNumber(product: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = product[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value.replace(',', '.'));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function productBoolean(product: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = product[key];
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function productRecord(product: Record<string, unknown>, ...keys: string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = product[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }
  return undefined;
}

function productStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function productImageList(product: Record<string, unknown>): string[] {
  const urls = [
    ...productStringArray(product['images']),
    productString(product, 'imageUrl', 'image_url', 'image'),
  ].filter((url): url is string => !!url && isSafeUrl(url));
  return Array.from(new Set(urls));
}

function htmlToPlainText(html: string): string {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
  }
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function productDescription(product: Record<string, unknown>): ProductDescriptionContent | undefined {
  const html = productString(product, 'description_html', 'descriptionHtml');
  if (html) {
    const text = htmlToPlainText(html);
    if (text) return { text, html };
  }

  const description = productString(product, 'description');
  return description ? { text: description } : undefined;
}

function normalizeProductFeatures(value: unknown): ProductFeatureEntry[] {
  if (Array.isArray(value)) {
    return value
      .map((entry): ProductFeatureEntry | null => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const key = productString(record, 'key', 'name', 'label', 'title');
        const rawValue = record['value'];
        const val =
          typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean'
            ? String(rawValue).trim()
            : undefined;
        if (!key || !val) return null;
        return { key, value: val };
      })
      .filter((entry): entry is ProductFeatureEntry => entry !== null);
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, rawValue]): ProductFeatureEntry | null => {
        const val =
          typeof rawValue === 'string' || typeof rawValue === 'number' || typeof rawValue === 'boolean'
            ? String(rawValue).trim()
            : undefined;
        if (!key || !val) return null;
        return { key, value: val };
      })
      .filter((entry): entry is ProductFeatureEntry => entry !== null);
  }

  return [];
}

function productFeatureEntries(product: Record<string, unknown>): ProductFeatureEntry[] {
  const features = normalizeProductFeatures(product['features']);
  if (features.length > 0) return features;
  return normalizeProductFeatures(product['specifications']);
}

function productSpecifications(
  product: Record<string, unknown>,
): Record<string, string> | Array<{ key: string; value: string }> | undefined {
  const explicit = product['specifications'];
  const explicitEntries = normalizeProductFeatures(explicit);
  if (explicitEntries.length > 0) {
    return Array.isArray(explicit)
      ? explicitEntries
      : Object.fromEntries(explicitEntries.map((item) => [item.key, item.value]));
  }

  const featureEntries = normalizeProductFeatures(product['features']);
  return featureEntries.length > 0 ? featureEntries : undefined;
}

function variantString(variant: Record<string, unknown>, ...keys: string[]): string | undefined {
  return productString(variant, ...keys);
}

function variantNumber(variant: Record<string, unknown>, ...keys: string[]): number | undefined {
  return productNumber(variant, ...keys);
}

function variantDisplayLabel(variant: Record<string, unknown>): string | undefined {
  return variantString(
    variant,
    'value',
    'option_value',
    'attribute_value',
    'label',
    'title',
    'name',
    'variant_name',
    'sku',
  );
}

function variantTypeName(variant: Record<string, unknown>): string | undefined {
  const explicitType = variantString(variant, 'type', 'attribute', 'option_name', 'attribute_name');
  if (explicitType) return explicitType;
  return variantString(variant, 'value') ? variantString(variant, 'name', 'variant_name') : undefined;
}

function isColorVariant(variant: Record<string, unknown>): boolean {
  const typeName = variantTypeName(variant)?.toLowerCase();
  return !!(
    productString(variant, 'color', 'colour', 'color_hex', 'hex', 'swatch', 'swatchColor') ||
    (typeName && COLOR_VARIANT_NAMES.has(typeName))
  );
}

function safeCssColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes(';')) return undefined;
  if (typeof CSS !== 'undefined' && CSS.supports?.('color', trimmed)) return trimmed;
  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return trimmed;
  return undefined;
}

function variantSwatchColor(variant: Record<string, unknown>): string | undefined {
  const explicit = safeCssColor(variantString(variant, 'swatchColor', 'swatch', 'color_hex', 'hex', 'color', 'colour'));
  if (explicit) return explicit;
  if (!isColorVariant(variant)) return undefined;
  return safeCssColor(variantDisplayLabel(variant));
}

function variantImage(variant: Record<string, unknown>): string | undefined {
  return variantString(variant, 'image', 'imageUrl', 'image_url', 'swatchImage', 'swatch_image');
}

function variantPrice(variant: Record<string, unknown>): number | string | undefined {
  return (
    variantNumber(variant, 'price_discounted', 'priceDiscounted') ??
    variantString(variant, 'price_discounted', 'priceDiscounted') ??
    variantNumber(variant, 'price') ??
    variantString(variant, 'price')
  );
}

function isVariantFacetName(key: string): boolean {
  const normalized = key.trim().toLowerCase();
  return (
    COLOR_VARIANT_NAMES.has(normalized) || SIZE_VARIANT_NAMES.has(normalized) || FINISH_VARIANT_NAMES.has(normalized)
  );
}

function canonicalVariantFacetName(key: string): string {
  const normalized = key.trim().toLowerCase();
  if (normalized === 'renk kodu') return 'Renk';
  if (normalized === 'color code') return 'Color';
  return key.trim();
}

function recordVariantArrays(product: Record<string, unknown>): Array<Record<string, unknown>> | undefined {
  for (const key of VARIANT_ARRAY_KEYS) {
    const value = product[key];
    if (!Array.isArray(value)) continue;
    const variants = value.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item),
    );
    if (variants.length > 0) return variants;
  }
  return undefined;
}

function productVariants(product: Record<string, unknown>): Array<Record<string, unknown>> {
  const explicitVariants = recordVariantArrays(product);
  if (explicitVariants) return explicitVariants;

  const sku = productString(product, 'sku');
  const inStock = productBoolean(product, 'inStock', 'in_stock');
  const fallbackVariants: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();

  const addVariant = (key: string, value: unknown) => {
    if (!isVariantFacetName(key)) return;
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return;
    const variantValue = String(value).trim();
    if (!variantValue) return;
    const variantName = canonicalVariantFacetName(key);
    const dedupeKey = `${variantName.toLowerCase()}:${variantValue.toLowerCase()}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    fallbackVariants.push({
      name: variantName,
      value: variantValue,
      sku,
      inStock,
    });
  };

  const facetHits = productRecord(product, 'facetHits', 'facet_hits');
  if (facetHits) {
    for (const [key, value] of Object.entries(facetHits)) {
      addVariant(key, value);
    }
  }

  for (const feature of productFeatureEntries(product)) {
    addVariant(feature.key, feature.value);
  }

  return fallbackVariants;
}

function variantSectionLabel(variants: Array<Record<string, unknown>>, ctx: UISpecRenderContext): string {
  const types = Array.from(new Set(variants.map(variantTypeName).filter((label): label is string => !!label)));
  if (types.length === 1) return `${variants.length} ${types[0]}`;
  return ctx.i18n?.variantsLabel ?? 'Variants';
}

function renderProductDetailsPanel(element: UIElement, ctx: UISpecRenderContext): HTMLElement {
  const panel = document.createElement('article');
  panel.className = 'gengage-chat-product-details-panel';

  const product = (element.props?.['product'] ?? element.props) as Record<string, unknown> | undefined;
  if (!product) return panel;

  const name = productString(product, 'name');
  const brand = productString(product, 'brand');
  const sku = productString(product, 'sku');
  const cartCode = productString(product, 'cartCode', 'cart_code');
  const price = productString(product, 'price');
  const originalPrice = productString(product, 'originalPrice', 'price_original');
  const priceAsync = productBoolean(product, 'price_async');
  const campaignReason = campaignReasonForDisplay(ctx, product);
  const priceStyleDetails = resolveOriginalPriceStyle(ctx, product);
  const hasDiscountDetails = !!(originalPrice && price && originalPrice !== price);
  const inStock = productBoolean(product, 'inStock', 'in_stock');
  const reviewCount = productNumber(product, 'reviewCount', 'review_count');
  const rating = productNumber(product, 'rating');
  const safeImages = productImageList(product);
  const featureEntries = productFeatureEntries(product).slice(0, 4);

  // Image gallery or single image
  if (safeImages.length > 1) {
    // Gallery with thumbnails + prev/next arrows
    const media = document.createElement('div');
    media.className =
      'gengage-chat-product-details-media gengage-chat-product-details-gallery gengage-chat-product-details-img-wrap';

    const mainImg = document.createElement('img');
    mainImg.className = 'gengage-chat-product-details-img';
    safeSetAttribute(mainImg, 'src', safeImages[0]!);
    mainImg.alt = name ?? 'Product image';
    addImageErrorHandler(mainImg);
    media.appendChild(mainImg);

    const thumbStrip = document.createElement('div');
    thumbStrip.className = 'gengage-chat-product-gallery-thumbs';

    const MAX_VISIBLE_THUMBNAILS = 6;
    let activeThumb: HTMLElement | null = null;
    let activeThumbIdx = 0;

    const i18n = ctx.i18n;
    const prevLabel = i18n?.galleryPrevAriaLabel ?? 'Previous image';
    const nextLabel = i18n?.galleryNextAriaLabel ?? 'Next image';

    const navSvg = (dir: 'prev' | 'next') =>
      dir === 'prev'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className =
      'gengage-chat-product-gallery-nav gengage-chat-product-gallery-nav--prev gds-btn gds-btn-ghost gds-icon-btn';
    prevBtn.setAttribute('aria-label', prevLabel);
    prevBtn.innerHTML = navSvg('prev');

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className =
      'gengage-chat-product-gallery-nav gengage-chat-product-gallery-nav--next gds-btn gds-btn-ghost gds-icon-btn';
    nextBtn.setAttribute('aria-label', nextLabel);
    nextBtn.innerHTML = navSvg('next');

    const updateNavDisabled = (): void => {
      prevBtn.disabled = activeThumbIdx <= 0;
      nextBtn.disabled = activeThumbIdx >= safeImages.length - 1;
    };

    const gotoIndex = (nextIdx: number): void => {
      if (nextIdx < 0 || nextIdx >= safeImages.length || nextIdx === activeThumbIdx) return;
      const nextUrl = safeImages[nextIdx];
      if (!nextUrl) return;
      safeSetAttribute(mainImg, 'src', nextUrl);
      const thumbEls = thumbStrip.querySelectorAll('.gengage-chat-product-gallery-thumb');
      if (activeThumb) activeThumb.classList.remove('gengage-chat-product-gallery-thumb--active');
      if (nextIdx < MAX_VISIBLE_THUMBNAILS && thumbEls[nextIdx]) {
        (thumbEls[nextIdx] as HTMLElement).classList.add('gengage-chat-product-gallery-thumb--active');
        activeThumb = thumbEls[nextIdx] as HTMLElement;
      } else {
        activeThumb = null;
      }
      activeThumbIdx = nextIdx;
      updateNavDisabled();
    };

    for (let i = 0; i < safeImages.length; i++) {
      const imgUrl = safeImages[i]!;
      if (i >= MAX_VISIBLE_THUMBNAILS) break;
      const thumb = document.createElement('img');
      thumb.className = 'gengage-chat-product-gallery-thumb';
      if (i === 0) {
        thumb.classList.add('gengage-chat-product-gallery-thumb--active');
        activeThumb = thumb;
      }
      safeSetAttribute(thumb, 'src', imgUrl);
      thumb.alt = `${name ?? 'Product'} ${i + 1}`;
      thumb.width = 48;
      thumb.height = 48;
      addImageErrorHandler(thumb);
      thumb.addEventListener('click', () => {
        gotoIndex(i);
      });
      thumbStrip.appendChild(thumb);
    }

    // "+N more" indicator when thumbnails exceed limit
    if (safeImages.length > MAX_VISIBLE_THUMBNAILS) {
      const more = document.createElement('span');
      more.className = 'gengage-chat-product-gallery-thumb-more';
      more.textContent = `+${safeImages.length - MAX_VISIBLE_THUMBNAILS}`;
      thumbStrip.appendChild(more);
    }

    prevBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      gotoIndex(activeThumbIdx - 1);
    });
    nextBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      gotoIndex(activeThumbIdx + 1);
    });
    updateNavDisabled();

    // Touch swipe gesture for gallery navigation
    let touchStartX = 0;
    const SWIPE_THRESHOLD = 50;

    mainImg.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        touchStartX = e.changedTouches[0]!.clientX;
      },
      { passive: true },
    );

    mainImg.addEventListener('touchend', (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0]!.clientX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) < SWIPE_THRESHOLD) return;

      const nextIdx =
        diff > 0
          ? Math.min(activeThumbIdx + 1, safeImages.length - 1) // swipe left → next
          : Math.max(activeThumbIdx - 1, 0); // swipe right → prev

      gotoIndex(nextIdx);
    });

    media.appendChild(prevBtn);
    media.appendChild(nextBtn);
    media.appendChild(thumbStrip);

    panel.appendChild(media);
  } else if (safeImages.length === 1) {
    // Single image fallback
    const media = document.createElement('div');
    media.className = 'gengage-chat-product-details-media gengage-chat-product-details-img-wrap';
    const img = document.createElement('img');
    img.className = 'gengage-chat-product-details-img';
    img.loading = 'lazy';
    safeSetAttribute(img, 'src', safeImages[0]!);
    addImageErrorHandler(img);
    img.alt = name ?? 'Product image';
    media.appendChild(img);

    panel.appendChild(media);
  }

  const content = document.createElement('div');
  content.className = 'gengage-chat-product-details-content';

  if (brand && (!name || !name.toLowerCase().startsWith(brand.toLowerCase()))) {
    const brandEl = document.createElement('div');
    brandEl.className = 'gengage-chat-product-details-brand';
    brandEl.textContent = brand;
    content.appendChild(brandEl);
  }

  if (name) {
    const title = document.createElement('h3');
    title.className = 'gengage-chat-product-details-title';
    title.textContent = name;
    title.title = name;
    content.appendChild(title);
  }

  if (typeof rating === 'number' && Number.isFinite(rating) && rating > 0) {
    const ratingRow = document.createElement(sku ? 'button' : 'div');
    ratingRow.className = 'gengage-chat-product-details-rating';
    if (sku) {
      (ratingRow as HTMLButtonElement).type = 'button';
      ratingRow.classList.add('gengage-chat-product-details-rating--clickable');
      ratingRow.setAttribute('aria-label', ctx.i18n?.groundingReviewCta ?? 'Read Reviews');
      ratingRow.addEventListener('click', () => {
        ctx.onAction({
          title: ctx.i18n?.customerReviewsTitle ?? 'Customer Reviews',
          type: 'reviewSummary',
          payload: { sku },
        });
      });
    }
    ratingRow.appendChild(createStarRatingElement(rating));
    const ratingValue = document.createElement('span');
    ratingValue.className = 'gengage-chat-product-details-rating-value';
    ratingValue.textContent = clampRating(rating).toFixed(1);
    ratingRow.appendChild(ratingValue);
    if (typeof reviewCount === 'number' && Number.isFinite(reviewCount)) {
      const count = document.createElement('span');
      count.className = 'gengage-chat-product-details-review-count';
      count.textContent = ` (${reviewCount})`;
      ratingRow.appendChild(count);
    }
    content.appendChild(ratingRow);
  }

  {
    let priceAppendTarget: HTMLElement = content;
    if (campaignReason) {
      const stack = document.createElement('div');
      stack.className = 'gengage-chat-product-details-price-stack';
      stack.appendChild(createCampaignReasonElement(campaignReason));
      content.appendChild(stack);
      priceAppendTarget = stack;
    }

    const priceRow = document.createElement('div');
    priceRow.className = 'gengage-chat-product-details-price';

    if (priceAsync === true) {
      const skeleton = document.createElement('span');
      skeleton.className = 'gengage-chat-price-skeleton';
      priceRow.appendChild(skeleton);
      priceAppendTarget.appendChild(priceRow);
      setTimeout(() => {
        if (!skeleton.parentElement) return;
        if (price && parseFloat(price) > 0) {
          fillProductDetailsPriceRow(
            priceRow,
            ctx,
            product,
            price,
            originalPrice,
            priceStyleDetails,
            hasDiscountDetails,
          );
        } else {
          const host = priceRow.parentElement;
          priceRow.remove();
          if (host?.classList.contains('gengage-chat-product-details-price-stack')) {
            host.remove();
          }
        }
      }, 300);
    } else if (price && parseFloat(price) > 0) {
      fillProductDetailsPriceRow(
        priceRow,
        ctx,
        product,
        price,
        originalPrice,
        priceStyleDetails,
        hasDiscountDetails,
      );
      priceAppendTarget.appendChild(priceRow);
    } else if (campaignReason) {
      const host = priceAppendTarget;
      if (host.classList.contains('gengage-chat-product-details-price-stack')) {
        host.remove();
      }
    }
  }

  if (typeof inStock === 'boolean') {
    const stock = document.createElement('div');
    stock.className = `gengage-chat-product-details-stock ${inStock ? 'is-in-stock' : 'is-out-of-stock'}`;
    stock.textContent = inStock
      ? (ctx.i18n?.inStockLabel ?? 'In Stock')
      : (ctx.i18n?.outOfStockLabel ?? 'Out of Stock');
    content.appendChild(stock);
  }

  // Promotion badges (e.g. "Free Shipping", "Flash Sale") — max 3
  const promotions = product['promotions'] as string[] | undefined;
  if (promotions && promotions.length > 0) {
    const promoBadges = document.createElement('div');
    promoBadges.className = 'gengage-chat-product-details-promos';
    for (const promo of promotions.slice(0, 3)) {
      if (!promo || /%(0(\.0+)?)\s/.test(promo)) continue; // skip zero-value badges
      const badge = document.createElement('span');
      badge.className = 'gengage-chat-product-details-promo-badge';
      badge.textContent = promo;
      badge.title = promo;
      promoBadges.appendChild(badge);
    }
    if (promoBadges.childElementCount > 0) content.appendChild(promoBadges);
  }

  if (featureEntries.length > 0) {
    const facts = document.createElement('dl');
    facts.className = 'gengage-chat-product-details-facts';
    for (const feature of featureEntries) {
      const item = document.createElement('div');
      item.className = 'gengage-chat-product-details-fact';
      const key = document.createElement('dt');
      key.textContent = feature.key;
      const val = document.createElement('dd');
      val.textContent = feature.value;
      item.appendChild(key);
      item.appendChild(val);
      facts.appendChild(item);
    }
    content.appendChild(facts);
  }

  // Variant selector
  const variants = productVariants(product);
  if (variants.length > 0) {
    const variantSection = document.createElement('div');
    variantSection.className = 'gengage-chat-product-variants';

    const variantHeading = document.createElement('div');
    variantHeading.className = 'gengage-chat-product-variants-label';
    variantHeading.textContent = variantSectionLabel(variants, ctx);
    variantSection.appendChild(variantHeading);

    const variantList = document.createElement('div');
    variantList.className = 'gengage-chat-product-variants-list';

    for (const variant of variants) {
      const variantName = variantDisplayLabel(variant);
      const variantSku = variantString(variant, 'sku');
      if (!variantName && !variantSku) continue;

      const btn = document.createElement('button');
      btn.className = 'gengage-chat-product-variant-btn gds-chip';
      btn.type = 'button';
      const labelText = variantName ?? variantSku ?? '';
      btn.title = labelText;
      const variantInStock = productBoolean(variant, 'in_stock', 'inStock');
      if (variantSku && sku && variantSku === sku) {
        btn.classList.add('gengage-chat-product-variant-btn--active');
        btn.setAttribute('aria-pressed', 'true');
      } else {
        btn.setAttribute('aria-pressed', 'false');
      }
      if (variantInStock === false) {
        btn.classList.add('gengage-chat-product-variant-btn--out');
        btn.disabled = true;
      }

      const swatchImage = variantImage(variant);
      const swatchColor = variantSwatchColor(variant);
      if (swatchImage && isSafeUrl(swatchImage)) {
        const swatch = document.createElement('img');
        swatch.className = 'gengage-chat-product-variant-swatch gengage-chat-product-variant-swatch--image';
        safeSetAttribute(swatch, 'src', swatchImage);
        swatch.alt = '';
        swatch.setAttribute('aria-hidden', 'true');
        addImageErrorHandler(swatch);
        btn.appendChild(swatch);
      } else if (swatchColor) {
        const swatch = document.createElement('span');
        swatch.className = 'gengage-chat-product-variant-swatch';
        swatch.setAttribute('aria-hidden', 'true');
        swatch.style.backgroundColor = swatchColor;
        btn.appendChild(swatch);
      }

      const label = document.createElement('span');
      label.className = 'gengage-chat-product-variant-label';
      label.textContent = labelText;
      btn.appendChild(label);

      const nextVariantPrice = variantPrice(variant);
      if (nextVariantPrice && String(nextVariantPrice) !== String(price)) {
        const priceEl = document.createElement('span');
        priceEl.className = 'gengage-chat-product-variant-price';
        priceEl.textContent = formatPrice(String(nextVariantPrice), ctx.pricing);
        btn.appendChild(priceEl);
      }

      if (variantSku && variantSku !== sku) {
        const productName = name ?? '';
        const variantHuman =
          (typeof variant['value'] === 'string' ? variant['value'].trim() : '') ||
          (typeof variant['name'] === 'string' ? variant['name'].trim() : '') ||
          (typeof variant['variant_name'] === 'string' ? variant['variant_name'].trim() : '') ||
          '';
        const launchTitle =
          productName.length > 0
            ? variantHuman.length > 0 && variantHuman !== productName
              ? `${productName} (${variantHuman})`
              : productName
            : labelText;

        btn.addEventListener('click', () => {
          ctx.onAction({
            title: launchTitle,
            type: 'launchVariant',
            payload: { sku: variantSku },
          });
        });
      }
      variantList.appendChild(btn);
    }

    if (variantList.childElementCount > 0) {
      variantSection.appendChild(variantList);
      content.appendChild(variantSection);
    }
  }

  const actionRow = document.createElement('div');
  actionRow.className = 'gengage-chat-product-details-actions';

  const action = element.props?.['action'] as ActionPayload | undefined;
  if (action) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'gengage-chat-product-details-cta gds-btn gds-btn-primary';
    actionBtn.type = 'button';
    actionBtn.textContent = action.title || ctx.i18n?.productCtaLabel || 'View';
    actionBtn.addEventListener('click', () => ctx.onAction(action));
    actionRow.appendChild(actionBtn);
  }

  // Add to Cart — direct add with quantity 1
  if (cartCode && sku && inStock !== false) {
    const addToCartBtn = document.createElement('button');
    addToCartBtn.className = 'gengage-chat-product-details-atc gds-btn gds-btn-primary';
    addToCartBtn.type = 'button';
    addToCartBtn.textContent = ctx.i18n?.addToCartButton ?? 'Add to Cart';
    addToCartBtn.addEventListener('click', () => {
      ctx.onAction({
        title: ctx.i18n?.addToCartButton ?? 'Add to Cart',
        type: 'addToCart',
        payload: { sku, cartCode, quantity: 1 },
      });
    });
    actionRow.appendChild(addToCartBtn);
  }

  const url = productString(product, 'url');
  if (!action && url && isSafeUrl(url)) {
    const cta = document.createElement('a');
    cta.className = 'gengage-chat-product-details-cta gds-btn gds-btn-secondary';
    safeSetAttribute(cta, 'href', url);
    safeSetAttribute(cta, 'target', '_blank');
    safeSetAttribute(cta, 'rel', 'noopener noreferrer');
    cta.textContent = ctx.i18n?.viewOnSiteLabel ?? ctx.i18n?.productCtaLabel ?? 'View on Site';
    cta.addEventListener('click', (e) => {
      if (ctx.onProductClick && sku) {
        e.preventDefault();
        ctx.onProductClick({ sku, url });
      }
    });
    actionRow.appendChild(cta);
  }

  // Share button — copies product URL or triggers native share
  const shareUrl = url;
  if (shareUrl && isSafeUrl(shareUrl)) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'gengage-chat-product-details-share gds-btn gds-btn-ghost gds-icon-btn';
    shareBtn.type = 'button';
    const shareLabel = ctx.i18n?.shareButton ?? 'Share';
    shareBtn.title = shareLabel;
    shareBtn.setAttribute('aria-label', shareLabel);
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    function addCircle(cx: string, cy: string): void {
      const c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('cx', cx);
      c.setAttribute('cy', cy);
      c.setAttribute('r', '3');
      svg.appendChild(c);
    }
    function addLine(x1: string, y1: string, x2: string, y2: string): void {
      const l = document.createElementNS(svgNS, 'line');
      l.setAttribute('x1', x1);
      l.setAttribute('y1', y1);
      l.setAttribute('x2', x2);
      l.setAttribute('y2', y2);
      svg.appendChild(l);
    }
    addCircle('18', '5');
    addCircle('6', '12');
    addCircle('18', '19');
    addLine('8.59', '13.51', '15.42', '17.49');
    addLine('15.41', '6.51', '8.59', '10.49');
    shareBtn.appendChild(svg);
    shareBtn.addEventListener('click', async () => {
      try {
        if (navigator.share) {
          await navigator.share({ title: name ?? '', url: shareUrl });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(shareUrl);
          shareBtn.classList.add('gengage-chat-product-details-share--copied');
          setTimeout(() => shareBtn.classList.remove('gengage-chat-product-details-share--copied'), 1500);
        }
      } catch {
        // Share cancelled or clipboard write denied — ignore
      }
    });
    actionRow.appendChild(shareBtn);
  }

  if (actionRow.childElementCount > 0) {
    content.appendChild(actionRow);
  }

  panel.appendChild(content);

  // Product detail tabs: "Product Info" / "Specifications"
  const description = productDescription(product);
  const specifications = productSpecifications(product);
  if (description || specifications) {
    panel.appendChild(renderProductDetailTabs(description, specifications, ctx));
  }

  return panel;
}

function sanitizeProductDescriptionNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as Element;
  const tagName = element.tagName.toUpperCase();
  if (PRODUCT_DESCRIPTION_BLOCKED_TAGS.has(tagName)) return null;

  if (!PRODUCT_DESCRIPTION_ALLOWED_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    for (const child of Array.from(element.childNodes)) {
      const sanitized = sanitizeProductDescriptionNode(child);
      if (sanitized) fragment.appendChild(sanitized);
    }
    return fragment;
  }

  const sanitizedElement = document.createElement(tagName.toLowerCase());
  for (const child of Array.from(element.childNodes)) {
    const sanitized = sanitizeProductDescriptionNode(child);
    if (sanitized) sanitizedElement.appendChild(sanitized);
  }
  return sanitizedElement;
}

function appendPlainProductDescription(target: HTMLElement, text: string): void {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (paragraphs.length === 0) return;

  for (const paragraph of paragraphs) {
    const p = document.createElement('p');
    p.textContent = paragraph;
    target.appendChild(p);
  }
}

function appendProductDescription(target: HTMLElement, description: ProductDescriptionContent): void {
  target.classList.add('gengage-chat-product-description');

  if (description.html && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(description.html, 'text/html');
    const nodes = Array.from(doc.body.childNodes)
      .map((node) => sanitizeProductDescriptionNode(node))
      .filter((node): node is Node => !!node && (node.nodeType === Node.ELEMENT_NODE || !!node.textContent?.trim()));

    if (nodes.length > 0) {
      for (const node of nodes) target.appendChild(node);
      return;
    }
  }

  appendPlainProductDescription(target, description.text);
}

function renderProductDetailTabs(
  description: ProductDescriptionContent | undefined,
  specifications: Record<string, string> | Array<{ key: string; value: string }> | undefined,
  ctx: UISpecRenderContext,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-product-detail-tabs';

  const tabBar = document.createElement('div');
  tabBar.className = 'gengage-chat-product-detail-tab-bar gds-toolbar';

  const tabPanels: HTMLElement[] = [];

  // Product Info tab
  if (description) {
    const tab = document.createElement('button');
    tab.className = 'gengage-chat-product-detail-tab gds-tab gengage-chat-product-detail-tab--active is-active';
    tab.type = 'button';
    tab.setAttribute('aria-selected', 'true');
    tab.textContent = ctx.i18n?.productInfoTab ?? 'Product Info';
    tabBar.appendChild(tab);

    const panel = document.createElement('div');
    panel.className = 'gengage-chat-product-detail-tab-panel';
    appendProductDescription(panel, description);
    tabPanels.push(panel);
  }

  // Specifications tab
  if (specifications) {
    const tab = document.createElement('button');
    tab.className = `gengage-chat-product-detail-tab gds-tab${!description ? ' gengage-chat-product-detail-tab--active is-active' : ''}`;
    tab.type = 'button';
    tab.setAttribute('aria-selected', description ? 'false' : 'true');
    tab.textContent = ctx.i18n?.specificationsTab ?? 'Specifications';
    tabBar.appendChild(tab);

    const panel = document.createElement('div');
    panel.className = 'gengage-chat-product-detail-tab-panel';
    if (description) {
      panel.style.display = 'none';
    }

    const table = document.createElement('table');
    table.className = 'gengage-chat-product-specs-table';
    const entries = Array.isArray(specifications)
      ? specifications
      : Object.entries(specifications).map(([key, value]) => ({ key, value }));
    for (const entry of entries) {
      const row = document.createElement('tr');
      const keyCell = document.createElement('td');
      keyCell.className = 'gengage-chat-product-specs-key';
      keyCell.textContent = entry.key;
      const valCell = document.createElement('td');
      valCell.className = 'gengage-chat-product-specs-value';
      valCell.textContent = entry.value;
      row.appendChild(keyCell);
      row.appendChild(valCell);
      table.appendChild(row);
    }
    panel.appendChild(table);
    tabPanels.push(panel);
  }

  // Wire up tab switching
  const tabs = tabBar.querySelectorAll('.gengage-chat-product-detail-tab');
  tabs.forEach((tabEl, idx) => {
    tabEl.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('gengage-chat-product-detail-tab--active', 'is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tabEl.classList.add('gengage-chat-product-detail-tab--active', 'is-active');
      tabEl.setAttribute('aria-selected', 'true');
      tabPanels.forEach((p, pIdx) => {
        p.style.display = pIdx === idx ? '' : 'none';
      });
    });
  });

  container.appendChild(tabBar);
  for (const p of tabPanels) container.appendChild(p);
  return container;
}

/** Lucide-style stroke icons (matches ChatDrawer / header SVGs). */
type ProductSortIconKind = 'related' | 'priceAsc' | 'priceDesc';

function productSortIconSvgHtml(kind: ProductSortIconKind): string {
  const a =
    'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  switch (kind) {
    case 'related':
      return `<svg ${a} aria-hidden="true"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>`;
    case 'priceAsc':
      return `<svg ${a} aria-hidden="true"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`;
    case 'priceDesc':
      return `<svg ${a} aria-hidden="true"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>`;
    default:
      return '';
  }
}

function productSortChevronSvgHtml(): string {
  return `<svg class="gengage-chat-product-sort-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;
}

function productSortCheckSvgHtml(): string {
  return `<svg class="gengage-chat-product-sort-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
}

/** Left-right arrows (compare / swap), Lucide arrow-left-right style. */
function comparisonToggleIconSvgHtml(): string {
  const a =
    'width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  return `<svg ${a} aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M16 21l4-4-4-4"/><path d="M4 7h16"/><path d="M20 17H4"/></svg>`;
}

function productSortStatesEqual(a: ProductSortState, b: ProductSortState): boolean {
  return a.type === b.type && a.direction === b.direction;
}

function getSortedChildIds(childIds: string[], spec: UISpec, sort?: ProductSortState): string[] {
  if (!sort || sort.type === 'related') return childIds;

  const withPrice = childIds.map((id) => {
    const el = spec.elements[id];
    const product = el?.props?.['product'] as Record<string, unknown> | undefined;
    const price = product ? Number(product['price']) : NaN;
    return { id, price: Number.isFinite(price) ? price : Infinity };
  });

  withPrice.sort((a, b) => {
    if (a.price === Infinity && b.price === Infinity) return 0;
    if (a.price === Infinity) return 1;
    if (b.price === Infinity) return -1;
    return sort.direction === 'desc' ? b.price - a.price : a.price - b.price;
  });

  return withPrice.map((x) => x.id);
}

function resortGrid(grid: HTMLElement, childIds: string[], spec: UISpec, sort: ProductSortState): void {
  const sorted = getSortedChildIds(childIds, spec, sort);
  // Build map from element ID data attribute to DOM element
  const childMap = new Map<string, HTMLElement>();
  for (const child of Array.from(grid.children) as HTMLElement[]) {
    const elId = child.dataset['elementId'];
    if (elId) childMap.set(elId, child);
  }

  for (const id of sorted) {
    const el = childMap.get(id);
    if (el) grid.appendChild(el);
  }
}

function renderProductGrid(
  element: UIElement,
  spec: UISpec,
  renderElement: (elementId: string) => HTMLElement | null,
  ctx?: UISpecRenderContext,
): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'gengage-chat-product-grid-wrapper';

  const childIds = element.children ?? [];
  const grid = document.createElement('div');
  grid.className = 'gengage-chat-product-grid';

  const inlineHead = ctx?.panelProductListHeading;
  const hasSortToolbar = childIds.length > 1 && ctx?.onSortChange;

  // Sort + compare toolbar (only when >1 children and context has sort support)
  if (hasSortToolbar) {
    const toolbar = document.createElement('div');
    toolbar.className = 'gengage-chat-product-sort-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', ctx.i18n?.sortToolbarAriaLabel ?? 'Sort products');

    let currentSort: ProductSortState = ctx.productSort ?? { type: 'related' };

    const sortOptions: Array<{ label: string; sortState: ProductSortState; icon: ProductSortIconKind }> = [
      { label: ctx.i18n?.sortRelated ?? 'Related', sortState: { type: 'related' }, icon: 'related' },
      {
        label: ctx.i18n?.sortPriceAsc ?? 'Price ↑',
        sortState: { type: 'price', direction: 'asc' },
        icon: 'priceAsc',
      },
      {
        label: ctx.i18n?.sortPriceDesc ?? 'Price ↓',
        sortState: { type: 'price', direction: 'desc' },
        icon: 'priceDesc',
      },
    ];

    const dropdown = document.createElement('div');
    dropdown.className = 'gengage-chat-product-sort-dropdown';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'gengage-chat-product-sort-trigger gds-btn gds-btn-ghost';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const sortAria = ctx.i18n?.sortToolbarAriaLabel ?? 'Sort products';

    const triggerIcon = document.createElement('span');
    triggerIcon.className = 'gengage-chat-product-sort-trigger-icon';
    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'gengage-chat-product-sort-trigger-label';

    const syncTriggerFromSort = (s: ProductSortState): void => {
      const opt = sortOptions.find((o) => productSortStatesEqual(o.sortState, s)) ?? sortOptions[0]!;
      triggerLabel.textContent = opt.label;
      triggerIcon.innerHTML = productSortIconSvgHtml(opt.icon);
      dropdown.dataset['sortIcon'] = opt.icon;
      trigger.setAttribute('aria-label', `${sortAria}: ${opt.label}`);
      trigger.title = opt.label;
    };
    syncTriggerFromSort(currentSort);

    const chevWrap = document.createElement('span');
    chevWrap.className = 'gengage-chat-product-sort-trigger-chevron';
    chevWrap.innerHTML = productSortChevronSvgHtml();

    trigger.appendChild(triggerIcon);
    trigger.appendChild(triggerLabel);
    trigger.appendChild(chevWrap);

    const menu = document.createElement('div');
    menu.className = 'gengage-chat-product-sort-menu gds-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', sortAria);

    const doc = toolbar.ownerDocument;
    let menuOverlayAbort: AbortController | null = null;

    const closeSortMenu = (): void => {
      menu.hidden = true;
      dropdown.classList.remove('gengage-chat-product-sort-dropdown--open');
      trigger.setAttribute('aria-expanded', 'false');
      menuOverlayAbort?.abort();
      menuOverlayAbort = null;
    };

    /** Bubble-phase click avoids fighting trigger mousedown/pointerdown (menu kapanıp tekrar açılması). */
    const onSortMenuOutsideClick = (e: MouseEvent): void => {
      if (!dropdown.classList.contains('gengage-chat-product-sort-dropdown--open')) return;
      if (dropdown.contains(e.target as Node)) return;
      closeSortMenu();
    };

    const onSortMenuEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSortMenu();
      }
    };

    const openSortMenu = (): void => {
      menu.hidden = false;
      dropdown.classList.add('gengage-chat-product-sort-dropdown--open');
      trigger.setAttribute('aria-expanded', 'true');
      menuOverlayAbort = new AbortController();
      const { signal } = menuOverlayAbort;
      doc.addEventListener('click', onSortMenuOutsideClick, { signal });
      doc.addEventListener('keydown', onSortMenuEscape, { capture: true, signal });
    };

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdown.classList.contains('gengage-chat-product-sort-dropdown--open')) {
        closeSortMenu();
      } else {
        openSortMenu();
      }
    });

    for (const opt of sortOptions) {
      const optionBtn = document.createElement('button');
      optionBtn.type = 'button';
      optionBtn.className = 'gengage-chat-product-sort-option gds-menu-option';
      optionBtn.setAttribute('role', 'option');
      const isActive = productSortStatesEqual(currentSort, opt.sortState);
      optionBtn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      if (isActive) optionBtn.classList.add('gengage-chat-product-sort-option--active', 'gds-menu-option-active');
      const sortKey = opt.sortState.type === 'related' ? 'related' : `price-${opt.sortState.direction ?? ''}`;
      optionBtn.dataset['sortKey'] = sortKey;

      const oIcon = document.createElement('span');
      oIcon.className = 'gengage-chat-product-sort-option-icon';
      oIcon.innerHTML = productSortIconSvgHtml(opt.icon);

      const oLabel = document.createElement('span');
      oLabel.className = 'gengage-chat-product-sort-option-label';
      oLabel.textContent = opt.label;

      const oCheck = document.createElement('span');
      oCheck.className = 'gengage-chat-product-sort-option-check';
      oCheck.innerHTML = productSortCheckSvgHtml();
      oCheck.setAttribute('aria-hidden', 'true');
      if (!isActive) oCheck.classList.add('gengage-chat-product-sort-option-check--hidden');

      optionBtn.appendChild(oIcon);
      optionBtn.appendChild(oLabel);
      optionBtn.appendChild(oCheck);

      optionBtn.addEventListener('click', () => {
        currentSort = opt.sortState;
        ctx.onSortChange?.(opt.sortState);
        resortGrid(grid, childIds, spec, opt.sortState);
        menu.querySelectorAll('.gengage-chat-product-sort-option').forEach((el) => {
          const btn = el as HTMLButtonElement;
          const active = btn.dataset['sortKey'] === sortKey;
          btn.classList.toggle('gengage-chat-product-sort-option--active', active);
          btn.classList.toggle('gds-menu-option-active', active);
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
          const check = btn.querySelector('.gengage-chat-product-sort-option-check');
          check?.classList.toggle('gengage-chat-product-sort-option-check--hidden', !active);
        });
        syncTriggerFromSort(opt.sortState);
        closeSortMenu();
      });

      menu.appendChild(optionBtn);
    }

    dropdown.appendChild(trigger);
    dropdown.appendChild(menu);
    toolbar.appendChild(dropdown);

    if (ctx.onToggleComparisonSku) {
      const compareBtn = document.createElement('button');
      compareBtn.className = 'gengage-chat-comparison-toggle-btn gds-btn gds-btn-ghost';
      compareBtn.type = 'button';
      if (ctx.comparisonSelectMode) {
        compareBtn.classList.add('gengage-chat-comparison-toggle-btn--active');
      }
      if (ctx.isStreaming) {
        compareBtn.classList.add('gengage-chat-comparison-toggle-btn--hidden');
      }
      const compareIcon = document.createElement('span');
      compareIcon.className = 'gengage-chat-comparison-toggle-icon';
      compareIcon.innerHTML = comparisonToggleIconSvgHtml();
      const compareLabel = document.createElement('span');
      compareLabel.className = 'gengage-chat-comparison-toggle-label';
      const compareText = ctx.i18n?.compareSelected ?? 'Compare';
      compareLabel.textContent = compareText;
      compareBtn.setAttribute('aria-label', compareText);
      compareBtn.title = compareText;
      compareBtn.appendChild(compareIcon);
      compareBtn.appendChild(compareLabel);
      compareBtn.addEventListener('click', () => {
        ctx.onToggleComparisonSku?.('');
      });
      toolbar.appendChild(compareBtn);
    }

    if (inlineHead) {
      toolbar.classList.add('gengage-chat-product-sort-toolbar--inline');
      const head = document.createElement('div');
      head.className = 'gengage-chat-product-grid-head';
      const titleEl = document.createElement('span');
      titleEl.className = 'gengage-chat-product-grid-head-title';
      titleEl.textContent = inlineHead;
      head.appendChild(titleEl);
      const actions = document.createElement('div');
      actions.className = 'gengage-chat-product-grid-head-actions';
      actions.appendChild(toolbar);
      head.appendChild(actions);
      wrapper.appendChild(head);
    } else {
      wrapper.appendChild(toolbar);
    }
  } else if (inlineHead) {
    const head = document.createElement('div');
    head.className = 'gengage-chat-product-grid-head';
    const titleEl = document.createElement('span');
    titleEl.className = 'gengage-chat-product-grid-head-title';
    titleEl.textContent = inlineHead;
    head.appendChild(titleEl);
    wrapper.appendChild(head);
  }

  const sortedIds = getSortedChildIds(childIds, spec, ctx?.productSort);
  for (const childId of sortedIds) {
    if (!spec.elements[childId]) continue;
    const rendered = renderElement(childId);
    if (rendered) {
      rendered.dataset['elementId'] = childId;
      grid.appendChild(rendered);
    }
  }

  // Mobile variant: horizontal scroll
  if (ctx?.isMobile ?? isMobileViewport()) {
    grid.classList.add('gengage-chat-product-grid--mobile');
  }

  wrapper.appendChild(grid);

  // "View More" button (only when endOfList is not true)
  const endOfList = element.props?.['endOfList'] as boolean | undefined;
  if (endOfList !== true && childIds.length > 0) {
    const viewMoreTitle = ctx?.i18n?.viewMoreLabel ?? 'Show More';
    const viewMoreBtn = document.createElement('button');
    viewMoreBtn.className = 'gengage-chat-product-grid-view-more';
    viewMoreBtn.type = 'button';
    viewMoreBtn.textContent = viewMoreTitle;
    viewMoreBtn.addEventListener('click', () => {
      ctx?.onAction({ title: viewMoreTitle, type: 'moreProductList', payload: {} });
    });
    wrapper.appendChild(viewMoreBtn);
  }

  // Floating comparison dock — desktop: inside grid wrapper; mobile: index _refreshComparisonUI mounts into drawer slot
  const isMobileGrid = ctx?.isMobile ?? isMobileViewport();
  if (ctx?.comparisonSelectMode && ctx.comparisonSelectedSkus && !isMobileGrid) {
    const floatingBtn = renderFloatingComparisonButton(ctx.comparisonSelectedSkus, ctx);
    wrapper.appendChild(floatingBtn);
  }

  return wrapper;
}

function renderComparisonTableElement(element: UIElement, ctx: UISpecRenderContext): HTMLElement {
  const props = element.props ?? {};
  const keyDifferencesHtml = props['keyDifferencesHtml'] as string | undefined;
  const recommended = props['recommended'] as ComparisonProduct | undefined;
  const products = (props['products'] as ComparisonProduct[] | undefined) ?? [];
  const attributes = (props['attributes'] as ComparisonAttribute[] | undefined) ?? [];
  const highlights = (props['highlights'] as string[] | undefined) ?? [];
  const specialCases = props['specialCases'] as string[] | undefined;
  const recommendedText = props['recommendedText'] as string | undefined;
  const winnerHits = props['winnerHits'] as Record<string, { positive?: string[]; negative?: string[] }> | undefined;
  const productActions = props['productActions'] as
    | Record<string, { title: string; type: string; payload?: unknown }>
    | undefined;

  if (!recommended) {
    const fallback = document.createElement('div');
    return fallback;
  }

  const options: import('./ComparisonTable.js').ComparisonTableOptions = {
    recommended,
    products,
    attributes,
    highlights,
    specialCases,
    onProductClick: ({ sku, name }) => {
      ctx.onProductClick?.({ sku, url: '', name });
    },
    pricing: ctx.pricing,
  };
  if (recommendedText !== undefined) options.recommendedText = recommendedText;
  if (winnerHits !== undefined) options.winnerHits = winnerHits;
  if (productActions !== undefined) options.productActions = productActions;
  if (keyDifferencesHtml !== undefined) options.keyDifferencesHtml = keyDifferencesHtml;
  if (ctx.i18n) {
    options.i18n = {
      comparisonHeading: ctx.i18n.panelTitleComparisonResults,
      recommendedChoiceLabel: ctx.i18n.recommendedChoiceLabel,
      highlightsLabel: ctx.i18n.highlightsLabel,
      keyDifferencesLabel: ctx.i18n.keyDifferencesLabel,
      viewMoreLabel: ctx.i18n.viewMoreLabel,
      specialCasesLabel: ctx.i18n.specialCasesLabel,
      addToCartButton: ctx.i18n.addToCartButton,
    };
  }

  const el = renderComparisonTable(options);

  // Mobile variant
  if (ctx.isMobile ?? isMobileViewport()) {
    el.classList.add('gengage-chat-comparison--mobile');
  }

  return el;
}

function renderDivider(element: UIElement): HTMLElement {
  const hr = document.createElement('hr');
  hr.className = 'gengage-chat-divider';
  const label = element.props?.['label'] as string | undefined;
  if (label) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gengage-chat-divider-wrapper';
    const labelEl = document.createElement('span');
    labelEl.className = 'gengage-chat-divider-label';
    labelEl.textContent = label;
    wrapper.appendChild(hr);
    wrapper.appendChild(labelEl);
    const hr2 = document.createElement('hr');
    hr2.className = 'gengage-chat-divider';
    wrapper.appendChild(hr2);
    return wrapper;
  }
  return hr;
}
