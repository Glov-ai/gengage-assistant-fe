import { describe, it, expect, vi } from 'vitest';
import type { UISpec } from '../src/common/types.js';
import { renderSimRelUISpec } from '../src/simrel/components/renderUISpec.js';
import type { SimRelUISpecRenderContext } from '../src/simrel/types.js';

function makeContext(overrides: Partial<SimRelUISpecRenderContext> = {}): SimRelUISpecRenderContext {
  return {
    onClick: vi.fn(),
    onAddToCart: vi.fn(),
    i18n: {
      similarProductsAriaLabel: 'Benzer urunler',
      emptyStateMessage: 'Uygun urun bulunamadi',
      addToCartButton: 'Sepete Ekle',
      ctaLabel: 'Incele',
      outOfStockLabel: 'Stokta Yok',
      decreaseLabel: 'Azalt',
      increaseLabel: 'Artir',
      priceSuffix: ' TL',
    },
    ...overrides,
  };
}

describe('renderSimRelUISpec', () => {
  it('renders ProductGrid + ProductCard and dispatches card click', () => {
    const onClick = vi.fn();
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: { type: 'ProductGrid', children: ['p1'] },
        p1: {
          type: 'ProductCard',
          props: {
            product: {
              sku: 'SKU-1',
              name: 'Test Urun',
              url: 'https://example.com/p/1',
              price: '1299',
            },
            index: 0,
          },
        },
      },
    };

    const result = renderSimRelUISpec(spec, makeContext({ onClick }));
    const card = result.querySelector('.gengage-simrel-card') as HTMLElement;
    expect(card).toBeTruthy();
    card.click();
    expect(onClick).toHaveBeenCalledWith(
      expect.objectContaining({
        sku: 'SKU-1',
        name: 'Test Urun',
      }),
    );
  });

  it('routes AddToCart button click to onAddToCart', () => {
    const onAddToCart = vi.fn();
    const spec: UISpec = {
      root: 'root',
      elements: {
        root: { type: 'ProductGrid', children: ['p1'] },
        p1: {
          type: 'ProductCard',
          props: {
            product: {
              sku: 'SKU-2',
              name: 'Sepete Urun',
              url: 'https://example.com/p/2',
              price: '799',
              cartCode: 'CART-2',
            },
            index: 0,
          },
        },
      },
    };

    const result = renderSimRelUISpec(spec, makeContext({ onAddToCart }));
    const stepper = result.querySelector('.gengage-simrel-atc') as HTMLElement;
    expect(stepper).toBeTruthy();
    const submitBtn = stepper.querySelector('.gengage-qty-submit') as HTMLButtonElement;
    expect(submitBtn).toBeTruthy();
    submitBtn.click();
    expect(onAddToCart).toHaveBeenCalledWith({
      sku: 'SKU-2',
      quantity: 1,
      cartCode: 'CART-2',
    });
  });
});
