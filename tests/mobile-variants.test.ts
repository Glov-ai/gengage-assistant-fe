import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpec } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

let originalInnerWidth: number;

beforeEach(() => {
  originalInnerWidth = window.innerWidth;
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    value: originalInnerWidth,
    writable: true,
    configurable: true,
  });
});

function makeContext(): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    i18n: {
      productCtaLabel: 'View',
      aiTopPicksTitle: '',
      roleWinner: '',
      roleBestValue: '',
      roleBestAlternative: '',
      viewDetails: '',
      groundingReviewCta: '',
      variantsLabel: '',
      sortRelated: '',
      sortPriceAsc: '',
      sortPriceDesc: '',
      compareSelected: '',
      panelTitleProductDetails: '',
      panelTitleSimilarProducts: '',
      panelTitleComparisonResults: '',
      panelTitleCategories: '',
      inStockLabel: '',
      outOfStockLabel: '',
      findSimilarLabel: '',
      viewMoreLabel: '',
      similarProductsLabel: '',
    },
  };
}

describe('Mobile variants', () => {
  it('adds --mobile class to ProductGrid on narrow viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });

    const spec: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ProductGrid',
          props: { layout: 'grid' },
          children: ['p1'],
        },
        p1: {
          type: 'ProductCard',
          props: { product: { sku: 'P1', name: 'Test', url: '', price: '100' } },
        },
      },
    };

    const result = renderUISpec(spec, makeContext());
    const grid = result.querySelector('.gengage-chat-product-grid');
    expect(grid!.classList.contains('gengage-chat-product-grid--mobile')).toBe(true);
  });

  it('does not add --mobile class on wide viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });

    const spec: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ProductGrid',
          props: { layout: 'grid' },
          children: ['p1'],
        },
        p1: {
          type: 'ProductCard',
          props: { product: { sku: 'P1', name: 'Test', url: '', price: '100' } },
        },
      },
    };

    const result = renderUISpec(spec, makeContext());
    const grid = result.querySelector('.gengage-chat-product-grid');
    expect(grid!.classList.contains('gengage-chat-product-grid--mobile')).toBe(false);
  });

  it('adds --mobile class to ComparisonTable on narrow viewport', () => {
    Object.defineProperty(window, 'innerWidth', { value: 375, writable: true, configurable: true });

    const spec: UISpec = {
      root: 'root',
      elements: {
        root: {
          type: 'ComparisonTable',
          props: {
            recommended: { sku: 'C1', name: 'Product 1', price: '100' },
            products: [
              { sku: 'C1', name: 'Product 1', price: '100' },
              { sku: 'C2', name: 'Product 2', price: '200' },
            ],
            attributes: [{ label: 'Weight', values: ['1kg', '2kg'] }],
            highlights: [],
          },
        },
      },
    };

    const result = renderUISpec(spec, makeContext());
    const comparison = result.querySelector('.gengage-chat-comparison');
    expect(comparison!.classList.contains('gengage-chat-comparison--mobile')).toBe(true);
  });
});
