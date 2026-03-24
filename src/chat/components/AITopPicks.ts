/**
 * AI Top Picks renderer.
 *
 * DOM/layout parity with robot-engine-lean MainPane/AIAnalysisZone TopPicksResults:
 * article: relative p-3, role badge absolute -top-2.5 left-3, image aspect-square mt-1 mb-2,
 * title, rating, price, reason (line-clamp-3), CTA.
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

function renderRatingRow(product: Record<string, unknown>): HTMLElement | null {
  const raw = product['rating'];
  const num = typeof raw === 'number' ? raw : typeof raw === 'string' ? parseFloat(raw) : NaN;
  if (Number.isNaN(num)) return null;
  const row = document.createElement('div');
  row.className = 'gengage-chat-ai-toppick-rating';
  row.textContent = `\u2605 ${num.toFixed(1)}`;
  return row;
}

/** Image + optional discount — only inside media box (lean parity). */
function appendTopPickMedia(product: Record<string, unknown>, alt: string, target: HTMLElement): void {
  const media = document.createElement('div');
  media.className = 'gengage-chat-ai-toppick-media';

  const discountPercent = product['discountPercent'] as number | undefined;
  if (typeof discountPercent === 'number' && discountPercent > 0) {
    const discountBadge = document.createElement('span');
    discountBadge.className = 'gengage-chat-ai-toppick-discount-badge';
    discountBadge.textContent = `%${clampDiscount(discountPercent)}`;
    media.appendChild(discountBadge);
  }

  const imageUrl = product['imageUrl'] as string | undefined;
  if (imageUrl && isSafeImageUrl(imageUrl)) {
    const img = document.createElement('img');
    img.className = 'gengage-chat-ai-toppick-img';
    safeSetAttribute(img, 'src', imageUrl);
    img.loading = 'lazy';
    img.alt = alt;
    addImageErrorHandler(img);
    media.appendChild(img);
  }

  target.appendChild(media);
}

function appendPriceRow(product: Record<string, unknown>, body: HTMLElement, ctx: ChatUISpecRenderContext): void {
  const price = product['price'] as string | undefined;
  const originalPrice = product['originalPrice'] as string | undefined;
  if (!price) return;
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

/**
 * Single card layout matching lean TopPicksResults (all picks use the same structure).
 * `--winner` / `--compact` class names kept for tests (highlight vs secondary border).
 */
function renderPickCard(item: AITopPickItem, ctx: ChatUISpecRenderContext, isWinner: boolean): HTMLElement {
  const card = document.createElement('div');
  card.className = isWinner
    ? 'gengage-chat-ai-toppick-card gengage-chat-ai-toppick-card--winner'
    : 'gengage-chat-ai-toppick-card gengage-chat-ai-toppick-card--compact';

  const product = item.product;
  const alt = (product['name'] as string) || 'Product image';

  /* Lean: span.absolute.-top-2.5.left-3 — no wrapper */
  const roleLabel = isWinner
    ? (getRoleLabel(item.role, ctx.i18n) ?? ctx.i18n?.roleWinner ?? 'TOP MATCH')
    : getRoleLabel(item.role, ctx.i18n);
  if (roleLabel) {
    const badge = document.createElement('span');
    badge.className = 'gengage-chat-ai-toppick-badge';
    badge.textContent = roleLabel;
    card.appendChild(badge);
  }

  appendTopPickMedia(product, alt, card);

  const body = document.createElement('div');
  body.className = 'gengage-chat-ai-toppick-body';

  const name = product['name'] as string | undefined;
  if (name) {
    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-ai-toppick-name';
    nameEl.textContent = name;
    body.appendChild(nameEl);
  }

  const ratingRow = renderRatingRow(product);
  if (ratingRow) body.appendChild(ratingRow);

  /* Lean order: price before reason */
  appendPriceRow(product, body, ctx);

  if (item.reason) {
    const reasonEl = document.createElement('div');
    reasonEl.className = 'gengage-chat-ai-toppick-reason';
    reasonEl.textContent = item.reason;
    body.appendChild(reasonEl);
  }

  if (item.labels && item.labels.length > 0) {
    body.appendChild(renderSentimentChips(item.labels));
  }

  if (isWinner && typeof item.expertQualityScore === 'number') {
    const score = document.createElement('div');
    score.className = 'gengage-chat-ai-toppick-score';
    let displayScore = item.expertQualityScore;
    let maxScale = 10;
    if (displayScore > 10) {
      displayScore = Math.round(displayScore) / 10;
    } else if (displayScore <= 5) {
      maxScale = 5;
    }
    score.textContent = `${displayScore}/${maxScale}`;
    body.appendChild(score);
  }

  if (isWinner && item.reviewHighlight) {
    const review = document.createElement('blockquote');
    review.className = 'gengage-chat-ai-toppick-review';
    review.textContent = item.reviewHighlight;
    body.appendChild(review);
  }

  card.appendChild(body);

  if (item.action) {
    const sku = resolveActionSku(item);
    const url = (product['url'] as string) ?? '';

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

export function renderAITopPicks(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-ai-top-picks';

  const suggestions = (element.props?.['suggestions'] ?? []) as AITopPickItem[];
  if (suggestions.length === 0) return container;

  const title = document.createElement('h3');
  title.className = 'gengage-chat-ai-top-picks-title';
  title.textContent = ctx.i18n?.aiTopPicksTitle ?? 'Top Picks';
  container.appendChild(title);

  const scrollRow = document.createElement('div');
  scrollRow.className = 'gengage-chat-ai-top-picks-scroll';

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
  for (const label of labels) {
    const chip = document.createElement('span');
    chip.className = 'gengage-chat-ai-toppick-label';
    chip.dataset['sentiment'] = label.sentiment ?? 'neutral';
    chip.textContent = label.label;
    container.appendChild(chip);
  }
  return container;
}
