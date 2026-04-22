import { describe, it, expect, vi } from 'vitest';
import type { UIElement } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';
import { renderProductSummaryCard } from '../src/chat/components/ProductSummaryCard.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeElement(product: Record<string, unknown> | undefined): UIElement {
  return {
    type: 'ProductSummaryCard',
    props: product ? { product } : {},
  };
}

function makeContext(overrides: Partial<ChatUISpecRenderContext> = {}): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    onProductSelect: vi.fn(),
    ...overrides,
  };
}

const FULL_PRODUCT = {
  sku: 'SKU-1',
  cartCode: 'CART-1',
  name: 'Tekno-Tel Ekmek Sepeti',
  brand: 'Tekno-Tel',
  url: 'https://example.com/p/1',
  imageUrl: 'https://cdn.example.com/img.jpg',
  price: '1299',
  originalPrice: '1599',
  rating: 4.5,
  reviewCount: 42,
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('ProductSummaryCard', () => {
  it('returns empty card when props is undefined', () => {
    const el: UIElement = { type: 'ProductSummaryCard' };
    const card = renderProductSummaryCard(el, makeContext());
    expect(card.classList.contains('gengage-chat-product-summary')).toBe(true);
    expect(card.classList.contains('gds-card')).toBe(true);
    expect(card.children.length).toBe(0);
  });

  it('renders image, content, and CTA for a full product', () => {
    const card = renderProductSummaryCard(makeElement(FULL_PRODUCT), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__image img')).toBeTruthy();
    expect(card.querySelector('.gengage-chat-product-summary__name')).toBeTruthy();
    expect(card.querySelector('.gengage-chat-product-summary__rating')).toBeTruthy();
    expect(card.querySelector('.gengage-chat-product-summary__price')).toBeTruthy();
    expect(card.querySelector('.gengage-chat-product-summary__cta')).toBeTruthy();
  });

  it('does not duplicate brand when name already starts with brand', () => {
    const product = { ...FULL_PRODUCT, brand: 'Tekno-Tel', name: 'Tekno-Tel Ekmek Sepeti' };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    const nameEl = card.querySelector('.gengage-chat-product-summary__name');
    expect(nameEl?.textContent).toBe('Tekno-Tel Ekmek Sepeti');
  });

  it('prepends brand when name does not start with brand', () => {
    const product = { ...FULL_PRODUCT, brand: 'Bosch', name: 'Hammer Drill' };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    const nameEl = card.querySelector('.gengage-chat-product-summary__name');
    expect(nameEl?.textContent).toBe('Bosch Hammer Drill');
  });

  it('shows original list price when discounted (default strikethrough)', () => {
    const card = renderProductSummaryCard(makeElement(FULL_PRODUCT), makeContext());
    const orig = card.querySelector('.gengage-chat-product-summary__price-original');
    expect(orig).toBeTruthy();
    expect(orig?.textContent).toBeTruthy();
  });

  it('hides original price when same as current price', () => {
    const product = { ...FULL_PRODUCT, originalPrice: '1299' };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__price-original')).toBeNull();
  });

  it('shows rating stars and review count', () => {
    const card = renderProductSummaryCard(makeElement(FULL_PRODUCT), makeContext());
    const ratingRow = card.querySelector('.gengage-chat-product-summary__rating');
    expect(ratingRow?.textContent).toContain('★');
    const reviewCount = card.querySelector('.gengage-chat-product-summary__review-count');
    expect(reviewCount?.textContent).toContain('42');
  });

  it('skips rating when rating is 0 or missing', () => {
    const product = { ...FULL_PRODUCT, rating: 0 };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__rating')).toBeNull();
  });

  it('skips image when imageUrl is missing', () => {
    const product = { ...FULL_PRODUCT, imageUrl: undefined };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__image')).toBeNull();
  });

  it('skips CTA when url is missing and product is not add-to-cartable', () => {
    const product = { ...FULL_PRODUCT, url: undefined, cartCode: undefined };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__cta')).toBeNull();
  });

  it('shows add-to-cart CTA when url is missing but sku and cartCode are present', () => {
    const product = { ...FULL_PRODUCT, url: undefined };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    const cta = card.querySelector('.gengage-chat-product-summary__cta');
    expect(cta?.tagName).toBe('BUTTON');
    expect(cta?.textContent).toBe('Add to Cart');
  });

  it('rejects javascript: URLs for image', () => {
    const product = { ...FULL_PRODUCT, imageUrl: 'javascript:alert(1)' };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__image')).toBeNull();
  });

  it('rejects javascript: URLs for CTA', () => {
    const product = { ...FULL_PRODUCT, url: 'javascript:alert(1)', cartCode: undefined };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__cta')).toBeNull();
  });

  it('uses custom add-to-cart label from i18n when sku and cartCode are present', () => {
    const ctx = makeContext({
      i18n: { addToCartButton: 'Sepete Ekle' } as ChatUISpecRenderContext['i18n'],
    });
    const card = renderProductSummaryCard(makeElement(FULL_PRODUCT), ctx);
    expect(card.querySelector('.gengage-chat-product-summary__cta')?.textContent).toBe('Sepete Ekle');
  });

  it('defaults add-to-cart CTA label when sku and cartCode are present', () => {
    const card = renderProductSummaryCard(makeElement(FULL_PRODUCT), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__cta')?.textContent).toBe('Add to Cart');
  });

  it('uses product CTA link label when not add-to-cartable', () => {
    const product = { ...FULL_PRODUCT, cartCode: undefined };
    const ctx = makeContext({ i18n: { productCtaLabel: 'Siteye git' } as ChatUISpecRenderContext['i18n'] });
    const card = renderProductSummaryCard(makeElement(product), ctx);
    const cta = card.querySelector('.gengage-chat-product-summary__cta');
    expect(cta?.tagName).toBe('A');
    expect(cta?.textContent).toBe('Siteye git');
  });

  // --- Click handling ---

  it('calls onProductSelect when card body is clicked', () => {
    const onProductSelect = vi.fn();
    const card = renderProductSummaryCard(makeElement(FULL_PRODUCT), makeContext({ onProductSelect }));
    card.click();
    expect(onProductSelect).toHaveBeenCalledWith(FULL_PRODUCT);
  });

  it('does not call onProductSelect when CTA is clicked', () => {
    const onProductSelect = vi.fn();
    const onAction = vi.fn();
    const card = renderProductSummaryCard(makeElement(FULL_PRODUCT), makeContext({ onProductSelect, onAction }));
    const cta = card.querySelector('.gengage-chat-product-summary__cta') as HTMLElement;
    cta.click();
    expect(onProductSelect).not.toHaveBeenCalled();
    expect(onAction).toHaveBeenCalledWith({
      title: 'Add to Cart',
      type: 'addToCart',
      payload: { sku: 'SKU-1', cartCode: 'CART-1', quantity: 1 },
    });
  });

  // --- Edge cases ---

  it('handles product with only name and sku', () => {
    const product = { sku: 'X', name: 'Minimal Product' };
    const card = renderProductSummaryCard(makeElement(product), makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__name')?.textContent).toBe('Minimal Product');
    expect(card.querySelector('.gengage-chat-product-summary__image')).toBeNull();
    expect(card.querySelector('.gengage-chat-product-summary__price')).toBeNull();
    expect(card.querySelector('.gengage-chat-product-summary__rating')).toBeNull();
  });

  it('falls back to element.props as product when product key is missing', () => {
    // Some callers may pass props directly as the product object
    const el: UIElement = { type: 'ProductSummaryCard', props: { sku: 'Y', name: 'Direct Props' } };
    const card = renderProductSummaryCard(el, makeContext());
    expect(card.querySelector('.gengage-chat-product-summary__name')?.textContent).toBe('Direct Props');
  });
});
