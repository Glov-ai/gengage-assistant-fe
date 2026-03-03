import { describe, it, expect } from 'vitest';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpec } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return { onAction: () => {}, ...overrides };
}

describe('Promotions Badges', () => {
  it('renders promotion badges on product card', () => {
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            sku: 'SKU1',
            name: 'Test Product',
            url: 'https://example.com/p',
            price: '100',
            promotions: ['Free Shipping', 'Flash Sale'],
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    const badges = result.querySelectorAll('.gengage-chat-product-card-promo-badge');
    expect(badges).toHaveLength(2);
    expect(badges[0]!.textContent).toBe('Free Shipping');
    expect(badges[1]!.textContent).toBe('Flash Sale');
  });

  it('does not render promos container when no promotions', () => {
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            sku: 'SKU1',
            name: 'Test Product',
            url: 'https://example.com/p',
            price: '100',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    expect(result.querySelector('.gengage-chat-product-card-promos')).toBeNull();
  });

  it('does not render promos container when promotions is empty array', () => {
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            sku: 'SKU1',
            name: 'Test Product',
            url: 'https://example.com/p',
            price: '100',
            promotions: [],
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    expect(result.querySelector('.gengage-chat-product-card-promos')).toBeNull();
  });

  it('renders promotion badges on product details panel', () => {
    const spec: UISpec = {
      root: 'panel',
      elements: {
        panel: {
          type: 'ProductDetailsPanel',
          props: {
            product: {
              sku: 'SKU1',
              name: 'Detail Product',
              imageUrl: 'https://img/1.jpg',
              promotions: ['Limited Offer'],
            },
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    const badges = result.querySelectorAll('.gengage-chat-product-details-promo-badge');
    expect(badges).toHaveLength(1);
    expect(badges[0]!.textContent).toBe('Limited Offer');
  });

  it('does not render promos on details panel when no promotions', () => {
    const spec: UISpec = {
      root: 'panel',
      elements: {
        panel: {
          type: 'ProductDetailsPanel',
          props: {
            product: {
              sku: 'SKU1',
              name: 'Detail Product',
              imageUrl: 'https://img/1.jpg',
            },
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    expect(result.querySelector('.gengage-chat-product-details-promos')).toBeNull();
  });
});
