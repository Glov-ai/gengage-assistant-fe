import { describe, it, expect, vi } from 'vitest';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpec } from '../src/common/types.js';
import type { ChatUISpecRenderContext, ProductSortState } from '../src/chat/types.js';

function makeSpec(products: Array<{ sku: string; name: string; price: string }>): UISpec {
  const elements: Record<string, { type: string; props: Record<string, unknown>; children?: string[] }> = {};
  const childIds: string[] = [];
  for (let i = 0; i < products.length; i++) {
    const id = `product-${i}`;
    childIds.push(id);
    elements[id] = {
      type: 'ProductCard',
      props: { product: { ...products[i], url: '' }, index: i },
    };
  }
  elements['root'] = { type: 'ProductGrid', props: { layout: 'grid' }, children: childIds };
  return { root: 'root', elements };
}

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    productSort: { type: 'related' },
    onSortChange: vi.fn(),
    i18n: {
      productCtaLabel: 'View',
      aiTopPicksTitle: 'Top',
      roleWinner: 'W',
      roleBestValue: 'BV',
      roleBestAlternative: 'BA',
      viewDetails: 'V',
      groundingReviewCta: 'R',
      variantsLabel: 'Var',
      sortRelated: 'Related',
      sortPriceAsc: 'Price \u2191',
      sortPriceDesc: 'Price \u2193',
      compareSelected: 'Compare',
      panelTitleProductDetails: 'PD',
      panelTitleSimilarProducts: 'SP',
      panelTitleComparisonResults: 'CR',
      panelTitleCategories: 'Cat',
      inStockLabel: 'In Stock',
      outOfStockLabel: 'Out of Stock',
      findSimilarLabel: 'Find Similar',
      viewMoreLabel: 'Show More',
      similarProductsLabel: 'Similar Products',
    },
    ...overrides,
  };
}

describe('Product Sort Controls', () => {
  it('renders sort toolbar when >1 products and onSortChange is provided', () => {
    const spec = makeSpec([
      { sku: 'A', name: 'A', price: '100' },
      { sku: 'B', name: 'B', price: '200' },
    ]);
    const ctx = makeContext();
    const dom = renderUISpec(spec, ctx);
    const toolbar = dom.querySelector('.gengage-chat-product-sort-toolbar');
    expect(toolbar).not.toBeNull();
    const buttons = toolbar!.querySelectorAll('.gengage-chat-product-sort-btn');
    expect(buttons).toHaveLength(3);
    expect(buttons[0]!.textContent).toBe('Related');
    expect(buttons[1]!.textContent).toBe('Price \u2191');
    expect(buttons[2]!.textContent).toBe('Price \u2193');
  });

  it('does not render sort toolbar for single product', () => {
    const spec = makeSpec([{ sku: 'A', name: 'A', price: '100' }]);
    const ctx = makeContext();
    const dom = renderUISpec(spec, ctx);
    expect(dom.querySelector('.gengage-chat-product-sort-toolbar')).toBeNull();
  });

  it('does not render sort toolbar when onSortChange is not provided', () => {
    const spec = makeSpec([
      { sku: 'A', name: 'A', price: '100' },
      { sku: 'B', name: 'B', price: '200' },
    ]);
    const ctx = makeContext({ onSortChange: undefined });
    const dom = renderUISpec(spec, ctx);
    expect(dom.querySelector('.gengage-chat-product-sort-toolbar')).toBeNull();
  });

  it('marks related button as active by default', () => {
    const spec = makeSpec([
      { sku: 'A', name: 'A', price: '100' },
      { sku: 'B', name: 'B', price: '200' },
    ]);
    const ctx = makeContext();
    const dom = renderUISpec(spec, ctx);
    const active = dom.querySelector('.gengage-chat-product-sort-btn--active');
    expect(active?.textContent).toBe('Related');
  });

  it('calls onSortChange when sort button is clicked', () => {
    const onSortChange = vi.fn();
    const spec = makeSpec([
      { sku: 'A', name: 'A', price: '100' },
      { sku: 'B', name: 'B', price: '200' },
    ]);
    const ctx = makeContext({ onSortChange });
    const dom = renderUISpec(spec, ctx);
    const buttons = dom.querySelectorAll('.gengage-chat-product-sort-btn');
    (buttons[1] as HTMLElement).click(); // Price ↑
    expect(onSortChange).toHaveBeenCalledWith({ type: 'price', direction: 'asc' });
  });

  it('re-sorts grid children when price asc is clicked', () => {
    const spec = makeSpec([
      { sku: 'Expensive', name: 'Expensive', price: '500' },
      { sku: 'Cheap', name: 'Cheap', price: '50' },
      { sku: 'Mid', name: 'Mid', price: '200' },
    ]);
    const ctx = makeContext();
    const dom = renderUISpec(spec, ctx);

    // Click "Price ↑" button
    const buttons = dom.querySelectorAll('.gengage-chat-product-sort-btn');
    (buttons[1] as HTMLElement).click();

    // Verify grid children are reordered
    const grid = dom.querySelector('.gengage-chat-product-grid');
    const cards = grid!.querySelectorAll('.gengage-chat-product-card');
    const names = Array.from(cards).map((c) => c.querySelector('.gengage-chat-product-card-name')?.textContent);
    expect(names).toEqual(['Cheap', 'Mid', 'Expensive']);
  });

  it('re-sorts grid children when price desc is clicked', () => {
    const spec = makeSpec([
      { sku: 'Cheap', name: 'Cheap', price: '50' },
      { sku: 'Mid', name: 'Mid', price: '200' },
      { sku: 'Expensive', name: 'Expensive', price: '500' },
    ]);
    const ctx = makeContext();
    const dom = renderUISpec(spec, ctx);

    // Click "Price ↓" button
    const buttons = dom.querySelectorAll('.gengage-chat-product-sort-btn');
    (buttons[2] as HTMLElement).click();

    const grid = dom.querySelector('.gengage-chat-product-grid');
    const cards = grid!.querySelectorAll('.gengage-chat-product-card');
    const names = Array.from(cards).map((c) => c.querySelector('.gengage-chat-product-card-name')?.textContent);
    expect(names).toEqual(['Expensive', 'Mid', 'Cheap']);
  });

  it('restores original order when related is clicked after sorting', () => {
    const spec = makeSpec([
      { sku: 'C', name: 'C', price: '300' },
      { sku: 'A', name: 'A', price: '100' },
      { sku: 'B', name: 'B', price: '200' },
    ]);
    const ctx = makeContext();
    const dom = renderUISpec(spec, ctx);

    const buttons = dom.querySelectorAll('.gengage-chat-product-sort-btn');

    // Sort by price asc first
    (buttons[1] as HTMLElement).click();
    // Then back to related
    (buttons[0] as HTMLElement).click();

    const grid = dom.querySelector('.gengage-chat-product-grid');
    const cards = grid!.querySelectorAll('.gengage-chat-product-card');
    const names = Array.from(cards).map((c) => c.querySelector('.gengage-chat-product-card-name')?.textContent);
    expect(names).toEqual(['C', 'A', 'B']);
  });

  it('updates active state on toolbar buttons after click', () => {
    const spec = makeSpec([
      { sku: 'A', name: 'A', price: '100' },
      { sku: 'B', name: 'B', price: '200' },
    ]);
    const ctx = makeContext();
    const dom = renderUISpec(spec, ctx);
    const buttons = dom.querySelectorAll('.gengage-chat-product-sort-btn');

    // Initially "Related" is active
    expect(buttons[0]!.classList.contains('gengage-chat-product-sort-btn--active')).toBe(true);
    expect(buttons[1]!.classList.contains('gengage-chat-product-sort-btn--active')).toBe(false);

    // Click Price ↑
    (buttons[1] as HTMLElement).click();
    expect(buttons[0]!.classList.contains('gengage-chat-product-sort-btn--active')).toBe(false);
    expect(buttons[1]!.classList.contains('gengage-chat-product-sort-btn--active')).toBe(true);
  });
});
