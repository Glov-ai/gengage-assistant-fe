/**
 * AI Top Picks renderer.
 *
 * Renders rich AI-curated product suggestion cards with:
 * - Winner card (vertical, primary border, badge, large image)
 * - Compact cards (horizontal, smaller)
 * - Sentiment label chips (green/red/gray)
 * - Expert quality scores, review quotes
 */

import type { UIElement, ActionPayload } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';
import { formatPrice } from '../../common/price-formatter.js';
import { isSafeImageUrl, safeSetAttribute } from '../../common/safe-html.js';
import { clampDiscount, addImageErrorHandler } from '../../common/product-utils.js';

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

export function renderAITopPicks(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-ai-top-picks';

  const suggestions = (element.props?.['suggestions'] ?? []) as AITopPickItem[];
  if (suggestions.length === 0) return container;

  // Title
  const title = document.createElement('h3');
  title.className = 'gengage-chat-ai-top-picks-title';
  title.textContent = ctx.i18n?.aiTopPicksTitle ?? 'Top Picks';
  container.appendChild(title);

  const cardsWrap = document.createElement('div');
  cardsWrap.className = 'gengage-chat-ai-top-picks-cards';

  for (let i = 0; i < suggestions.length; i++) {
    const suggestion = suggestions[i]!;
    const isWinner = suggestion.role === 'winner' || i === 0;
    const card = isWinner ? renderTopPickCard(suggestion, ctx) : renderCompactCard(suggestion, ctx);
    cardsWrap.appendChild(card);
  }

  container.appendChild(cardsWrap);
  return container;
}

function renderTopPickCard(item: AITopPickItem, ctx: ChatUISpecRenderContext): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-ai-toppick-card gengage-chat-ai-toppick-card--winner';

  // Badge
  const badge = document.createElement('span');
  badge.className = 'gengage-chat-ai-toppick-badge';
  badge.textContent = getRoleLabel(item.role, ctx.i18n) ?? ctx.i18n?.roleWinner ?? 'TOP MATCH';
  card.appendChild(badge);

  const product = item.product;

  // Discount badge
  const discountPercent = product['discountPercent'] as number | undefined;
  if (typeof discountPercent === 'number' && discountPercent > 0) {
    const discountBadge = document.createElement('span');
    discountBadge.className = 'gengage-chat-ai-toppick-discount-badge';
    discountBadge.textContent = `%${clampDiscount(discountPercent)}`;
    card.appendChild(discountBadge);
  }

  // Image
  const imageUrl = product['imageUrl'] as string | undefined;
  if (imageUrl && isSafeImageUrl(imageUrl)) {
    const img = document.createElement('img');
    img.className = 'gengage-chat-ai-toppick-img';
    safeSetAttribute(img, 'src', imageUrl);
    img.alt = (product['name'] as string) ?? '';
    addImageErrorHandler(img);
    card.appendChild(img);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'gengage-chat-ai-toppick-body';

  const name = product['name'] as string | undefined;
  if (name) {
    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-ai-toppick-name';
    nameEl.textContent = name;
    body.appendChild(nameEl);
  }

  // Reason text
  if (item.reason) {
    const reasonEl = document.createElement('div');
    reasonEl.className = 'gengage-chat-ai-toppick-reason';
    reasonEl.textContent = item.reason;
    body.appendChild(reasonEl);
  }

  // Sentiment chips
  if (item.labels && item.labels.length > 0) {
    body.appendChild(renderSentimentChips(item.labels));
  }

  // Expert quality score — auto-detect scale from value range
  if (typeof item.expertQualityScore === 'number') {
    const score = document.createElement('div');
    score.className = 'gengage-chat-ai-toppick-score';
    const maxScale = item.expertQualityScore <= 5 ? 5 : 10;
    score.textContent = `${item.expertQualityScore}/${maxScale}`;
    body.appendChild(score);
  }

  // Review highlight quote
  if (item.reviewHighlight) {
    const review = document.createElement('blockquote');
    review.className = 'gengage-chat-ai-toppick-review';
    review.textContent = item.reviewHighlight;
    body.appendChild(review);
  }

  // Price
  const price = product['price'] as string | undefined;
  const originalPrice = product['originalPrice'] as string | undefined;
  if (price) {
    const priceRow = document.createElement('div');
    priceRow.className = 'gengage-chat-ai-toppick-price';
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

  card.appendChild(body);

  // CTA button
  if (item.action) {
    const sku = resolveActionSku(item);
    const url = (product['url'] as string) ?? '';

    // Spinner overlay (hidden by default)
    const spinner = document.createElement('div');
    spinner.className = 'gengage-chat-ai-toppick-spinner';
    spinner.style.display = sku && ctx.topPicksLoadingSku === sku ? '' : 'none';
    card.appendChild(spinner);

    const cta = document.createElement('button');
    cta.className = 'gengage-chat-ai-toppick-cta';
    cta.type = 'button';
    cta.textContent = ctx.i18n?.viewDetails ?? 'View Details';
    cta.addEventListener('click', () => {
      if (item.action?.type === 'findSimilar' && sku && ctx.onProductClick) {
        ctx.onProductClick({ sku, url });
        return;
      }
      ctx.onAction(item.action!);
    });
    card.appendChild(cta);
  }

  return card;
}

function renderCompactCard(item: AITopPickItem, ctx: ChatUISpecRenderContext): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-ai-toppick-card gengage-chat-ai-toppick-card--compact';

  const product = item.product;

  // Discount badge
  const discountPercent = product['discountPercent'] as number | undefined;
  if (typeof discountPercent === 'number' && discountPercent > 0) {
    const discountBadge = document.createElement('span');
    discountBadge.className = 'gengage-chat-ai-toppick-discount-badge';
    discountBadge.textContent = `%${clampDiscount(discountPercent)}`;
    card.appendChild(discountBadge);
  }

  // Image
  const imageUrl = product['imageUrl'] as string | undefined;
  if (imageUrl && isSafeImageUrl(imageUrl)) {
    const img = document.createElement('img');
    img.className = 'gengage-chat-ai-toppick-img';
    safeSetAttribute(img, 'src', imageUrl);
    img.alt = (product['name'] as string) ?? '';
    addImageErrorHandler(img);
    card.appendChild(img);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'gengage-chat-ai-toppick-body';

  // Role label
  const roleLabel = getRoleLabel(item.role, ctx.i18n);
  if (roleLabel) {
    const roleEl = document.createElement('div');
    roleEl.className = 'gengage-chat-ai-toppick-role';
    roleEl.textContent = roleLabel;
    body.appendChild(roleEl);
  }

  const name = product['name'] as string | undefined;
  if (name) {
    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-ai-toppick-name';
    nameEl.textContent = name;
    body.appendChild(nameEl);
  }

  // Reason text
  if (item.reason) {
    const reasonEl = document.createElement('div');
    reasonEl.className = 'gengage-chat-ai-toppick-reason';
    reasonEl.textContent = item.reason;
    body.appendChild(reasonEl);
  }

  // Sentiment chips
  if (item.labels && item.labels.length > 0) {
    body.appendChild(renderSentimentChips(item.labels));
  }

  // Price
  const price = product['price'] as string | undefined;
  if (price) {
    const priceEl = document.createElement('div');
    priceEl.className = 'gengage-chat-ai-toppick-price';
    priceEl.textContent = formatPrice(price, ctx.pricing);
    body.appendChild(priceEl);
  }

  card.appendChild(body);

  // CTA
  if (item.action) {
    const sku = resolveActionSku(item);
    const url = (product['url'] as string) ?? '';

    // Spinner overlay (hidden by default)
    const spinner = document.createElement('div');
    spinner.className = 'gengage-chat-ai-toppick-spinner';
    spinner.style.display = sku && ctx.topPicksLoadingSku === sku ? '' : 'none';
    card.appendChild(spinner);

    const cta = document.createElement('button');
    cta.className = 'gengage-chat-ai-toppick-cta';
    cta.type = 'button';
    cta.textContent = ctx.i18n?.viewDetails ?? 'View Details';
    cta.addEventListener('click', () => {
      if (item.action?.type === 'findSimilar' && sku && ctx.onProductClick) {
        ctx.onProductClick({ sku, url });
        return;
      }
      ctx.onAction(item.action!);
    });
    card.appendChild(cta);
  }

  return card;
}

function renderSentimentChips(labels: SentimentLabel[]): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-ai-toppick-labels';
  for (const label of labels) {
    const chip = document.createElement('span');
    chip.className = 'gengage-chat-ai-toppick-label';
    chip.dataset['sentiment'] = label.sentiment ?? 'neutral';
    chip.textContent = label.label;
    container.appendChild(chip);
  }
  return container;
}
