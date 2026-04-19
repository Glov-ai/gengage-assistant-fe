/**
 * Tests for renderUISpec — DOM rendering of json-render UI specs in chat.
 */

import { describe, it, expect, vi } from 'vitest';
import type { UISpec } from '../src/common/types.js';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpecRenderContext } from '../src/chat/components/renderUISpec.js';

function makeContext(overrides: Partial<UISpecRenderContext> = {}): UISpecRenderContext {
  return {
    onAction: vi.fn(),
    onProductClick: vi.fn(),
    ...overrides,
  };
}

describe('renderUISpec', () => {
  describe('ActionButtons', () => {
    it('renders action buttons with click handlers', () => {
      const onAction = vi.fn();
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ActionButtons',
            props: {
              buttons: [
                { label: 'Button A', action: { title: 'A', type: 'typeA', payload: 'a' } },
                { label: 'Button B', action: { title: 'B', type: 'typeB', payload: 'b' } },
              ],
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext({ onAction }));

      const buttons = result.querySelectorAll('.gengage-chat-action-btn');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]!.textContent).toBe('Button A');
      expect(buttons[1]!.textContent).toBe('Button B');

      // Click first button
      (buttons[0] as HTMLElement).click();
      expect(onAction).toHaveBeenCalledWith({ title: 'A', type: 'typeA', payload: 'a' });
    });

    it('renders empty container when buttons is missing', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: { type: 'ActionButtons', props: {} },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const buttons = result.querySelectorAll('.gengage-chat-action-btn');
      expect(buttons).toHaveLength(0);
    });
  });

  describe('ProductCard', () => {
    it('renders product card with image, name, price, and CTA', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'SKU-1',
                name: 'Test Product',
                imageUrl: 'https://example.com/img.jpg',
                price: '99.99',
                originalPrice: '149.99',
                url: 'https://example.com/product',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const card = result.querySelector('.gengage-chat-product-card')!;
      expect(card).toBeTruthy();

      const img = card.querySelector('img') as HTMLImageElement;
      expect(img.src).toContain('example.com/img.jpg');
      expect(img.alt).toBe('Test Product');

      const name = card.querySelector('.gengage-chat-product-card-name')!;
      expect(name.textContent).toBe('Test Product');

      const originalPrice = card.querySelector('.gengage-chat-product-card-original-price')!;
      expect(originalPrice.textContent).toBe('149,99 TL');

      /* URL without cart: inline site CTA (no buy popover). */
      expect(card.classList.contains('gengage-chat-product-card--buy-popover')).toBe(false);
      const cta = card.querySelector('.gengage-chat-product-card-cta') as HTMLAnchorElement;
      expect(cta).toBeTruthy();
      expect(cta.href).toContain('example.com/product');
      expect(cta.target).toBe('_blank');
    });

    it('renders campaign reason and inline prices with separator when discount_reason is set', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'SKU-C',
                name: 'Camp',
                imageUrl: 'https://example.com/i.jpg',
                price: '99.99',
                originalPrice: '149.99',
                discount_reason: "Oliz'e Özel",
                url: 'https://example.com/p',
              },
            },
          },
        },
      };

      const result = renderUISpec(
        spec,
        makeContext({
          productPriceUi: { showCampaignReason: true, originalPriceStyle: 'inline' },
        }),
      );
      const card = result.querySelector('.gengage-chat-product-card')!;
      expect(card.querySelector('.gengage-chat-campaign-reason')?.textContent).toBe("Oliz'e Özel");
      expect(card.querySelector('.gengage-chat-product-card-price-sep')).toBeTruthy();
      expect(card.querySelector('.gengage-chat-product-card-price-block--inline')).toBeTruthy();
    });

    it('hides campaign reason by default even when discount_reason is set', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'SKU-E',
                name: 'No reason UI',
                imageUrl: 'https://example.com/i.jpg',
                price: '99.99',
                originalPrice: '149.99',
                discount_reason: 'Gizli kampanya',
                url: 'https://example.com/p',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const card = result.querySelector('.gengage-chat-product-card')!;
      expect(card.querySelector('.gengage-chat-campaign-reason')).toBeNull();
    });

    it('defaults to strikethrough list price without inline layout', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'SKU-D',
                name: 'Strike',
                imageUrl: 'https://example.com/i.jpg',
                price: '99.99',
                originalPrice: '149.99',
                url: 'https://example.com/p',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const card = result.querySelector('.gengage-chat-product-card')!;
      expect(card.querySelector('.gengage-chat-product-card-price-block--inline')).toBeNull();
      expect(card.querySelector('.gengage-chat-product-card-price-sep')).toBeNull();
    });

    it('renders product card with flat props (direct props instead of nested product)', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              sku: 'SKU-2',
              name: 'Direct Props Product',
              price: '50.00',
              url: 'https://example.com/p2',
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const name = result.querySelector('.gengage-chat-product-card-name')!;
      expect(name.textContent).toBe('Direct Props Product');
    });

    it('dispatches launchSingleProduct action when product card action is provided', () => {
      const onAction = vi.fn();
      const onProductSelect = vi.fn();
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'SKU-3',
                name: 'Action Product',
                price: '50.00',
              },
              action: {
                title: 'Action Product',
                type: 'launchSingleProduct',
                payload: { sku: 'SKU-3' },
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext({ onAction, onProductSelect }));
      const card = result.querySelector('.gengage-chat-product-card') as HTMLElement;
      card.click();

      expect(onAction).toHaveBeenCalledWith({
        title: 'Action Product',
        type: 'launchSingleProduct',
        payload: { sku: 'SKU-3' },
      });
      expect(onProductSelect).not.toHaveBeenCalled();
    });

    it('uses i18n productCtaLabel instead of action.title for launchSingleProduct CTA', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'SKU-CTA',
                name: 'CTA Label Product',
                price: '99.00',
              },
              action: {
                title: 'CTA Label Product',
                type: 'launchSingleProduct',
                payload: { sku: 'SKU-CTA' },
              },
            },
          },
        },
      };

      const result = renderUISpec(
        spec,
        makeContext({ i18n: { productCtaLabel: 'Ürünü İncele' } as UISpecRenderContext['i18n'] }),
      );
      const cta = result.querySelector('.gengage-chat-product-card-cta') as HTMLButtonElement;
      expect(cta.textContent).toBe('Ürünü İncele');
    });
  });

  describe('Divider', () => {
    it('renders a plain divider without label', () => {
      const spec: UISpec = {
        root: 'root',
        elements: { root: { type: 'Divider' } },
      };

      const result = renderUISpec(spec, makeContext());
      expect(result.querySelector('hr')).toBeTruthy();
    });

    it('renders divider with label', () => {
      const spec: UISpec = {
        root: 'root',
        elements: { root: { type: 'Divider', props: { label: 'New conversation' } } },
      };

      const result = renderUISpec(spec, makeContext());
      const label = result.querySelector('.gengage-chat-divider-label')!;
      expect(label.textContent).toBe('New conversation');
    });
  });

  describe('XSS safety', () => {
    it('does not render javascript: URLs in product cards', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'evil',
                name: '<script>alert("xss")</script>',
                imageUrl: 'javascript:alert(1)',
                url: 'javascript:alert(2)',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const card = result.querySelector('.gengage-chat-product-card')!;

      // Name should be textContent (not innerHTML), so script tag rendered as text
      const name = card.querySelector('.gengage-chat-product-card-name')!;
      expect(name.textContent).toBe('<script>alert("xss")</script>');

      // No img rendered (javascript: URL blocked)
      const img = card.querySelector('img');
      expect(img).toBeNull();

      // No CTA rendered (javascript: URL blocked)
      const cta = card.querySelector('.gengage-chat-product-card-cta');
      expect(cta).toBeNull();
    });
  });

  describe('unknown type fallback', () => {
    it('renders children of unknown types recursively', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'FutureComponent',
            children: ['child-1'],
          },
          'child-1': {
            type: 'Divider',
            props: { label: 'fallback' },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const label = result.querySelector('.gengage-chat-divider-label')!;
      expect(label.textContent).toBe('fallback');
    });

    it('returns container for unknown type with no children', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: { type: 'CompletelyUnknown' },
        },
      };

      const result = renderUISpec(spec, makeContext());
      expect(result.className).toBe('gengage-chat-uispec');
      expect(result.children).toHaveLength(0);
    });
  });

  describe('ProductGrid', () => {
    it('renders a grid of product cards', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductGrid',
            props: { layout: 'grid' },
            children: ['p1', 'p2'],
          },
          p1: {
            type: 'ProductCard',
            props: {
              product: { sku: 'A', name: 'Product A', url: '/a' },
            },
          },
          p2: {
            type: 'ProductCard',
            props: {
              product: { sku: 'B', name: 'Product B', url: '/b' },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const grid = result.querySelector('.gengage-chat-product-grid')!;
      expect(grid).toBeTruthy();
      expect(grid.querySelectorAll('.gengage-chat-product-card')).toHaveLength(2);
    });

    it('renders a single consulting recommendation group without the generic mobile grid class', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductGrid',
            props: {
              source: 'beauty_consulting',
              styleVariations: [
                {
                  style_label: 'Daily',
                  product_list: [
                    { sku: 'A', name: 'Product A', url: '/a' },
                    { sku: 'B', name: 'Product B', url: '/b' },
                  ],
                  recommendation_groups: [{ label: 'Core Picks', reason: 'Works well together', skus: ['A', 'B'] }],
                },
              ],
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const groupGrid = result.querySelector('.gengage-chat-consulting-group-grid')!;

      expect(result.querySelectorAll('.gengage-chat-consulting-group')).toHaveLength(1);
      expect(groupGrid.classList.contains('gengage-chat-product-grid--mobile')).toBe(false);
      expect(groupGrid.classList.contains('gengage-chat-consulting-group-grid--single-group')).toBe(true);
      expect(result.querySelector('.gengage-chat-consulting-group-label')?.textContent).toBe('Core Picks (2)');
    });

    it('counts leftover consulting products as their own section before applying single-group layout', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductGrid',
            props: {
              source: 'beauty_consulting',
              styleVariations: [
                {
                  style_label: 'Daily',
                  product_list: [
                    { sku: 'A', name: 'Product A', url: '/a' },
                    { sku: 'B', name: 'Product B', url: '/b' },
                  ],
                  recommendation_groups: [{ label: 'Core Picks', skus: ['A'] }],
                },
              ],
            },
          },
        },
      };

      const result = renderUISpec(
        spec,
        makeContext({
          i18n: {
            consultingOtherCompatibleProductsLabel: 'More matches',
          } as UISpecRenderContext['i18n'],
        }),
      );
      const groupGrids = result.querySelectorAll('.gengage-chat-consulting-group-grid');
      const labels = Array.from(result.querySelectorAll('.gengage-chat-consulting-group-label')).map(
        (label) => label.textContent,
      );

      expect(result.querySelectorAll('.gengage-chat-consulting-group')).toHaveLength(2);
      expect(labels).toEqual(['Core Picks (1)', 'More matches (1)']);
      expect(Array.from(groupGrids).some((grid) => grid.classList.contains('gengage-chat-product-grid--mobile'))).toBe(
        false,
      );
      expect(
        Array.from(groupGrids).some((grid) =>
          grid.classList.contains('gengage-chat-consulting-group-grid--single-group'),
        ),
      ).toBe(false);
    });

    it('ignores recommendation groups for watch expert consulting grids', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductGrid',
            props: {
              source: 'watch_expert',
              styleVariations: [
                {
                  style_label: 'Classic',
                  product_list: [
                    { sku: 'A', name: 'Product A', url: '/a' },
                    { sku: 'B', name: 'Product B', url: '/b' },
                  ],
                  recommendation_groups: [{ label: 'Should not render', skus: ['A'] }],
                },
              ],
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());

      expect(result.querySelector('.gengage-chat-consulting-group')).toBeNull();
      expect(result.querySelectorAll('.gengage-chat-product-card')).toHaveLength(2);
      expect(result.textContent).not.toContain('Should not render');
    });

    it('renders consulting loading states even before products arrive', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductGrid',
            props: {
              source: 'beauty_consulting',
              styleVariations: [
                {
                  style_label: 'Glow',
                  status: 'loading',
                  product_list: [],
                  recommendation_groups: [],
                },
              ],
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());

      expect(result.querySelector('.gengage-chat-consulting-loading-panel-title')?.textContent).toBe('Glow');
      expect(result.querySelectorAll('.gengage-chat-consulting-loading-card')).toHaveLength(3);
      expect(result.textContent).toContain('Bu stil için ürünleri toplamaya devam ediyorum.');
    });

    it('renders consulting unavailable states when a variation has no matched products', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductGrid',
            props: {
              source: 'beauty_consulting',
              styleVariations: [
                {
                  style_label: 'Bold',
                  status: 'unavailable',
                  product_list: [],
                  recommendation_groups: [],
                },
              ],
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());

      expect(result.querySelector('.gengage-chat-consulting-loading-panel-title')?.textContent).toBe('Bold');
      expect(result.querySelectorAll('.gengage-chat-consulting-loading-card')).toHaveLength(0);
      expect(result.textContent).toContain('Bu stil için şu anda yeterli ürün eşleşmesi çıkaramadım.');
    });
  });

  describe('Image Gallery', () => {
    it('renders thumbnail strip when multiple images are present', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductDetailsPanel',
            props: {
              product: {
                sku: 'G1',
                name: 'Gallery Product',
                imageUrl: 'https://example.com/img1.jpg',
                images: [
                  'https://example.com/img1.jpg',
                  'https://example.com/img2.jpg',
                  'https://example.com/img3.jpg',
                ],
                url: '/product/g1',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const gallery = result.querySelector('.gengage-chat-product-details-gallery');
      expect(gallery).toBeTruthy();

      const thumbs = result.querySelectorAll('.gengage-chat-product-gallery-thumb');
      expect(thumbs).toHaveLength(3);

      // First thumb should be active by default
      expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);
      expect(thumbs[1]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(false);
    });

    it('changes main image and active thumb on thumbnail click', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductDetailsPanel',
            props: {
              product: {
                sku: 'G2',
                name: 'Click Product',
                imageUrl: 'https://example.com/a.jpg',
                images: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
                url: '/product/g2',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const mainImg = result.querySelector('.gengage-chat-product-details-img') as HTMLImageElement;
      expect(mainImg.src).toContain('example.com/a.jpg');

      const thumbs = result.querySelectorAll('.gengage-chat-product-gallery-thumb');
      // Click the second thumbnail
      (thumbs[1] as HTMLElement).click();

      expect(mainImg.src).toContain('example.com/b.jpg');
      expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(false);
      expect(thumbs[1]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);
    });

    it('falls back to single image when only one image is present', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductDetailsPanel',
            props: {
              product: {
                sku: 'S1',
                name: 'Single Image Product',
                imageUrl: 'https://example.com/only.jpg',
                url: '/product/s1',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const gallery = result.querySelector('.gengage-chat-product-details-gallery');
      expect(gallery).toBeNull();

      const media = result.querySelector('.gengage-chat-product-details-media');
      expect(media).toBeTruthy();

      const img = media!.querySelector('.gengage-chat-product-details-img') as HTMLImageElement;
      expect(img.src).toContain('example.com/only.jpg');
    });
  });

  describe('Variant Selector', () => {
    it('renders variant buttons when variants are present', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductDetailsPanel',
            props: {
              product: {
                sku: 'V1',
                name: 'Variant Product',
                price: '100',
                url: '/product/v1',
                variants: [
                  { name: 'Red', sku: 'V1-RED', price: 100 },
                  { name: 'Blue', sku: 'V1-BLUE', price: 120 },
                ],
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const variantSection = result.querySelector('.gengage-chat-product-variants');
      expect(variantSection).toBeTruthy();

      const label = variantSection!.querySelector('.gengage-chat-product-variants-label');
      expect(label!.textContent).toBe('Variants');

      const buttons = variantSection!.querySelectorAll('.gengage-chat-product-variant-btn');
      expect(buttons).toHaveLength(2);
      expect(buttons[0]!.textContent).toBe('Red');
      // Blue has different price (120 vs 100), should show price suffix
      expect(buttons[1]!.textContent).toContain('Blue');
      expect(buttons[1]!.textContent).toContain('120');
    });

    it('dispatches launchSingleProduct action on variant button click', () => {
      const onAction = vi.fn();
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductDetailsPanel',
            props: {
              product: {
                sku: 'V2',
                name: 'Action Variant',
                url: '/product/v2',
                variants: [{ name: 'Small', sku: 'V2-SM' }],
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext({ onAction }));
      const btn = result.querySelector('.gengage-chat-product-variant-btn') as HTMLButtonElement;
      expect(btn).toBeTruthy();
      btn.click();

      expect(onAction).toHaveBeenCalledWith({
        title: 'Action Variant (Small)',
        type: 'launchVariant',
        payload: { sku: 'V2-SM' },
      });
    });

    it('prefers value field over name for variant button labels (GAP-029)', () => {
      const onAction = vi.fn();
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductDetailsPanel',
            props: {
              product: {
                sku: 'V-VAL',
                name: 'Variant Value Product',
                price: '100',
                url: '/product/v-val',
                variants: [
                  { name: 'color', value: 'Red', sku: 'SKU-RED', price: 100 },
                  { name: 'size', value: 'XL', sku: 'SKU-XL', price: 120 },
                ],
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext({ onAction }));
      const buttons = result.querySelectorAll('.gengage-chat-product-variant-btn');
      expect(buttons).toHaveLength(2);

      // Should show "Red" (value), not "color" (name)
      expect(buttons[0]!.textContent).toBe('Red');
      expect(buttons[0]!.textContent).not.toBe('color');

      // Should show "XL" (value), not "size" (name)
      expect(buttons[1]!.textContent).toContain('XL');
      expect(buttons[1]!.textContent).not.toContain('size');

      // Action title should also use value
      (buttons[0] as HTMLElement).click();
      expect(onAction).toHaveBeenCalledWith({
        title: 'Variant Value Product (Red)',
        type: 'launchVariant',
        payload: { sku: 'SKU-RED' },
      });
    });

    it('falls back to name when value is absent', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductDetailsPanel',
            props: {
              product: {
                sku: 'V-FB',
                name: 'Fallback Product',
                price: '50',
                url: '/product/v-fb',
                variants: [{ name: 'Large', sku: 'V-FB-L', price: 50 }],
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const btn = result.querySelector('.gengage-chat-product-variant-btn');
      expect(btn!.textContent).toBe('Large');
    });

    it('uses custom variantsLabel from i18n', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductDetailsPanel',
            props: {
              product: {
                sku: 'V3',
                name: 'i18n Variant',
                url: '/product/v3',
                variants: [{ name: 'Option A', sku: 'V3-A' }],
              },
            },
          },
        },
      };

      const result = renderUISpec(
        spec,
        makeContext({
          i18n: {
            productCtaLabel: 'View',
            variantsLabel: 'Variants',
          } as UISpecRenderContext['i18n'],
        }),
      );
      const label = result.querySelector('.gengage-chat-product-variants-label');
      expect(label!.textContent).toBe('Variants');
    });
  });

  describe('Product Card Enrichment', () => {
    it('renders discount badge when discountPercent is present', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'D1',
                name: 'Discounted Product',
                imageUrl: 'https://example.com/img.jpg',
                price: '100',
                originalPrice: '150',
                discountPercent: 33,
                url: '/product/d1',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const badge = result.querySelector('.gengage-chat-product-card-discount-badge');
      expect(badge).not.toBeNull();
      expect(badge!.textContent).toBe('%33');
    });

    it('does not render discount badge when discountPercent is absent', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'D2',
                name: 'No Discount',
                imageUrl: 'https://example.com/img.jpg',
                price: '100',
                url: '/product/d2',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const badge = result.querySelector('.gengage-chat-product-card-discount-badge');
      expect(badge).toBeNull();
    });

    it('renders stock indicator for in-stock product', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'S1',
                name: 'In Stock Product',
                price: '100',
                inStock: true,
                url: '/product/s1',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const stock = result.querySelector('.gengage-chat-product-card-stock');
      expect(stock).not.toBeNull();
      expect(stock!.classList.contains('is-in-stock')).toBe(true);
      expect(stock!.textContent).toBe('In Stock');
    });

    it('renders stock indicator for out-of-stock product', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'S2',
                name: 'Out of Stock',
                price: '100',
                inStock: false,
                url: '/product/s2',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext());
      const stock = result.querySelector('.gengage-chat-product-card-stock');
      expect(stock).not.toBeNull();
      expect(stock!.classList.contains('is-out-of-stock')).toBe(true);
      expect(stock!.textContent).toBe('Out of Stock');
    });

    it('renders find similar hover pill on product image', () => {
      const onAction = vi.fn();
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'FS1',
                name: 'Find Similar Test',
                price: '100',
                url: '/product/fs1',
                imageUrl: 'https://img/fs1.jpg',
              },
            },
          },
        },
      };

      const result = renderUISpec(spec, makeContext({ onAction }));
      const pill = result.querySelector('.gengage-chat-find-similar-pill') as HTMLButtonElement;
      expect(pill).not.toBeNull();
      expect(pill.textContent).toBe('Find Similar');
      pill.click();
      expect(onAction).toHaveBeenCalledWith({
        title: 'Find Similar',
        type: 'findSimilar',
        payload: { sku: 'FS1', image_url: 'https://img/fs1.jpg' },
      });
    });

    it('uses i18n for stock and find similar labels', () => {
      const spec: UISpec = {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: {
              product: {
                sku: 'I1',
                name: 'i18n Test',
                price: '100',
                inStock: true,
                url: '/product/i1',
                imageUrl: 'https://img/i1.jpg',
              },
            },
          },
        },
      };

      const result = renderUISpec(
        spec,
        makeContext({
          i18n: {
            productCtaLabel: 'View',
            inStockLabel: 'In Stock',
            outOfStockLabel: 'Out of Stock',
            findSimilarLabel: 'Find Similar',
            viewMoreLabel: 'Show More',
            similarProductsLabel: 'Similar Products',
          } as UISpecRenderContext['i18n'],
        }),
      );

      const stock = result.querySelector('.gengage-chat-product-card-stock');
      expect(stock!.textContent).toBe('In Stock');

      const findSimilar = result.querySelector('.gengage-chat-find-similar-pill');
      expect(findSimilar!.textContent).toBe('Find Similar');
    });
  });

  describe('empty/missing root', () => {
    it('returns empty container for missing root element', () => {
      const spec: UISpec = {
        root: 'missing',
        elements: {},
      };

      const result = renderUISpec(spec, makeContext());
      expect(result.className).toBe('gengage-chat-uispec');
      expect(result.children).toHaveLength(0);
    });
  });
});
