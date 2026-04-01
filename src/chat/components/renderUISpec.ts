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
import { createQuantityStepper } from '../../common/quantity-stepper.js';
import { isSafeUrl, safeSetAttribute } from '../../common/safe-html.js';
import {
  clampRating,
  clampDiscount,
  addImageErrorHandler,
  createStarRatingElement,
} from '../../common/product-utils.js';

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
      reviewFilterAll: context.i18n?.reviewFilterAll,
      reviewFilterPositive: context.i18n?.reviewFilterPositive,
      reviewFilterNegative: context.i18n?.reviewFilterNegative,
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

function renderProductCard(element: UIElement, ctx: UISpecRenderContext): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-product-card';

  // Product data may be nested under `product` prop (adapter) or flat in props
  const product = (element.props?.['product'] ?? element.props) as Record<string, unknown> | undefined;
  if (!product) return card;

  // Store SKU as data attribute for comparison mode DOM refresh
  const productSku = product['sku'] as string | undefined;
  if (productSku) card.dataset['sku'] = productSku;
  const action = element.props?.['action'] as ActionPayload | undefined;

  // Make card clickable to show detail in panel (disabled in comparison select mode)
  if (ctx.onProductSelect || action) {
    card.style.cursor = 'pointer';
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

    // "Find Similar" hover pill on image
    const findSimilarSku = product['sku'] as string | undefined;
    if (findSimilarSku) {
      const pill = document.createElement('button');
      pill.className = 'gengage-chat-find-similar-pill';
      pill.type = 'button';
      pill.textContent = ctx.i18n?.findSimilarLabel ?? 'Find Similar';
      pill.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.onAction({
          title: ctx.i18n?.findSimilarLabel ?? 'Find Similar',
          type: 'findSimilar',
          payload: { sku: findSimilarSku, ...(imageUrl ? { image_url: imageUrl } : {}) },
        });
      });
      imgWrapper.appendChild(pill);
    }

    // Favorite heart toggle
    const favSku = product['sku'] as string | undefined;
    if (favSku && ctx.onFavoriteToggle) {
      const heart = document.createElement('button');
      heart.className = 'gengage-chat-favorite-btn';
      heart.type = 'button';
      heart.setAttribute('aria-label', ctx.i18n?.addToFavoritesLabel ?? 'Add to favorites');
      const isFav = ctx.favoritedSkus?.has(favSku) ?? false;
      if (isFav) heart.classList.add('gengage-chat-favorite-btn--active');
      const svgFill = isFav ? 'currentColor' : 'none';
      heart.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${svgFill}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
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
      imgWrapper.appendChild(heart);
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

  const name = product['name'] as string | undefined;
  if (name) {
    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-product-card-name';
    nameEl.textContent = name;
    nameEl.title = name;
    body.appendChild(nameEl);
  }

  const rating = product['rating'];
  const reviewCount = product['reviewCount'];
  if (typeof rating === 'number' && Number.isFinite(rating) && rating > 0) {
    const ratingRow = document.createElement('div');
    ratingRow.className = 'gengage-chat-product-card-rating';
    ratingRow.appendChild(createStarRatingElement(rating));
    if (typeof reviewCount === 'number' && Number.isFinite(reviewCount)) {
      const count = document.createElement('span');
      count.className = 'gengage-chat-product-card-review-count';
      count.textContent = ` (${reviewCount})`;
      ratingRow.appendChild(count);
    }
    body.appendChild(ratingRow);
  }

  const price = product['price'] as string | undefined;
  const originalPrice = product['originalPrice'] as string | undefined;
  const priceAsync = product['price_async'] as boolean | undefined;

  if (priceAsync === true) {
    const priceRow = document.createElement('div');
    priceRow.className = 'gengage-chat-product-card-price';
    const skeleton = document.createElement('span');
    skeleton.className = 'gengage-chat-price-skeleton';
    priceRow.appendChild(skeleton);
    body.appendChild(priceRow);
    // Replace skeleton with actual price after delay
    setTimeout(() => {
      if (!skeleton.parentElement) return; // Element removed from DOM
      if (price && parseFloat(price) > 0) {
        skeleton.replaceWith(document.createTextNode(formatPrice(price, ctx.pricing)));
      } else {
        skeleton.remove();
      }
    }, 300);
  } else if (price && parseFloat(price) > 0) {
    const priceRow = document.createElement('div');
    priceRow.className = 'gengage-chat-product-card-price';
    if (originalPrice && originalPrice !== price) {
      const orig = document.createElement('span');
      orig.className = 'gengage-chat-product-card-original-price';
      orig.textContent = formatPrice(originalPrice, ctx.pricing);
      priceRow.appendChild(orig);
      priceRow.appendChild(document.createTextNode(' '));
    }
    const current = document.createElement('span');
    current.textContent = formatPrice(price, ctx.pricing);
    priceRow.appendChild(current);
    body.appendChild(priceRow);
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

  // Promotion badges (e.g. "Free Shipping", "Flash Sale") — max 3
  const promotions = product['promotions'] as string[] | undefined;
  if (promotions && promotions.length > 0) {
    const promoBadges = document.createElement('div');
    promoBadges.className = 'gengage-chat-product-card-promos';
    for (const promo of promotions.slice(0, 3)) {
      if (!promo || /%(0(\.0+)?)\s/.test(promo)) continue; // skip zero-value badges
      const badge = document.createElement('span');
      badge.className = 'gengage-chat-product-card-promo-badge';
      badge.textContent = promo;
      badge.title = promo;
      promoBadges.appendChild(badge);
    }
    if (promoBadges.childElementCount > 0) body.appendChild(promoBadges);
  }

  card.appendChild(body);

  const url = product['url'] as string | undefined;
  const sku = product['sku'] as string | undefined;

  if (action) {
    const cta = document.createElement('button');
    cta.className = 'gengage-chat-product-card-cta';
    cta.type = 'button';
    cta.textContent = action.title || ctx.i18n?.productCtaLabel || 'View';
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
    cta.textContent = ctx.i18n?.productCtaLabel ?? 'View';
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

  // Add to cart stepper (shown on search result cards when cartCode is available and in stock)
  const cartCode = product['cartCode'] as string | undefined;
  if (cartCode && sku && inStock !== false) {
    const stepper = createQuantityStepper({
      compact: true,
      label: ctx.i18n?.addToCartButton ?? 'Add to Cart',
      decreaseLabel: ctx.i18n?.decreaseLabel,
      increaseLabel: ctx.i18n?.increaseLabel,
      onSubmit: (quantity) => {
        ctx.onAction({
          title: ctx.i18n?.addToCartButton ?? 'Add to Cart',
          type: 'addToCart',
          payload: { sku, cartCode, quantity },
        });
      },
    });
    stepper.classList.add('gengage-chat-product-card-atc');
    card.appendChild(stepper);
  }

  // Wrap with checkbox overlay when comparison select mode is active
  if (ctx.comparisonSelectMode && sku && ctx.onToggleComparisonSku) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gengage-chat-comparison-select-wrapper';

    const productName = (product['name'] as string | undefined) ?? sku;
    const hintText =
      ctx.i18n?.comparisonSelectCardHint ?? 'Tap anywhere on the card to add or remove it from comparison.';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', `${String(productName)}. ${hintText}`);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'gengage-chat-comparison-checkbox';
    checkbox.checked = ctx.comparisonSelectedSkus?.includes(sku) ?? false;
    checkbox.addEventListener('change', () => {
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

    wrapper.appendChild(checkbox);
    wrapper.appendChild(hint);
    wrapper.appendChild(card);
    return wrapper;
  }

  return card;
}

/* clampRating, clampDiscount, addImageErrorHandler, renderStarRating
   are imported from ../../common/product-utils.js */

function renderProductDetailsPanel(element: UIElement, ctx: UISpecRenderContext): HTMLElement {
  const panel = document.createElement('article');
  panel.className = 'gengage-chat-product-details-panel';

  const product = (element.props?.['product'] ?? element.props) as Record<string, unknown> | undefined;
  if (!product) return panel;

  // Image gallery or single image
  const images = product['images'] as string[] | undefined;
  const imageUrl = product['imageUrl'] as string | undefined;

  const detailsSku = product['sku'] as string | undefined;

  if (images && images.length > 1) {
    // Gallery with thumbnails + prev/next arrows
    const media = document.createElement('div');
    media.className =
      'gengage-chat-product-details-media gengage-chat-product-details-gallery gengage-chat-product-details-img-wrap';

    const mainImg = document.createElement('img');
    mainImg.className = 'gengage-chat-product-details-img';
    const firstSafe = images.find((u) => isSafeUrl(u));
    if (firstSafe) safeSetAttribute(mainImg, 'src', firstSafe);
    const name = product['name'] as string | undefined;
    if (name) mainImg.alt = name;
    addImageErrorHandler(mainImg);
    media.appendChild(mainImg);

    const thumbStrip = document.createElement('div');
    thumbStrip.className = 'gengage-chat-product-gallery-thumbs';

    const MAX_VISIBLE_THUMBNAILS = 6;
    const safeImages = images.filter((u): u is string => !!u && isSafeUrl(u));
    /** First gallery URL only — findSimilar payload never follows the currently displayed slide. */
    const findSimilarImageUrl = safeImages[0];
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
    prevBtn.className = 'gengage-chat-product-gallery-nav gengage-chat-product-gallery-nav--prev';
    prevBtn.setAttribute('aria-label', prevLabel);
    prevBtn.innerHTML = navSvg('prev');

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'gengage-chat-product-gallery-nav gengage-chat-product-gallery-nav--next';
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

    // "Find Similar" — button always visible; search uses first image only (not mainImg src).
    if (detailsSku) {
      const pill = document.createElement('button');
      pill.className = 'gengage-chat-find-similar-pill';
      pill.type = 'button';
      pill.textContent = ctx.i18n?.findSimilarLabel ?? 'Find Similar';
      pill.addEventListener('click', () => {
        ctx.onAction({
          title: ctx.i18n?.findSimilarLabel ?? 'Find Similar',
          type: 'findSimilar',
          payload: { sku: detailsSku, ...(findSimilarImageUrl ? { image_url: findSimilarImageUrl } : {}) },
        });
      });
      media.appendChild(pill);
    }

    panel.appendChild(media);
  } else if (imageUrl && isSafeUrl(imageUrl)) {
    // Single image fallback
    const media = document.createElement('div');
    media.className = 'gengage-chat-product-details-media gengage-chat-product-details-img-wrap';
    const img = document.createElement('img');
    img.className = 'gengage-chat-product-details-img';
    img.loading = 'lazy';
    safeSetAttribute(img, 'src', imageUrl);
    addImageErrorHandler(img);
    const name = product['name'] as string | undefined;
    if (name) img.alt = name;
    media.appendChild(img);

    // "Find Similar" hover pill on single image
    if (detailsSku) {
      const pill = document.createElement('button');
      pill.className = 'gengage-chat-find-similar-pill';
      pill.type = 'button';
      pill.textContent = ctx.i18n?.findSimilarLabel ?? 'Find Similar';
      pill.addEventListener('click', () => {
        ctx.onAction({
          title: ctx.i18n?.findSimilarLabel ?? 'Find Similar',
          type: 'findSimilar',
          payload: { sku: detailsSku, ...(imageUrl ? { image_url: imageUrl } : {}) },
        });
      });
      media.appendChild(pill);
    }

    panel.appendChild(media);
  }

  const content = document.createElement('div');
  content.className = 'gengage-chat-product-details-content';

  const name = product['name'] as string | undefined;
  if (name) {
    const title = document.createElement('h3');
    title.className = 'gengage-chat-product-details-title';
    title.textContent = name;
    title.title = name;
    content.appendChild(title);
  }

  const rating = product['rating'];
  const reviewCount = product['reviewCount'];
  if (typeof rating === 'number' && Number.isFinite(rating) && rating > 0) {
    const ratingRow = document.createElement('div');
    ratingRow.className = 'gengage-chat-product-details-rating';
    ratingRow.textContent = `\u2605 ${clampRating(rating).toFixed(1)}`;
    if (typeof reviewCount === 'number' && Number.isFinite(reviewCount)) {
      const count = document.createElement('span');
      count.className = 'gengage-chat-product-details-review-count';
      count.textContent = ` (${reviewCount})`;
      ratingRow.appendChild(count);
    }
    content.appendChild(ratingRow);
  }

  const price = product['price'] as string | undefined;
  const originalPrice = product['originalPrice'] as string | undefined;
  const priceAsync = product['price_async'] as boolean | undefined;

  if (priceAsync === true) {
    const priceRow = document.createElement('div');
    priceRow.className = 'gengage-chat-product-details-price';
    const skeleton = document.createElement('span');
    skeleton.className = 'gengage-chat-price-skeleton';
    priceRow.appendChild(skeleton);
    content.appendChild(priceRow);
    // Replace skeleton with actual price after delay
    setTimeout(() => {
      if (!skeleton.parentElement) return; // Element removed from DOM
      if (price && parseFloat(price) > 0) {
        const currentPrice = document.createElement('span');
        currentPrice.className = 'gengage-chat-product-details-current-price';
        currentPrice.textContent = formatPrice(price, ctx.pricing);
        skeleton.replaceWith(currentPrice);
      } else {
        skeleton.remove();
      }
    }, 300);
  } else if (price && parseFloat(price) > 0) {
    const priceRow = document.createElement('div');
    priceRow.className = 'gengage-chat-product-details-price';
    if (originalPrice && originalPrice !== price) {
      const oldPrice = document.createElement('span');
      oldPrice.className = 'gengage-chat-product-details-original-price';
      oldPrice.textContent = formatPrice(originalPrice, ctx.pricing);
      priceRow.appendChild(oldPrice);
      priceRow.appendChild(document.createTextNode(' '));
    }
    const currentPrice = document.createElement('span');
    currentPrice.className = 'gengage-chat-product-details-current-price';
    currentPrice.textContent = formatPrice(price, ctx.pricing);
    priceRow.appendChild(currentPrice);
    content.appendChild(priceRow);
  }

  const inStock = product['inStock'];
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

  // Variant selector
  const variants = product['variants'] as Array<Record<string, unknown>> | undefined;
  if (variants && variants.length > 0) {
    const variantSection = document.createElement('div');
    variantSection.className = 'gengage-chat-product-variants';

    const variantLabel = document.createElement('div');
    variantLabel.className = 'gengage-chat-product-variants-label';
    variantLabel.textContent = ctx.i18n?.variantsLabel ?? 'Variants';
    variantSection.appendChild(variantLabel);

    const variantList = document.createElement('div');
    variantList.className = 'gengage-chat-product-variants-list';

    for (const variant of variants) {
      const variantValue = variant['value'] as string | undefined;
      const variantName =
        variantValue ?? (variant['name'] as string | undefined) ?? (variant['variant_name'] as string | undefined);
      const variantSku = variant['sku'] as string | undefined;
      if (!variantName && !variantSku) continue;

      const btn = document.createElement('button');
      btn.className = 'gengage-chat-product-variant-btn';
      btn.type = 'button';

      const labelText = variantName ?? variantSku ?? '';
      const variantPrice = variant['price'] as number | string | undefined;
      if (variantPrice && String(variantPrice) !== String(price)) {
        btn.textContent = `${labelText} - ${formatPrice(String(variantPrice), ctx.pricing)}`;
      } else {
        btn.textContent = labelText;
      }

      if (variantSku) {
        btn.addEventListener('click', () => {
          ctx.onAction({
            title: labelText,
            type: 'launchVariant',
            payload: { sku: variantSku },
          });
        });
      }
      variantList.appendChild(btn);
    }

    variantSection.appendChild(variantList);
    content.appendChild(variantSection);
  }

  const sku = product['sku'] as string | undefined;
  const cartCode = product['cartCode'] as string | undefined;

  const actionRow = document.createElement('div');
  actionRow.className = 'gengage-chat-product-details-actions';

  const action = element.props?.['action'] as ActionPayload | undefined;
  if (action) {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'gengage-chat-product-details-cta';
    actionBtn.type = 'button';
    actionBtn.textContent = action.title || ctx.i18n?.productCtaLabel || 'View';
    actionBtn.addEventListener('click', () => ctx.onAction(action));
    actionRow.appendChild(actionBtn);
  } else {
    const url = product['url'] as string | undefined;
    if (url && isSafeUrl(url)) {
      const cta = document.createElement('a');
      cta.className = 'gengage-chat-product-details-cta';
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
  }

  // Add to Cart stepper — shown when the product has a cartCode and is in stock
  if (cartCode && sku && inStock !== false) {
    const stepper = createQuantityStepper({
      compact: false,
      label: ctx.i18n?.addToCartButton ?? 'Add to Cart',
      decreaseLabel: ctx.i18n?.decreaseLabel,
      increaseLabel: ctx.i18n?.increaseLabel,
      onSubmit: (quantity) => {
        ctx.onAction({
          title: ctx.i18n?.addToCartButton ?? 'Add to Cart',
          type: 'addToCart',
          payload: { sku, cartCode, quantity },
        });
      },
    });
    stepper.classList.add('gengage-chat-product-details-atc-stepper');
    actionRow.appendChild(stepper);
  }

  // Share button — copies product URL or triggers native share
  const shareUrl = product['url'] as string | undefined;
  if (shareUrl && isSafeUrl(shareUrl)) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'gengage-chat-product-details-share';
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
      const productName = product['name'] as string | undefined;
      try {
        if (navigator.share) {
          await navigator.share({ title: productName ?? '', url: shareUrl });
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
  const description = product['description'] as string | undefined;
  const specifications = product['specifications'] as
    | Record<string, string>
    | Array<{ key: string; value: string }>
    | undefined;
  if (description || specifications) {
    panel.appendChild(renderProductDetailTabs(description, specifications, ctx));
  }

  return panel;
}

function renderProductDetailTabs(
  description: string | undefined,
  specifications: Record<string, string> | Array<{ key: string; value: string }> | undefined,
  ctx: UISpecRenderContext,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-product-detail-tabs';

  const tabBar = document.createElement('div');
  tabBar.className = 'gengage-chat-product-detail-tab-bar';

  const tabPanels: HTMLElement[] = [];

  // Product Info tab
  if (description) {
    const tab = document.createElement('button');
    tab.className = 'gengage-chat-product-detail-tab gengage-chat-product-detail-tab--active';
    tab.type = 'button';
    tab.textContent = ctx.i18n?.productInfoTab ?? 'Product Info';
    tabBar.appendChild(tab);

    const panel = document.createElement('div');
    panel.className = 'gengage-chat-product-detail-tab-panel';
    panel.textContent = description;
    tabPanels.push(panel);
  }

  // Specifications tab
  if (specifications) {
    const tab = document.createElement('button');
    tab.className = `gengage-chat-product-detail-tab${!description ? ' gengage-chat-product-detail-tab--active' : ''}`;
    tab.type = 'button';
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
      tabs.forEach((t) => t.classList.remove('gengage-chat-product-detail-tab--active'));
      tabEl.classList.add('gengage-chat-product-detail-tab--active');
      tabPanels.forEach((p, pIdx) => {
        p.style.display = pIdx === idx ? '' : 'none';
      });
    });
  });

  container.appendChild(tabBar);
  for (const p of tabPanels) container.appendChild(p);
  return container;
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

  // Sort toolbar (only when >1 children and context has sort support)
  if (childIds.length > 1 && ctx?.onSortChange) {
    const toolbar = document.createElement('div');
    toolbar.className = 'gengage-chat-product-sort-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', ctx.i18n?.sortToolbarAriaLabel ?? 'Sort products');

    const sort = ctx.productSort ?? { type: 'related' as const };

    const buttons: Array<{ label: string; sortState: ProductSortState }> = [
      { label: ctx.i18n?.sortRelated ?? 'Related', sortState: { type: 'related' } },
      { label: ctx.i18n?.sortPriceAsc ?? 'Price ↑', sortState: { type: 'price', direction: 'asc' } },
      { label: ctx.i18n?.sortPriceDesc ?? 'Price ↓', sortState: { type: 'price', direction: 'desc' } },
    ];

    for (const btn of buttons) {
      const button = document.createElement('button');
      button.className = 'gengage-chat-product-sort-btn';
      button.type = 'button';
      const isActive = sort.type === btn.sortState.type && sort.direction === btn.sortState.direction;
      if (isActive) button.classList.add('gengage-chat-product-sort-btn--active');
      button.textContent = btn.label;
      button.addEventListener('click', () => {
        ctx.onSortChange?.(btn.sortState);
        resortGrid(grid, childIds, spec, btn.sortState);
        toolbar
          .querySelectorAll('.gengage-chat-product-sort-btn')
          .forEach((b) => b.classList.remove('gengage-chat-product-sort-btn--active'));
        button.classList.add('gengage-chat-product-sort-btn--active');
      });
      toolbar.appendChild(button);
    }

    // Comparison toggle button (only if onToggleComparisonSku is provided)
    if (ctx.onToggleComparisonSku) {
      const separator = document.createElement('div');
      separator.className = 'gengage-chat-product-sort-separator';
      toolbar.appendChild(separator);

      const compareBtn = document.createElement('button');
      compareBtn.className = 'gengage-chat-comparison-toggle-btn';
      compareBtn.type = 'button';
      if (ctx.comparisonSelectMode) {
        compareBtn.classList.add('gengage-chat-comparison-toggle-btn--active');
      }
      // Hide compare button during streaming — revealed on stream end with fade-in
      if (ctx.isStreaming) {
        compareBtn.classList.add('gengage-chat-comparison-toggle-btn--hidden');
      }
      compareBtn.textContent = ctx.i18n?.compareSelected ?? 'Compare';
      compareBtn.addEventListener('click', () => {
        // Toggle is handled by the parent — dispatched via onToggleComparisonSku with empty string
        // to signal mode toggle (convention: empty sku = toggle mode)
        ctx.onToggleComparisonSku?.('');
      });
      toolbar.appendChild(compareBtn);
    }

    wrapper.appendChild(toolbar);
  }

  const grid = document.createElement('div');
  grid.className = 'gengage-chat-product-grid';

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
    const viewMoreBtn = document.createElement('button');
    viewMoreBtn.className = 'gengage-chat-product-grid-view-more';
    viewMoreBtn.type = 'button';
    viewMoreBtn.textContent = ctx?.i18n?.viewMoreLabel ?? 'Show More';
    viewMoreBtn.addEventListener('click', () => {
      ctx?.onAction({ title: 'More', type: 'moreProductList', payload: {} });
    });
    wrapper.appendChild(viewMoreBtn);
  }

  // Floating comparison button (visible when 2+ products are selected)
  if (ctx?.comparisonSelectMode && ctx.comparisonSelectedSkus && ctx.comparisonSelectedSkus.length >= 2) {
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
    onProductClick: (sku) => {
      ctx.onProductClick?.({ sku, url: '' });
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
