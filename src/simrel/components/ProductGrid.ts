import type { NormalizedProduct } from '../../common/v1-protocol-adapter.js';
import type { SimRelI18n } from '../types.js';
import { renderProductCard } from './ProductCard.js';
import type { ProductCardOptions } from './ProductCard.js';

export interface ProductGridOptions {
  products: NormalizedProduct[];
  columns?: number;
  discountType?: 'strike-through' | 'badge';
  onClick: (product: NormalizedProduct) => void;
  onAddToCart: (params: { sku: string; quantity: number; cartCode: string }) => void;
  renderCard?: (product: NormalizedProduct, index: number) => string;
  i18n?: SimRelI18n;
}

export function renderProductGrid(options: ProductGridOptions): HTMLElement {
  const grid = document.createElement('div');
  grid.className = 'gengage-simrel-grid';
  grid.setAttribute('role', 'list');
  grid.setAttribute('aria-label', options.i18n?.similarProductsAriaLabel ?? 'Similar products');

  if (options.columns) {
    grid.style.setProperty('--gengage-simrel-columns', String(options.columns));
  }

  for (let i = 0; i < options.products.length; i++) {
    const product = options.products[i]!;
    const cardOpts: ProductCardOptions = {
      product,
      index: i,
      onClick: options.onClick,
      onAddToCart: options.onAddToCart,
    };
    if (options.i18n !== undefined) cardOpts.i18n = options.i18n;
    if (options.discountType !== undefined) cardOpts.discountType = options.discountType;
    if (options.renderCard !== undefined) cardOpts.renderCard = options.renderCard;
    const card = renderProductCard(cardOpts);
    grid.appendChild(card);
  }

  if (options.products.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gengage-simrel-empty';
    empty.textContent = options.i18n?.emptyStateMessage ?? 'Benzer ürün bulunamadı.';
    grid.appendChild(empty);
  }

  return grid;
}
