import { describe, it, expect, vi } from 'vitest';
import type { NormalizedProduct } from '../src/common/protocol-adapter.js';
import type { SimRelI18n } from '../src/simrel/types.js';
import { renderProductCard } from '../src/simrel/components/ProductCard.js';
import { renderProductGrid } from '../src/simrel/components/ProductGrid.js';
import { renderGroupTabs } from '../src/simrel/components/GroupTabs.js';
import type { ProductGroup } from '../src/simrel/api.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProduct(overrides: Partial<NormalizedProduct> = {}): NormalizedProduct {
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
  decreaseLabel: 'Decrease',
  increaseLabel: 'Increase',
  priceSuffix: ' TL',
};

// ---------------------------------------------------------------------------
// ProductCard
// ---------------------------------------------------------------------------

describe('ProductCard', () => {
  it('renders card with name, price, and image', () => {
    const onClick = vi.fn();
    const onAddToCart = vi.fn();
    const card = renderProductCard({
      product: makeProduct(),
      index: 0,
      onClick,
      onAddToCart,
      i18n: defaultI18n,
    });

    expect(card.querySelector('.gengage-simrel-card-name')?.textContent).toBe('Test Product');
    expect(card.querySelector('.gengage-simrel-card-price-current')?.textContent).toBe('1.299 TL');
    expect(card.querySelector('img')?.src).toBe('https://cdn.example.com/img.jpg');
  });

  it('applies chat product-card classes for visual parity', () => {
    const card = renderProductCard({
      product: makeProduct({ cartCode: 'CART-1' }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });

    expect(card.classList.contains('gengage-chat-product-card')).toBe(true);
    expect(card.querySelector('.gengage-simrel-card-cta')?.classList.contains('gengage-chat-product-card-cta')).toBe(
      true,
    );
    expect(card.querySelector('.gengage-simrel-atc')?.classList.contains('gengage-qty-stepper--compact')).toBe(true);
  });

  it('dispatches onClick when card is clicked', () => {
    const onClick = vi.fn();
    const card = renderProductCard({
      product: makeProduct(),
      index: 0,
      onClick,
      onAddToCart: vi.fn(),
    });

    card.click();
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ sku: 'SKU-1' }));
  });

  it('dispatches onAddToCart via stepper and prevents card click propagation', () => {
    const onClick = vi.fn();
    const onAddToCart = vi.fn();
    const card = renderProductCard({
      product: makeProduct({ cartCode: 'CART-1' }),
      index: 0,
      onClick,
      onAddToCart,
    });

    const stepper = card.querySelector('.gengage-simrel-atc') as HTMLElement;
    expect(stepper).toBeTruthy();

    // Stepper renders [−][1][+][Submit]
    const submitBtn = stepper.querySelector('.gengage-qty-submit') as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    submitBtn.click();
    expect(onAddToCart).toHaveBeenCalledWith({ sku: 'SKU-1', quantity: 1, cartCode: 'CART-1' });
    expect(onClick).not.toHaveBeenCalled();
  });

  it('stepper increments quantity before add-to-cart', () => {
    const onAddToCart = vi.fn();
    const card = renderProductCard({
      product: makeProduct({ cartCode: 'CART-1' }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart,
    });

    const stepper = card.querySelector('.gengage-simrel-atc') as HTMLElement;
    const incBtn = stepper.querySelectorAll('.gengage-qty-btn')[1] as HTMLButtonElement; // [+] button
    const valueEl = stepper.querySelector('.gengage-qty-value') as HTMLElement;
    const submitBtn = stepper.querySelector('.gengage-qty-submit') as HTMLButtonElement;

    // Increment twice
    incBtn.click();
    incBtn.click();
    expect(valueEl.textContent).toBe('3');

    submitBtn.click();
    expect(onAddToCart).toHaveBeenCalledWith({ sku: 'SKU-1', quantity: 3, cartCode: 'CART-1' });
  });

  it('omits ATC button when cartCode is absent', () => {
    const card = renderProductCard({
      product: makeProduct({ cartCode: undefined }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    expect(card.querySelector('.gengage-simrel-atc')).toBeNull();
  });

  it('omits image when imageUrl is absent', () => {
    const card = renderProductCard({
      product: makeProduct({ imageUrl: undefined }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    expect(card.querySelector('img')).toBeNull();
  });

  it('shows discount badge with clamped value', () => {
    const card = renderProductCard({
      product: makeProduct({ discountPercent: 150 }),
      index: 0,
      discountType: 'badge',
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const badge = card.querySelector('.gengage-simrel-badge');
    expect(badge).toBeTruthy();
    expect(badge!.textContent).toBe('%100'); // clamped from 150 to 100
  });

  it('shows strike-through original price', () => {
    const card = renderProductCard({
      product: makeProduct({ price: '799', originalPrice: '999' }),
      index: 0,
      discountType: 'strike-through',
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });

    const original = card.querySelector('.gengage-simrel-card-price-original');
    expect(original).toBeTruthy();
    expect(original!.textContent).toBe('999 TL');
  });

  it('renders rating stars clamped to 0-5', () => {
    const card = renderProductCard({
      product: makeProduct({ rating: 7, reviewCount: 42 }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const ratingEl = card.querySelector('.gengage-simrel-card-rating');
    expect(ratingEl).toBeTruthy();
    // Clamped to 5: should show 5 filled stars, 0 empty
    expect(ratingEl!.textContent).toContain('\u2605\u2605\u2605\u2605\u2605');
  });

  it('renders review count alongside rating', () => {
    const card = renderProductCard({
      product: makeProduct({ rating: 4.2, reviewCount: 15 }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const reviewCount = card.querySelector('.gengage-simrel-card-review-count');
    expect(reviewCount).toBeTruthy();
    expect(reviewCount!.textContent).toBe(' (15)');
  });

  it('renders brand when present', () => {
    const card = renderProductCard({
      product: makeProduct({ brand: 'Bosch' }),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const brandEl = card.querySelector('.gengage-simrel-card-brand');
    expect(brandEl).toBeTruthy();
    expect(brandEl!.textContent).toBe('Bosch');
  });

  it('sets proper accessibility attributes', () => {
    const card = renderProductCard({
      product: makeProduct(),
      index: 0,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    expect(card.getAttribute('role')).toBe('listitem');
    expect(card.dataset['sku']).toBe('SKU-1');
  });
});

// ---------------------------------------------------------------------------
// ProductGrid
// ---------------------------------------------------------------------------

describe('ProductGrid', () => {
  it('renders a grid with products', () => {
    const products = [makeProduct({ sku: 'A' }), makeProduct({ sku: 'B' })];
    const grid = renderProductGrid({
      products,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });

    expect(grid.getAttribute('role')).toBe('list');
    expect(grid.getAttribute('aria-label')).toBe('Similar products');
    expect(grid.querySelectorAll('.gengage-simrel-card').length).toBe(2);
  });

  it('shows empty state when products array is empty', () => {
    const grid = renderProductGrid({
      products: [],
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });

    const empty = grid.querySelector('.gengage-simrel-empty');
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toBe('No similar products found.');
  });

  it('applies custom column count via CSS variable', () => {
    const grid = renderProductGrid({
      products: [makeProduct()],
      columns: 3,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    expect(grid.style.getPropertyValue('--gengage-simrel-columns')).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// GroupTabs — WAI-ARIA tablist
// ---------------------------------------------------------------------------

describe('GroupTabs', () => {
  function makeGroup(name: string, productCount: number): ProductGroup {
    return {
      name,
      products: Array.from({ length: productCount }, (_, i) => makeProduct({ sku: `${name}-${i}` })),
    };
  }

  it('renders tabs and panels for each group', () => {
    const groups = [makeGroup('A', 2), makeGroup('B', 3)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });

    const tabs = result.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
    expect(tabs[0]!.textContent).toBe('A');
    expect(tabs[1]!.textContent).toBe('B');

    const panels = result.querySelectorAll('[role="tabpanel"]');
    expect(panels.length).toBe(2);
  });

  it('first tab is active by default', () => {
    const groups = [makeGroup('A', 1), makeGroup('B', 1)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const tabs = result.querySelectorAll('[role="tab"]');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('false');
    expect((tabs[0] as HTMLElement).tabIndex).toBe(0);
    expect((tabs[1] as HTMLElement).tabIndex).toBe(-1);
  });

  it('clicking a tab activates it and hides others', () => {
    const groups = [makeGroup('A', 1), makeGroup('B', 1)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const tabs = result.querySelectorAll('[role="tab"]');
    const panels = result.querySelectorAll('[role="tabpanel"]');

    // Click second tab
    (tabs[1] as HTMLElement).click();

    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('false');
    expect((panels[0] as HTMLElement).style.display).toBe('none');
    expect((panels[1] as HTMLElement).style.display).toBe('');
  });

  it('ArrowRight navigates to next tab', () => {
    const groups = [makeGroup('A', 1), makeGroup('B', 1), makeGroup('C', 1)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const tabs = result.querySelectorAll('[role="tab"]');

    // Dispatch ArrowRight on first tab
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
    tabs[0]!.dispatchEvent(event);

    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
    expect(tabs[0]!.getAttribute('aria-selected')).toBe('false');
  });

  it('ArrowLeft navigates to previous tab with wrapping', () => {
    const groups = [makeGroup('A', 1), makeGroup('B', 1)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const tabs = result.querySelectorAll('[role="tab"]');

    // ArrowLeft from first tab → wraps to last
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
    tabs[0]!.dispatchEvent(event);

    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true');
  });

  it('Home key goes to first tab', () => {
    const groups = [makeGroup('A', 1), makeGroup('B', 1), makeGroup('C', 1)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const tabs = result.querySelectorAll('[role="tab"]');

    // Activate last tab first
    (tabs[2] as HTMLElement).click();
    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true');

    // Home from last tab
    const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
    tabs[2]!.dispatchEvent(event);

    expect(tabs[0]!.getAttribute('aria-selected')).toBe('true');
  });

  it('End key goes to last tab', () => {
    const groups = [makeGroup('A', 1), makeGroup('B', 1), makeGroup('C', 1)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const tabs = result.querySelectorAll('[role="tab"]');

    const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
    tabs[0]!.dispatchEvent(event);

    expect(tabs[2]!.getAttribute('aria-selected')).toBe('true');
  });

  it('tabs have proper aria-controls linking', () => {
    const groups = [makeGroup('X', 1)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const tab = result.querySelector('[role="tab"]') as HTMLElement;
    const panel = result.querySelector('[role="tabpanel"]') as HTMLElement;

    const controlsId = tab.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();
    expect(panel.id).toBe(controlsId);
    expect(panel.getAttribute('aria-labelledby')).toBe(tab.id);
  });

  it('shows empty state when groups array is empty', () => {
    const result = renderGroupTabs({
      groups: [],
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
      i18n: defaultI18n,
    });

    expect(result.querySelector('[role="tablist"]')).toBeNull();
    const empty = result.querySelector('.gengage-simrel-empty');
    expect(empty).toBeTruthy();
    expect(empty!.textContent).toBe('No similar products found.');
  });

  it('lazy-renders grid content only for active tab', () => {
    const groups = [makeGroup('A', 2), makeGroup('B', 3)];
    const result = renderGroupTabs({
      groups,
      onClick: vi.fn(),
      onAddToCart: vi.fn(),
    });

    const panels = result.querySelectorAll('[role="tabpanel"]');

    // First panel should have rendered cards
    expect(panels[0]!.querySelectorAll('.gengage-simrel-card').length).toBe(2);

    // Second panel hidden, no cards
    expect(panels[1]!.querySelectorAll('.gengage-simrel-card').length).toBe(0);

    // Activate second tab
    const tabs = result.querySelectorAll('[role="tab"]');
    (tabs[1] as HTMLElement).click();

    // Now second panel has cards
    expect(panels[1]!.querySelectorAll('.gengage-simrel-card').length).toBe(3);
  });
});
