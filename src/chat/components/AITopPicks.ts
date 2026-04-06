/**
 * AI Top Picks renderer.
 *
 * DOM/layout parity with robot-engine-lean MainPane/AIAnalysisZone TopPicksResults:
 * article: role badge, image, title, rating, price, labels, hover CTA.
 */

import type { UIElement, ActionPayload } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';
import { formatPrice } from '../../common/price-formatter.js';
import { isSafeImageUrl, safeSetAttribute } from '../../common/safe-html.js';
import { addImageErrorHandler } from '../../common/product-utils.js';

interface SentimentLabel {
  label: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface AITopPickItem {
  product: Record<string, unknown>;
  role?: string;
  reason?: string;
  labels?: SentimentLabel[];
  expertQualityScore?: number;
  reviewHighlight?: string;
  action?: ActionPayload;
}

function resolveActionSku(item: AITopPickItem): string | null {
  const productSku = item.product['sku'];
  if (typeof productSku === 'string' && productSku.length > 0) return productSku;
  const payload = item.action?.payload;
  if (payload && typeof payload === 'object' && 'sku' in payload && typeof payload.sku === 'string') {
    return payload.sku;
  }
  return null;
}

const ROLE_LABELS: Record<string, string> = {
  winner: 'roleWinner',
  best_value: 'roleBestValue',
  best_alternative: 'roleBestAlternative',
};

function getRoleLabel(role: string | undefined, i18n: ChatUISpecRenderContext['i18n']): string | null {
  if (!role || !i18n) return null;
  const key = ROLE_LABELS[role];
  if (!key) return role;
  return (i18n as Record<string, string>)[key] ?? role;
}

function renderRatingRow(product: Record<string, unknown>): HTMLElement | null {
  const raw = product['rating'];
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
  if (Number.isNaN(num) || num <= 0) return null;
  const row = document.createElement('div');
  row.className = 'gengage-chat-ai-toppick-rating';
  row.dataset['gengagePart'] = 'ai-top-pick-rating';
  const icon = document.createElement('span');
  icon.className = 'gengage-chat-ai-toppick-rating-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3.6l2.58 5.23 5.77.84-4.17 4.07.98 5.75L12 16.78l-5.16 2.71.99-5.75L3.66 9.67l5.76-.84L12 3.6z"/></svg>';
  const value = document.createElement('span');
  value.className = 'gengage-chat-ai-toppick-rating-value';
  value.textContent = num.toFixed(1);
  row.appendChild(icon);
  row.appendChild(value);
  return row;
}

/** Image-focused media with the same lightweight hover actions as listing cards. */
function appendTopPickMedia(item: AITopPickItem, alt: string, target: HTMLElement, ctx: ChatUISpecRenderContext): void {
  const media = document.createElement('div');
  media.className = 'gengage-chat-ai-toppick-media';
  media.dataset['gengagePart'] = 'ai-top-pick-media';

  const product = item.product;
  const imageUrl = product['imageUrl'] as string | undefined;
  if (imageUrl && isSafeImageUrl(imageUrl)) {
    const img = document.createElement('img');
    img.className = 'gengage-chat-ai-toppick-img';
    img.dataset['gengagePart'] = 'ai-top-pick-image';
    safeSetAttribute(img, 'src', imageUrl);
    img.loading = 'lazy';
    img.alt = alt;
    addImageErrorHandler(img);
    media.appendChild(img);
  }

  const sku = resolveActionSku(item);
  if (sku) {
    const imgActions = document.createElement('div');
    imgActions.className = 'gengage-chat-product-card-img-actions';

    if (ctx.onFavoriteToggle) {
      const heart = document.createElement('button');
      heart.className = 'gengage-chat-favorite-btn';
      heart.type = 'button';
      heart.dataset.gengageFavoriteSku = sku;
      heart.setAttribute('aria-label', ctx.i18n?.addToFavoritesLabel ?? 'Add to favorites');
      const isFav = ctx.favoritedSkus?.has(sku) ?? false;
      if (isFav) heart.classList.add('gengage-chat-favorite-btn--active');
      const svgFill = isFav ? 'currentColor' : 'none';
      heart.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${svgFill}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      heart.addEventListener('click', (e) => {
        e.stopPropagation();
        heart.classList.toggle('gengage-chat-favorite-btn--active');
        heart
          .querySelector('svg')
          ?.setAttribute(
            'fill',
            heart.classList.contains('gengage-chat-favorite-btn--active') ? 'currentColor' : 'none',
          );
        ctx.onFavoriteToggle?.(sku, product);
      });
      imgActions.appendChild(heart);
    }

    const findSimilarLabel = ctx.i18n?.findSimilarLabel ?? 'Find Similar';
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
        payload: { sku, ...(imageUrl ? { image_url: imageUrl } : {}) },
      });
    });
    imgActions.appendChild(pill);

    media.appendChild(imgActions);
  }

  target.appendChild(media);
}

function appendPriceRow(product: Record<string, unknown>, body: HTMLElement, ctx: ChatUISpecRenderContext): void {
  const price = product['price'] as string | undefined;
  const originalPrice = product['originalPrice'] as string | undefined;
  if (!price) return;
  const priceRow = document.createElement('div');
  priceRow.className = 'gengage-chat-ai-toppick-price';
  priceRow.dataset['gengagePart'] = 'ai-top-pick-price';
  if (originalPrice && originalPrice !== price) {
    const orig = document.createElement('span');
    orig.className = 'gengage-chat-ai-toppick-original-price';
    orig.textContent = formatPrice(originalPrice, ctx.pricing);
    priceRow.appendChild(orig);
    priceRow.appendChild(document.createTextNode(' '));
  }
  const current = document.createElement('span');
  current.textContent = formatPrice(price, ctx.pricing);
  priceRow.appendChild(current);
  body.appendChild(priceRow);
}

function appendWinnerEvidence(item: AITopPickItem, body: HTMLElement): void {
  const reason = typeof item.reason === 'string' ? item.reason.trim() : '';
  const reviewHighlight = typeof item.reviewHighlight === 'string' ? item.reviewHighlight.trim() : '';
  if (!reason && !reviewHighlight) return;

  if (reason) {
    const reasonEl = document.createElement('p');
    reasonEl.className = 'gengage-chat-ai-toppick-reason';
    reasonEl.dataset['gengagePart'] = 'ai-top-pick-reason';
    reasonEl.textContent = reason;
    body.appendChild(reasonEl);
  }

  if (reviewHighlight) {
    const reviewEl = document.createElement('div');
    reviewEl.className = 'gengage-chat-ai-toppick-review';
    reviewEl.dataset['gengagePart'] = 'ai-top-pick-review';
    reviewEl.textContent = reviewHighlight;
    body.appendChild(reviewEl);
  }
}

/**
 * Single card layout matching lean TopPicksResults (all picks use the same structure).
 * `--winner` / `--compact` class names kept for tests (highlight vs secondary border).
 */
function renderPickCard(item: AITopPickItem, ctx: ChatUISpecRenderContext, isWinner: boolean): HTMLElement {
  const card = document.createElement('div');
  card.className = isWinner
    ? 'gengage-chat-ai-toppick-card gengage-chat-ai-toppick-card--winner gds-card'
    : 'gengage-chat-ai-toppick-card gengage-chat-ai-toppick-card--compact gds-card';
  card.dataset['gengagePart'] = isWinner ? 'ai-top-pick-card-winner' : 'ai-top-pick-card';
  const product = item.product;
  const sku = resolveActionSku(item);
  const url = (product['url'] as string) ?? '';
  const cartCode = product['cartCode'] as string | undefined;
  const inStock = product['inStock'];
  const hasCart = !!(sku && cartCode && inStock !== false);
  const action = item.action;
  if (sku && ctx.onProductClick) {
    card.classList.add('gds-clickable');
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.gengage-chat-ai-toppick-cta')) return;
      if ((e.target as HTMLElement).closest('.gengage-chat-favorite-btn')) return;
      if ((e.target as HTMLElement).closest('.gengage-chat-find-similar-pill')) return;
      ctx.onProductClick?.({ sku, url });
    });
  } else if (action) {
    card.classList.add('gds-clickable');
    card.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.gengage-chat-ai-toppick-cta')) return;
      if ((e.target as HTMLElement).closest('.gengage-chat-favorite-btn')) return;
      if ((e.target as HTMLElement).closest('.gengage-chat-find-similar-pill')) return;
      ctx.onAction(action);
    });
  }
  const alt = (product['name'] as string) || 'Product image';

  /* Lean: span.absolute.-top-2.5.left-3 — no wrapper */
  const roleLabel = isWinner
    ? (getRoleLabel(item.role, ctx.i18n) ?? ctx.i18n?.roleWinner ?? 'TOP MATCH')
    : getRoleLabel(item.role, ctx.i18n);
  if (roleLabel) {
    const badge = document.createElement('span');
    badge.className = 'gengage-chat-ai-toppick-badge gds-badge';
    badge.dataset['gengagePart'] = 'ai-top-pick-role-badge';
    badge.textContent = roleLabel;
    card.appendChild(badge);
  }

  appendTopPickMedia(item, alt, card, ctx);

  const body = document.createElement('div');
  body.className = 'gengage-chat-ai-toppick-body';
  body.dataset['gengagePart'] = 'ai-top-pick-body';

  const name = product['name'] as string | undefined;
  if (name) {
    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-ai-toppick-name';
    nameEl.dataset['gengagePart'] = 'ai-top-pick-name';
    nameEl.textContent = name;
    body.appendChild(nameEl);
  }

  const ratingRow = renderRatingRow(product);
  if (ratingRow) body.appendChild(ratingRow);

  /* Lean order: price before labels */
  appendPriceRow(product, body, ctx);

  if (item.labels && item.labels.length > 0) {
    body.appendChild(renderSentimentChips(item.labels));
  }

  if (isWinner) {
    appendWinnerEvidence(item, body);
  }

  card.appendChild(body);

  if (hasCart || action) {
    const spinner = document.createElement('div');
    spinner.className = 'gengage-chat-ai-toppick-spinner';
    spinner.dataset['gengagePart'] = 'ai-top-pick-spinner';
    spinner.style.display = sku && ctx.topPicksLoadingSku === sku ? '' : 'none';
    card.appendChild(spinner);

    const cta = document.createElement('button');
    cta.className = 'gengage-chat-ai-toppick-cta gds-btn gds-btn-primary';
    cta.dataset['gengagePart'] = 'ai-top-pick-cta';
    cta.type = 'button';
    cta.textContent = hasCart
      ? (ctx.i18n?.addToCartButton ?? 'Add to Cart')
      : (ctx.i18n?.viewDetails ?? 'View Details');
    cta.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hasCart) {
        ctx.onAction({
          title: ctx.i18n?.addToCartButton ?? 'Add to Cart',
          type: 'addToCart',
          payload: { sku: sku!, cartCode: cartCode!, quantity: 1 },
        });
        return;
      }
      if (!action) return;
      if (action.type === 'findSimilar' && sku && ctx.onProductClick) {
        ctx.onProductClick({ sku, url });
        return;
      }
      ctx.onAction(action);
    });
    card.appendChild(cta);
  }

  return card;
}

export function renderAITopPicks(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-ai-top-picks';
  container.dataset['gengagePart'] = 'ai-top-picks';

  const suggestions = (element.props?.['suggestions'] ?? []) as AITopPickItem[];
  if (suggestions.length === 0) return container;

  const title = document.createElement('h3');
  title.className = 'gengage-chat-ai-top-picks-title';
  title.dataset['gengagePart'] = 'ai-top-picks-title';
  title.textContent = ctx.i18n?.aiTopPicksTitle ?? 'Top Picks';
  container.appendChild(title);

  const scrollRow = document.createElement('div');
  scrollRow.className = 'gengage-chat-ai-top-picks-scroll';
  scrollRow.dataset['gengagePart'] = 'ai-top-picks-scroll';

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i]!;
    const isWinner = suggestion.role === 'winner' || i === 0;
    scrollRow.appendChild(renderPickCard(suggestion, ctx, isWinner));
  }

  container.appendChild(scrollRow);
  return container;
}

function renderSentimentChips(labels: SentimentLabel[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-ai-toppick-labels';
  container.dataset['gengagePart'] = 'ai-top-pick-labels';
  for (const label of labels) {
    const chip = document.createElement('span');
    chip.className = 'gengage-chat-ai-toppick-label gds-chip';
    chip.dataset['gengagePart'] = 'ai-top-pick-label';
    chip.dataset['sentiment'] = label.sentiment ?? 'neutral';
    chip.textContent = label.label;
    container.appendChild(chip);
  }
  return container;
}
