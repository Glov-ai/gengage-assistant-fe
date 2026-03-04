import type { NormalizedProduct } from '../../common/v1-protocol-adapter.js';
import type { SimRelI18n } from '../types.js';
import type { PriceFormatConfig } from '../../common/price-formatter.js';
import { formatPrice } from '../../common/price-formatter.js';
import { sanitizeHtml, isSafeImageUrl } from '../../common/safe-html.js';
import { createQuantityStepper } from '../../common/quantity-stepper.js';
import { clampDiscount, addImageErrorHandler, renderStarRating } from '../../common/product-utils.js';

export interface ProductCardOptions {
  product: NormalizedProduct;
  index: number;
  discountType?: 'strike-through' | 'badge';
  onClick: (product: NormalizedProduct) => void;
  onAddToCart: (params: { sku: string; quantity: number; cartCode: string }) => void;
  renderCard?: (product: NormalizedProduct, index: number) => string;
  i18n?: SimRelI18n;
  pricing?: PriceFormatConfig;
}

export function renderProductCard(options: ProductCardOptions): HTMLElement {
  const { product, index, discountType, onClick, onAddToCart, renderCard } = options;
  const i18n = options.i18n;
  const pricing = options.pricing;

  // Custom card renderer (XSS warning: raw HTML injection)
  if (renderCard) {
    const wrapper = document.createElement('div');
    wrapper.className = 'gengage-simrel-card gengage-simrel-card--custom';
    // Sanitize renderCard output to prevent XSS from user-provided renderers.
    wrapper.innerHTML = sanitizeHtml(renderCard(product, index));
    wrapper.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.gengage-simrel-atc')) return;
      onClick(product);
    });
    return wrapper;
  }

  const card = document.createElement('article');
  card.className = 'gengage-simrel-card';
  card.setAttribute('role', 'listitem');
  card.dataset['sku'] = product.sku;

  // Image
  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'gengage-simrel-card-image';
  if (product.imageUrl && isSafeImageUrl(product.imageUrl)) {
    const img = document.createElement('img');
    img.src = product.imageUrl;
    img.alt = product.name;
    img.loading = 'lazy';
    addImageErrorHandler(img);
    imgWrapper.appendChild(img);
  }

  // Discount badge
  if (discountType === 'badge' && product.discountPercent && product.discountPercent > 0) {
    const badge = document.createElement('span');
    badge.className = 'gengage-simrel-badge';
    badge.textContent = `%${clampDiscount(product.discountPercent)}`;
    imgWrapper.appendChild(badge);
  }

  card.appendChild(imgWrapper);

  // Info section
  const info = document.createElement('div');
  info.className = 'gengage-simrel-card-info';

  // Brand
  if (product.brand) {
    const brandEl = document.createElement('div');
    brandEl.className = 'gengage-simrel-card-brand';
    brandEl.textContent = product.brand;
    info.appendChild(brandEl);
  }

  // Name
  const nameEl = document.createElement('div');
  nameEl.className = 'gengage-simrel-card-name';
  nameEl.textContent = product.name;
  info.appendChild(nameEl);

  // Rating
  if (product.rating != null && product.rating > 0) {
    const ratingEl = document.createElement('div');
    ratingEl.className = 'gengage-simrel-card-rating';
    ratingEl.textContent = renderStarRating(product.rating);
    if (product.reviewCount != null) {
      const count = document.createElement('span');
      count.className = 'gengage-simrel-card-review-count';
      count.textContent = ` (${product.reviewCount})`;
      ratingEl.appendChild(count);
    }
    info.appendChild(ratingEl);
  }

  // Price
  const priceContainer = document.createElement('div');
  priceContainer.className = 'gengage-simrel-card-price';

  if (product.originalPrice && product.originalPrice !== product.price) {
    if (discountType === 'strike-through' || !discountType) {
      const original = document.createElement('span');
      original.className = 'gengage-simrel-card-price-original';
      original.textContent = formatPrice(product.originalPrice, pricing);
      priceContainer.appendChild(original);
    }
  }

  if (product.price) {
    const current = document.createElement('span');
    current.className = 'gengage-simrel-card-price-current';
    current.textContent = formatPrice(product.price, pricing);
    priceContainer.appendChild(current);
  }

  info.appendChild(priceContainer);
  card.appendChild(info);

  // Add to cart stepper (only when in stock)
  if (product.cartCode && product.inStock !== false) {
    const cartCode = product.cartCode;
    const stepper = createQuantityStepper({
      compact: false,
      label: i18n?.addToCartButton ?? 'Sepete Ekle',
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
    onClick(product);
  });

  return card;
}
