import { describe, it, expect, vi } from 'vitest';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import { renderFloatingComparisonButton } from '../src/chat/components/FloatingComparisonButton.js';
import type { UISpec } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

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
    onToggleComparisonSku: vi.fn(),
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

describe('Comparison Selection Mode', () => {
  describe('Comparison toggle button in toolbar', () => {
    it('renders comparison toggle button when onToggleComparisonSku is provided', () => {
      const spec = makeSpec([
        { sku: 'A', name: 'A', price: '100' },
        { sku: 'B', name: 'B', price: '200' },
      ]);
      const ctx = makeContext();
      const dom = renderUISpec(spec, ctx);
      const toggleBtn = dom.querySelector('.gengage-chat-comparison-toggle-btn');
      expect(toggleBtn).not.toBeNull();
      expect(toggleBtn!.textContent).toBe('Compare');
    });

    it('does not render comparison toggle button when onToggleComparisonSku is not provided', () => {
      const spec = makeSpec([
        { sku: 'A', name: 'A', price: '100' },
        { sku: 'B', name: 'B', price: '200' },
      ]);
      const ctx = makeContext({ onToggleComparisonSku: undefined });
      const dom = renderUISpec(spec, ctx);
      const toggleBtn = dom.querySelector('.gengage-chat-comparison-toggle-btn');
      expect(toggleBtn).toBeNull();
    });

    it('adds active class when comparisonSelectMode is true', () => {
      const spec = makeSpec([
        { sku: 'A', name: 'A', price: '100' },
        { sku: 'B', name: 'B', price: '200' },
      ]);
      const ctx = makeContext({ comparisonSelectMode: true });
      const dom = renderUISpec(spec, ctx);
      const toggleBtn = dom.querySelector('.gengage-chat-comparison-toggle-btn');
      expect(toggleBtn!.classList.contains('gengage-chat-comparison-toggle-btn--active')).toBe(true);
    });

    it('calls onToggleComparisonSku with empty string when toggle button is clicked', () => {
      const onToggle = vi.fn();
      const spec = makeSpec([
        { sku: 'A', name: 'A', price: '100' },
        { sku: 'B', name: 'B', price: '200' },
      ]);
      const ctx = makeContext({ onToggleComparisonSku: onToggle });
      const dom = renderUISpec(spec, ctx);
      const toggleBtn = dom.querySelector('.gengage-chat-comparison-toggle-btn') as HTMLElement;
      toggleBtn.click();
      expect(onToggle).toHaveBeenCalledWith('');
    });

    it('renders sort dropdown and compare toggle side by side in toolbar', () => {
      const spec = makeSpec([
        { sku: 'A', name: 'A', price: '100' },
        { sku: 'B', name: 'B', price: '200' },
      ]);
      const ctx = makeContext();
      const dom = renderUISpec(spec, ctx);
      const toolbar = dom.querySelector('.gengage-chat-product-sort-toolbar');
      expect(toolbar?.querySelector('.gengage-chat-product-sort-dropdown')).not.toBeNull();
      expect(toolbar?.querySelector('.gengage-chat-comparison-toggle-btn')).not.toBeNull();
    });
  });

  describe('ProductCard checkbox overlay', () => {
    it('wraps product card with checkbox when comparisonSelectMode is true', () => {
      const spec = makeSpec([{ sku: 'A', name: 'A', price: '100' }]);
      const ctx = makeContext({ comparisonSelectMode: true, comparisonSelectedSkus: [] });
      const dom = renderUISpec(spec, ctx);
      const wrappers = dom.querySelectorAll('.gengage-chat-comparison-select-wrapper');
      expect(wrappers).toHaveLength(1);
      const checkbox = wrappers[0]!.querySelector('.gengage-chat-comparison-checkbox') as HTMLInputElement;
      expect(checkbox).not.toBeNull();
      expect(checkbox.type).toBe('checkbox');
      expect(checkbox.checked).toBe(false);
    });

    it('does not wrap product card with checkbox when comparisonSelectMode is false', () => {
      const spec = makeSpec([{ sku: 'A', name: 'A', price: '100' }]);
      const ctx = makeContext({ comparisonSelectMode: false });
      const dom = renderUISpec(spec, ctx);
      const wrappers = dom.querySelectorAll('.gengage-chat-comparison-select-wrapper');
      expect(wrappers).toHaveLength(0);
    });

    it('checks checkbox when sku is in comparisonSelectedSkus', () => {
      const spec = makeSpec([
        { sku: 'A', name: 'A', price: '100' },
        { sku: 'B', name: 'B', price: '200' },
      ]);
      const ctx = makeContext({
        comparisonSelectMode: true,
        comparisonSelectedSkus: ['A'],
      });
      const dom = renderUISpec(spec, ctx);
      const checkboxes = dom.querySelectorAll('.gengage-chat-comparison-checkbox') as NodeListOf<HTMLInputElement>;
      expect(checkboxes).toHaveLength(2);
      expect(checkboxes[0]!.checked).toBe(true); // sku A is selected
      expect(checkboxes[1]!.checked).toBe(false); // sku B is not selected
    });

    it('calls onToggleComparisonSku with sku when checkbox changes', () => {
      const onToggle = vi.fn();
      const spec = makeSpec([{ sku: 'SKU-1', name: 'Product 1', price: '100' }]);
      const ctx = makeContext({
        comparisonSelectMode: true,
        comparisonSelectedSkus: [],
        onToggleComparisonSku: onToggle,
      });
      const dom = renderUISpec(spec, ctx);
      const checkbox = dom.querySelector('.gengage-chat-comparison-checkbox') as HTMLInputElement;
      checkbox.dispatchEvent(new Event('change'));
      expect(onToggle).toHaveBeenCalledWith('SKU-1');
    });
  });

  describe('FloatingComparisonButton', () => {
    it('renders button with count when 2+ skus selected', () => {
      const ctx = makeContext();
      const btn = renderFloatingComparisonButton(['A', 'B'], ctx);
      expect(btn.className).toBe('gengage-chat-comparison-floating-btn');
      expect(btn.textContent).toBe('Compare (2)');
    });

    it('renders button with i18n label', () => {
      const ctx = makeContext({
        i18n: {
          ...makeContext().i18n!,
          compareSelected: 'Karşılaştır',
        },
      });
      const btn = renderFloatingComparisonButton(['X', 'Y', 'Z'], ctx);
      expect(btn.textContent).toBe('Karşılaştır (3)');
    });

    it('dispatches getComparisonTable action on click', () => {
      const onAction = vi.fn();
      const ctx = makeContext({ onAction });
      const btn = renderFloatingComparisonButton(['SKU-A', 'SKU-B'], ctx);
      btn.click();
      expect(onAction).toHaveBeenCalledWith({
        title: 'Compare',
        type: 'getComparisonTable',
        payload: { sku_list: ['SKU-A', 'SKU-B'] },
      });
    });

    it('does not render floating button in grid when fewer than 2 skus selected', () => {
      const spec = makeSpec([
        { sku: 'A', name: 'A', price: '100' },
        { sku: 'B', name: 'B', price: '200' },
      ]);
      const ctx = makeContext({
        comparisonSelectMode: true,
        comparisonSelectedSkus: ['A'],
      });
      const dom = renderUISpec(spec, ctx);
      const floatingBtn = dom.querySelector('.gengage-chat-comparison-floating-btn');
      expect(floatingBtn).toBeNull();
    });

    it('renders floating button in grid when 2+ skus selected', () => {
      const spec = makeSpec([
        { sku: 'A', name: 'A', price: '100' },
        { sku: 'B', name: 'B', price: '200' },
      ]);
      const ctx = makeContext({
        comparisonSelectMode: true,
        comparisonSelectedSkus: ['A', 'B'],
      });
      const dom = renderUISpec(spec, ctx);
      const floatingBtn = dom.querySelector('.gengage-chat-comparison-floating-btn');
      expect(floatingBtn).not.toBeNull();
      expect(floatingBtn!.textContent).toBe('Compare (2)');
    });
  });
});
