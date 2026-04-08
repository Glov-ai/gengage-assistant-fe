import { describe, it, expect, vi } from 'vitest';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpec } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return {
    onAction: vi.fn(),
    i18n: {
      viewOnSiteLabel: 'Sitede Gör',
      addToCartButton: 'Sepete Ekle',
      shareButton: 'Paylaş',
      variantsLabel: 'Varyantlar',
      inStockLabel: 'Stokta',
      outOfStockLabel: 'Tükendi',
      galleryPrevAriaLabel: 'Önceki görsel',
      galleryNextAriaLabel: 'Sonraki görsel',
      groundingReviewCta: 'Yorumları Oku',
      customerReviewsTitle: 'Müşteri Yorumları',
      productInfoTab: 'Ürün Bilgileri',
      specificationsTab: 'Teknik Özellikler',
    } as ChatUISpecRenderContext['i18n'],
    ...overrides,
  };
}

function renderProduct(product: Record<string, unknown>, ctx = makeContext()): HTMLElement {
  const spec: UISpec = {
    root: 'root',
    elements: {
      root: {
        type: 'ProductDetailsPanel',
        props: { product },
      },
    },
  };
  return renderUISpec(spec, ctx);
}

describe('ProductDetailsPanel', () => {
  it('makes the rating chip open product reviews through reviewSummary', () => {
    const onAction = vi.fn();
    const dom = renderProduct(
      {
        sku: 'SKU-1',
        name: 'Color Master Lipstick',
        rating: 5,
        reviewCount: 1,
      },
      makeContext({ onAction }),
    );

    const rating = dom.querySelector('.gengage-chat-product-details-rating') as HTMLButtonElement;
    expect(rating.tagName).toBe('BUTTON');

    rating.click();

    expect(onAction).toHaveBeenCalledWith({
      title: 'Müşteri Yorumları',
      type: 'reviewSummary',
      payload: { sku: 'SKU-1' },
    });
  });

  it('renders protocol features as PDP facts and falls back to safe text from description_html', () => {
    const dom = renderProduct({
      sku: 'SKU-2',
      name: 'Puffy Liquid Blush',
      description_html:
        '<h2>Nasıl Kullanılır?</h2><p>Acai ve E vitaminiyle ışıltılı tazelik.</p><p>Krem dokusuyla kolay uygulanır.</p><script>bad()</script>',
      features: [
        { name: 'Renk', value: '003 ROSY GLOW' },
        { name: 'Hacim', value: '12 ML' },
      ],
    });

    const facts = Array.from(dom.querySelectorAll('.gengage-chat-product-details-fact')).map((node) => ({
      key: node.querySelector('dt')?.textContent,
      value: node.querySelector('dd')?.textContent,
    }));
    expect(facts).toContainEqual({ key: 'Renk', value: '003 ROSY GLOW' });
    expect(facts).toContainEqual({ key: 'Hacim', value: '12 ML' });
    expect(dom.querySelector('.gengage-chat-product-detail-tab-panel')?.textContent).toContain(
      'Acai ve E vitaminiyle ışıltılı tazelik.',
    );
    expect(dom.querySelector('.gengage-chat-product-description h2')?.textContent).toBe('Nasıl Kullanılır?');
    const paragraphs = dom.querySelectorAll('.gengage-chat-product-description p');
    expect(paragraphs).toHaveLength(2);
    expect(dom.querySelector('.gengage-chat-product-description')?.textContent).not.toContain('bad()');
  });

  it('renders color/image variants and dispatches launchVariant with the selected sku', () => {
    const onAction = vi.fn();
    const dom = renderProduct(
      {
        sku: 'SKU-RED',
        name: 'Puffy Liquid Blush',
        price: '649.99',
        variants: [
          { name: 'Renk', value: '001 Pink', sku: 'SKU-PINK', color_hex: '#ff7b83', price: 649.99 },
          { name: 'Renk', value: '003 Rosy Glow', sku: 'SKU-RED', image: 'https://example.com/rosy.jpg' },
        ],
      },
      makeContext({ onAction }),
    );

    const heading = dom.querySelector('.gengage-chat-product-variants-label');
    expect(heading?.textContent).toBe('2 Renk');

    const buttons = dom.querySelectorAll('.gengage-chat-product-variant-btn');
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.querySelector('.gengage-chat-product-variant-swatch')).not.toBeNull();
    expect(buttons[1]!.classList.contains('gengage-chat-product-variant-btn--active')).toBe(true);

    (buttons[0] as HTMLButtonElement).click();
    expect(onAction).toHaveBeenCalledWith({
      title: 'Puffy Liquid Blush (001 Pink)',
      type: 'launchVariant',
      payload: { sku: 'SKU-PINK' },
    });
  });

  it('falls back to facet and feature data when the source has no variant list', () => {
    const dom = renderProduct({
      sku: 'SKU-FUCHSIA',
      name: 'Color Master Lipstick',
      facet_hits: {
        Renk: '008FUCHSIA',
      },
      features: [
        { name: 'Boyut', value: '3 G' },
        { name: 'Renk Kodu', value: '008FUCHSIA' },
        { name: 'Menşei', value: 'TR' },
      ],
    });

    const labels = Array.from(dom.querySelectorAll('.gengage-chat-product-variant-label')).map(
      (node) => node.textContent,
    );
    expect(labels).toEqual(['008FUCHSIA', '3 G']);
    expect(dom.querySelector('.gengage-chat-product-variants-label')?.textContent).toBe('Varyantlar');
    expect(dom.querySelectorAll('.gengage-chat-product-variant-btn--active')).toHaveLength(2);
  });
});
