/**
 * Guards for bad backend data:
 * - GAP-042: Hide "0 TL" price for out-of-stock products
 * - GAP-073: Filter zero-value promotion badges ("%0.0 değerinde Puan")
 * - GAP-019/045: Hide empty stars for zero-rating products
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UISpec } from '../src/common/types.js';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpecRenderContext } from '../src/chat/components/renderUISpec.js';
import type { NormalizedProduct } from '../src/common/protocol-adapter.js';
import type { SimRelI18n } from '../src/simrel/types.js';
import { renderProductCard } from '../src/simrel/components/ProductCard.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProductCardSpec(productProps: Record<string, unknown>): UISpec {
  return {
    root: 'root',
    elements: {
      root: {
        type: 'ProductCard',
        props: { product: productProps },
      },
    },
  };
}

function makeProductDetailsPanelSpec(productProps: Record<string, unknown>): UISpec {
  return {
    root: 'root',
    elements: {
      root: {
        type: 'ProductDetailsPanel',
        props: { product: productProps },
      },
    },
  };
}

function makeCtx(overrides: Partial<UISpecRenderContext> = {}): UISpecRenderContext {
  return {
    onAction: vi.fn(),
    onProductClick: vi.fn(),
    ...overrides,
  };
}

function makeSimrelProduct(overrides: Partial<NormalizedProduct> = {}): NormalizedProduct {
  return {
    sku: 'SKU-1',
    name: 'Test Product',
    url: 'https://example.com/p/1',
    price: '1299',
    imageUrl: 'https://cdn.example.com/img.jpg',
    ...overrides,
  };
}

const defaultI18n: SimRelI18n = {
  similarProductsAriaLabel: 'Similar products',
  emptyStateMessage: 'No similar products found.',
  addToCartButton: 'Add to Cart',
  ctaLabel: 'View',
  outOfStockLabel: 'Out of Stock',
  priceSuffix: ' TL',
};

// ---------------------------------------------------------------------------
// GAP-042: Zero price guard
// ---------------------------------------------------------------------------

describe('GAP-042: Zero price guard', () => {
  it('hides price when price is "0" in chat ProductCard', () => {
    const spec = makeProductCardSpec({ name: 'Out-of-stock Item', price: '0', sku: 'S1' });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-card-price')).toBeNull();
  });

  it('hides price when price is "0.00" in chat ProductCard', () => {
    const spec = makeProductCardSpec({ name: 'Out-of-stock Item', price: '0.00', sku: 'S2' });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-card-price')).toBeNull();
  });

  it('renders price when price is positive in chat ProductCard', () => {
    const spec = makeProductCardSpec({ name: 'In-stock Item', price: '299', sku: 'S3' });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-card-price')).not.toBeNull();
  });

  it('hides price when price is "0" in ProductDetailsPanel', () => {
    const spec = makeProductDetailsPanelSpec({
      name: 'Out-of-stock Detail',
      price: '0',
      sku: 'D1',
      imageUrl: 'https://example.com/img.jpg',
    });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-details-price')).toBeNull();
  });

  it('renders price when price is positive in ProductDetailsPanel', () => {
    const spec = makeProductDetailsPanelSpec({
      name: 'In-stock Detail',
      price: '499',
      sku: 'D2',
      imageUrl: 'https://example.com/img.jpg',
    });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-details-price')).not.toBeNull();
  });

  it('hides price when price is "0" in SimRel ProductCard', () => {
    const card = renderProductCard({
      product: makeSimrelProduct({ price: '0' }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });
    expect(card.querySelector('.gengage-simrel-card-price-current')).toBeNull();
  });

  it('renders price when price is positive in SimRel ProductCard', () => {
    const card = renderProductCard({
      product: makeSimrelProduct({ price: '1299' }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });
    expect(card.querySelector('.gengage-simrel-card-price-current')).not.toBeNull();
  });

  describe('async pricing with zero price', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('removes skeleton instead of showing "0 TL" after async resolve', () => {
      const spec = makeProductCardSpec({ name: 'Async Zero', price: '0', price_async: true, sku: 'A1' });
      const el = renderUISpec(spec, makeCtx());
      expect(el.querySelector('.gengage-chat-price-skeleton')).not.toBeNull();
      vi.advanceTimersByTime(300);
      // Skeleton removed, no price text rendered
      expect(el.querySelector('.gengage-chat-price-skeleton')).toBeNull();
      const priceRow = el.querySelector('.gengage-chat-product-card-price');
      // Price row exists (container created for skeleton) but should have no text content
      expect(priceRow?.textContent?.trim()).toBe('');
    });
  });
});

// ---------------------------------------------------------------------------
// GAP-073: Zero-value promotion badge filter
// ---------------------------------------------------------------------------

describe('GAP-073: Zero-value promotion badge filter', () => {
  it('does not render listing promotion badges in chat ProductCard', () => {
    const spec = makeProductCardSpec({
      name: 'Promo Test',
      price: '100',
      sku: 'P1',
      promotions: ['%0.0 değerinde Puan', 'Free Shipping'],
    });
    const el = renderUISpec(spec, makeCtx());
    const badges = el.querySelectorAll('.gengage-chat-product-card-promo-badge');
    expect(badges.length).toBe(0);
    expect(el.querySelector('.gengage-chat-product-card-promos')).toBeNull();
  });

  it('omits listing promo container even when non-zero promotions are present', () => {
    const spec = makeProductCardSpec({
      name: 'Promo Test',
      price: '100',
      sku: 'P2',
      promotions: ['%0 değerinde hediye', 'Flash Sale'],
    });
    const el = renderUISpec(spec, makeCtx());
    const badges = el.querySelectorAll('.gengage-chat-product-card-promo-badge');
    expect(badges.length).toBe(0);
    expect(el.querySelector('.gengage-chat-product-card-promos')).toBeNull();
  });

  it('does not render non-zero promotion badges on listing cards either', () => {
    const spec = makeProductCardSpec({
      name: 'Promo Test',
      price: '100',
      sku: 'P3',
      promotions: ['%10.0 değerinde Puan', 'Free Shipping'],
    });
    const el = renderUISpec(spec, makeCtx());
    const badges = el.querySelectorAll('.gengage-chat-product-card-promo-badge');
    expect(badges.length).toBe(0);
  });

  it('hides promo container when all badges are zero-value', () => {
    const spec = makeProductCardSpec({
      name: 'All Zero Promos',
      price: '100',
      sku: 'P4',
      promotions: ['%0.0 değerinde Puan', '%0 değerinde hediye'],
    });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-card-promos')).toBeNull();
  });

  it('filters zero-value badges in ProductDetailsPanel', () => {
    const spec = makeProductDetailsPanelSpec({
      name: 'Detail Promo',
      price: '200',
      sku: 'PD1',
      imageUrl: 'https://example.com/img.jpg',
      promotions: ['%0.0 değerinde Puan', 'Free Delivery'],
    });
    const el = renderUISpec(spec, makeCtx());
    const badges = el.querySelectorAll('.gengage-chat-product-details-promo-badge');
    expect(badges.length).toBe(1);
    expect(badges[0]?.textContent).toBe('Free Delivery');
  });

  it('hides promo container in details panel when all badges are zero-value', () => {
    const spec = makeProductDetailsPanelSpec({
      name: 'Detail All Zero',
      price: '200',
      sku: 'PD2',
      imageUrl: 'https://example.com/img.jpg',
      promotions: ['%0.0 değerinde Puan'],
    });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-details-promos')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GAP-019/045: Zero-rating star guard
// ---------------------------------------------------------------------------

describe('GAP-019/045: Zero-rating star guard', () => {
  it('hides stars when rating is 0 in chat ProductCard', () => {
    const spec = makeProductCardSpec({ name: 'No Rating', price: '100', sku: 'R1', rating: 0 });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-card-rating')).toBeNull();
  });

  it('shows stars when rating is positive in chat ProductCard', () => {
    const spec = makeProductCardSpec({ name: 'Rated', price: '100', sku: 'R2', rating: 4.5 });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-card-rating')).not.toBeNull();
  });

  it('hides stars when rating is 0 in ProductDetailsPanel', () => {
    const spec = makeProductDetailsPanelSpec({
      name: 'No Rating Detail',
      price: '100',
      sku: 'RD1',
      imageUrl: 'https://example.com/img.jpg',
      rating: 0,
    });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-details-rating')).toBeNull();
  });

  it('shows stars when rating is positive in ProductDetailsPanel', () => {
    const spec = makeProductDetailsPanelSpec({
      name: 'Rated Detail',
      price: '100',
      sku: 'RD2',
      imageUrl: 'https://example.com/img.jpg',
      rating: 3.2,
    });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-product-details-rating')).not.toBeNull();
  });

  it('hides stars when rating is 0 in SimRel ProductCard', () => {
    const card = renderProductCard({
      product: makeSimrelProduct({ rating: 0 }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });
    expect(card.querySelector('.gengage-simrel-card-rating')).toBeNull();
  });

  it('shows stars when rating is positive in SimRel ProductCard', () => {
    const card = renderProductCard({
      product: makeSimrelProduct({ rating: 4.0, reviewCount: 12 }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });
    expect(card.querySelector('.gengage-simrel-card-rating')).not.toBeNull();
  });
});
