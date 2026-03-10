import type { NormalizedProduct } from '../../common/protocol-adapter.js';
import type { SimRelI18n } from '../types.js';
import type { PriceFormatConfig } from '../../common/price-formatter.js';
import { formatPrice } from '../../common/price-formatter.js';
import { sanitizeHtml, isSafeImageUrl } from '../../common/safe-html.js';
import { createQuantityStepper } from '../../common/quantity-stepper.js';
import { clampDiscount, addImageErrorHandler, createStarRatingElement } from '../../common/product-utils.js';

export interface ProductCardOptions {
  product: NormalizedProduct;
  index: number;
  discountType?: 'strike-through' | 'badge';
  onClick: (product: NormalizedProduct) => void;
  onAddToCart: (params: { sku: string; quantity: number; cartCode: string }) => void;
  renderCard?: (product: NormalizedProduct, index: number) => string;
  renderCardElement?: (product: NormalizedProduct, index: number) => HTMLElement | null;
  i18n?: SimRelI18n;
  pricing?: PriceFormatConfig;
}

export function renderProductCard(options: ProductCardOptions): HTMLElement {
  const { product, index, discountType, onClick, onAddToCart, renderCard } = options;
  const i18n = options.i18n;
  const pricing = options.pricing;

  // Custom card element renderer (returns full HTMLElement, takes precedence)
  if (options.renderCardElement) {
    const el = options.renderCardElement(product, index);
    if (el) return el;
  }

  // Custom card renderer (XSS warning: raw HTML injection)
  if (renderCard) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gengage-simrel-card gengage-simrel-card--custom';
    // Sanitize renderCard output to prevent XSS from user-provided renderers.
    wrapper.innerHTML = sanitizeHtml(renderCard(product, index));
    wrapper.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.gengage-simrel-atc')) return;
      if ((e.target as HTMLElement).closest('.gengage-chat-product-card-atc')) return;
      onClick(product);
    });
    return wrapper;
  }

  const card = document.createElement('article');
  // Intentional class coupling: reuse chat product-card classes so SimRel and chat stay visually identical.
  card.className = 'gengage-simrel-card gengage-chat-product-card';
  card.setAttribute('role', 'listitem');
  card.dataset['sku'] = product.sku;

  // Image
  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'gengage-simrel-card-image gengage-chat-product-card-img-wrapper';
  if (product.imageUrl && isSafeImageUrl(product.imageUrl)) {
    const img = document.createElement('img');
    img.className = 'gengage-chat-product-card-img';
    img.src = product.imageUrl;
    img.alt = product.name;
    img.loading = 'lazy';
    addImageErrorHandler(img);
    imgWrapper.appendChild(img);
  }

  // Discount badge
  if (discountType === 'badge' && product.discountPercent && product.discountPercent > 0) {
    const badge = document.createElement('span');
    badge.className = 'gengage-simrel-badge gengage-chat-product-card-discount-badge';
    badge.textContent = `%${clampDiscount(product.discountPercent)}`;
    imgWrapper.appendChild(badge);
  }

  card.appendChild(imgWrapper);

  // Info section
  const info = document.createElement('div');
  info.className = 'gengage-simrel-card-info gengage-chat-product-card-body';

  // Brand
  if (product.brand) {
    const brandEl = document.createElement('div');
    brandEl.className = 'gengage-simrel-card-brand gengage-chat-product-card-brand';
    brandEl.textContent = product.brand;
    info.appendChild(brandEl);
  }

  // Name
  const nameEl = document.createElement('div');
  nameEl.className = 'gengage-simrel-card-name gengage-chat-product-card-name';
  nameEl.textContent = product.name;
  nameEl.title = product.name;
  info.appendChild(nameEl);

  // Rating
  if (product.rating != null && product.rating > 0) {
    const ratingEl = document.createElement('div');
    ratingEl.className = 'gengage-simrel-card-rating gengage-chat-product-card-rating';
    ratingEl.appendChild(createStarRatingElement(product.rating));
    if (product.reviewCount != null) {
      const count = document.createElement('span');
      count.className = 'gengage-simrel-card-review-count gengage-chat-product-card-review-count';
      count.textContent = ` (${product.reviewCount})`;
      ratingEl.appendChild(count);
    }
    info.appendChild(ratingEl);
  }

  // Price
  const priceContainer = document.createElement('div');
  priceContainer.className = 'gengage-simrel-card-price gengage-chat-product-card-price';

  if (product.originalPrice && product.originalPrice !== product.price) {
    if (discountType === 'strike-through' || !discountType) {
      const original = document.createElement('span');
      original.className = 'gengage-simrel-card-price-original gengage-chat-product-card-original-price';
      original.textContent = formatPrice(product.originalPrice, pricing);
      priceContainer.appendChild(original);
    }
  }

  if (product.price) {
    const current = document.createElement('span');
    current.className = 'gengage-simrel-card-price-current gengage-chat-product-card-price-current';
    current.textContent = formatPrice(product.price, pricing);
    priceContainer.appendChild(current);
  }

  info.appendChild(priceContainer);
  card.appendChild(info);

  // Keep SimRel cards aligned with chat product-card structure.
  const cta = document.createElement('button');
  cta.className = 'gengage-simrel-card-cta gengage-chat-product-card-cta';
  cta.type = 'button';
  cta.textContent = i18n?.ctaLabel ?? 'View';
  cta.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(product);
  });
  card.appendChild(cta);

  // Add to cart stepper or out-of-stock indicator
  if (product.inStock === false) {
    const oos = document.createElement('div');
    oos.className = 'gengage-simrel-card-oos';
    oos.textContent = i18n?.outOfStockLabel ?? 'Out of Stock';
    card.appendChild(oos);
  } else if (product.cartCode) {
    const cartCode = product.cartCode;
    const stepper = createQuantityStepper({
      compact: true,
      label: i18n?.addToCartButton ?? 'Add to Cart',
      onSubmit: (quantity) => {
        onAddToCart({ sku: product.sku, quantity, cartCode });
      },
    });
    stepper.classList.add('gengage-simrel-atc');
    card.appendChild(stepper);
  }

  // Card click → navigate
  card.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.gengage-simrel-atc')) return;
    if ((e.target as HTMLElement).closest('.gengage-chat-product-card-atc')) return;
    if ((e.target as HTMLElement).closest('.gengage-chat-product-card-cta')) return;
    onClick(product);
  });

  return card;
}
