/**
 * Compact horizontal product card for inline chat-pane rendering.
 *
 * Production parity: mirrors the prior engine's `LaunchSingleProduct` component.
 * Renders when `productDetails` arrives — the full ProductDetailsPanel goes
 * to the left panel while this compact summary appears inline in chat messages.
 *
 * Layout: [image 64×64] [name · rating · price] [View link]
 */

import type { UIElement } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';
import { formatPrice } from '../../common/price-formatter.js';
import { isSafeUrl, safeSetAttribute } from '../../common/safe-html.js';
import { addImageErrorHandler, createStarRatingElement } from '../../common/product-utils.js';

export function renderProductSummaryCard(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const product = (element.props?.['product'] ?? element.props) as Record<string, unknown> | undefined;

  const card = document.createElement('div');
  card.className = 'gengage-chat-product-summary';
  if (!product) return card;

  // Make entire card clickable to open product in panel
  card.style.cursor = 'pointer';
  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) return;
    ctx.onProductSelect?.(product);
  });

  // --- Image (left side) ---
  const imageUrl = product['imageUrl'] as string | undefined;
  if (imageUrl && isSafeUrl(imageUrl)) {
    const imgWrap = document.createElement('div');
    imgWrap.className = 'gengage-chat-product-summary__image';
    const img = document.createElement('img');
    img.loading = 'lazy';
    safeSetAttribute(img, 'src', imageUrl);
    const name = product['name'] as string | undefined;
    img.alt = name || 'Product image';
    addImageErrorHandler(img);
    imgWrap.appendChild(img);
    card.appendChild(imgWrap);
  }

  // --- Content (right side) ---
  const content = document.createElement('div');
  content.className = 'gengage-chat-product-summary__content';

  // Product name (brand + name)
  const brand = product['brand'] as string | undefined;
  const name = product['name'] as string | undefined;
  if (name) {
    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-product-summary__name';
    // Only prepend brand if name doesn't already start with it
    const needsBrand = brand && !name.toLowerCase().startsWith(brand.toLowerCase());
    nameEl.textContent = needsBrand ? `${brand} ${name}` : name;
    content.appendChild(nameEl);
  }

  // Rating
  const rating = product['rating'];
  const reviewCount = product['reviewCount'];
  if (typeof rating === 'number' && Number.isFinite(rating) && rating > 0) {
    const ratingRow = document.createElement('div');
    ratingRow.className = 'gengage-chat-product-summary__rating';
    ratingRow.appendChild(createStarRatingElement(rating));
    if (typeof reviewCount === 'number' && Number.isFinite(reviewCount)) {
      const count = document.createElement('span');
      count.className = 'gengage-chat-product-summary__review-count';
      count.textContent = ` (${reviewCount})`;
      ratingRow.appendChild(count);
    }
    content.appendChild(ratingRow);
  }

  // Price row
  const price = product['price'] as string | undefined;
  const originalPrice = product['originalPrice'] as string | undefined;
  if (price) {
    const priceRow = document.createElement('div');
    priceRow.className = 'gengage-chat-product-summary__price';
    if (originalPrice && originalPrice !== price) {
      const orig = document.createElement('span');
      orig.className = 'gengage-chat-product-summary__price-original';
      orig.textContent = formatPrice(originalPrice, ctx.pricing);
      priceRow.appendChild(orig);
      priceRow.appendChild(document.createTextNode(' '));
    }
    const current = document.createElement('span');
    current.className = 'gengage-chat-product-summary__price-current';
    current.textContent = formatPrice(price, ctx.pricing);
    priceRow.appendChild(current);
    content.appendChild(priceRow);
  }

  card.appendChild(content);

  // --- CTA link (right edge) ---
  const url = product['url'] as string | undefined;
  if (url && isSafeUrl(url)) {
    const cta = document.createElement('a');
    cta.className = 'gengage-chat-product-summary__cta';
    safeSetAttribute(cta, 'href', url);
    safeSetAttribute(cta, 'target', '_blank');
    safeSetAttribute(cta, 'rel', 'noopener noreferrer');
    cta.textContent = ctx.i18n?.productCtaLabel ?? 'View';
    card.appendChild(cta);
  }

  return card;
}
