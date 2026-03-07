import { describe, it, expect, vi } from 'vitest';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpec } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return { onAction: () => {}, ...overrides };
}

describe('Find Similar Hover Pill', () => {
  it('renders hover pill on product card image', () => {
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            sku: 'SKU1',
            name: 'Product',
            url: 'https://example.com/p',
            imageUrl: 'https://img/1.jpg',
            price: '100',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    const pill = result.querySelector('.gengage-chat-find-similar-pill');
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toContain('Find Similar');
  });

  it('pill click dispatches findSimilar with sku and image_url', () => {
    const onAction = vi.fn();
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            sku: 'SKU1',
            name: 'Product',
            url: 'https://example.com/p',
            imageUrl: 'https://img/1.jpg',
            price: '100',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext({ onAction }));
    const pill = result.querySelector('.gengage-chat-find-similar-pill') as HTMLButtonElement;
    pill.click();

    expect(onAction).toHaveBeenCalledWith({
      title: expect.any(String),
      type: 'findSimilar',
      payload: { sku: 'SKU1', image_url: 'https://img/1.jpg' },
    });
  });

  it('image is wrapped in positioned container', () => {
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            sku: 'SKU1',
            name: 'Product',
            url: 'https://example.com/p',
            imageUrl: 'https://img/1.jpg',
            price: '100',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    const wrap = result.querySelector('.gengage-chat-product-card-img-wrapper');
    expect(wrap).not.toBeNull();
    expect(wrap!.querySelector('img')).not.toBeNull();
    expect(wrap!.querySelector('.gengage-chat-find-similar-pill')).not.toBeNull();
  });

  it('no pill when no sku', () => {
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            name: 'No SKU Product',
            url: 'https://example.com/p',
            imageUrl: 'https://img/1.jpg',
            price: '100',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    expect(result.querySelector('.gengage-chat-find-similar-pill')).toBeNull();
  });

  it('no pill when no image', () => {
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            sku: 'SKU1',
            name: 'Product',
            url: 'https://example.com/p',
            price: '100',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    // No image wrapper means no pill
    expect(result.querySelector('.gengage-chat-find-similar-pill')).toBeNull();
  });

  it('old text find-similar button is no longer rendered', () => {
    const spec: UISpec = {
      root: 'card',
      elements: {
        card: {
          type: 'ProductCard',
          props: {
            sku: 'SKU1',
            name: 'Product',
            url: 'https://example.com/p',
            imageUrl: 'https://img/1.jpg',
            price: '100',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    expect(result.querySelector('.gengage-chat-product-card-find-similar')).toBeNull();
  });

  it('renders hover pill on product details panel with single image', () => {
    const spec: UISpec = {
      root: 'details',
      elements: {
        details: {
          type: 'ProductDetailsPanel',
          props: {
            sku: 'SKU2',
            name: 'Detail Product',
            url: 'https://example.com/p2',
            imageUrl: 'https://img/2.jpg',
            price: '200',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    const pill = result.querySelector('.gengage-chat-find-similar-pill');
    expect(pill).not.toBeNull();
    expect(pill!.textContent).toContain('Find Similar');

    const wrap = result.querySelector('.gengage-chat-product-details-img-wrap');
    expect(wrap).not.toBeNull();
  });

  it('renders hover pill on product details panel with gallery', () => {
    const spec: UISpec = {
      root: 'details',
      elements: {
        details: {
          type: 'ProductDetailsPanel',
          props: {
            sku: 'SKU3',
            name: 'Gallery Product',
            url: 'https://example.com/p3',
            images: ['https://img/a.jpg', 'https://img/b.jpg'],
            price: '300',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    const pill = result.querySelector('.gengage-chat-find-similar-pill');
    expect(pill).not.toBeNull();

    const wrap = result.querySelector('.gengage-chat-product-details-img-wrap');
    expect(wrap).not.toBeNull();
  });

  it('details pill click dispatches findSimilar with sku and image_url', () => {
    const onAction = vi.fn();
    const spec: UISpec = {
      root: 'details',
      elements: {
        details: {
          type: 'ProductDetailsPanel',
          props: {
            sku: 'SKU2',
            name: 'Detail Product',
            url: 'https://example.com/p2',
            imageUrl: 'https://img/2.jpg',
            price: '200',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext({ onAction }));
    const pill = result.querySelector('.gengage-chat-find-similar-pill') as HTMLButtonElement;
    pill.click();

    expect(onAction).toHaveBeenCalledWith({
      title: expect.any(String),
      type: 'findSimilar',
      payload: { sku: 'SKU2', image_url: 'https://img/2.jpg' },
    });
  });

  it('old details find-similar button is no longer rendered', () => {
    const spec: UISpec = {
      root: 'details',
      elements: {
        details: {
          type: 'ProductDetailsPanel',
          props: {
            sku: 'SKU2',
            name: 'Detail Product',
            url: 'https://example.com/p2',
            imageUrl: 'https://img/2.jpg',
            price: '200',
          },
        },
      },
      widget: 'chat',
    };

    const result = renderUISpec(spec, makeContext());
    expect(result.querySelector('.gengage-chat-product-details-find-similar')).toBeNull();
  });
});
