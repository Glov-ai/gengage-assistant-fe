/**
 * UISpec fixtures for all SimRel catalog components.
 */

import { PRODUCTS, productAsRecord } from './products.js';

const p = PRODUCTS;

function simrelProduct(product: typeof p[0]) {
  return {
    sku: product!.sku,
    name: product!.name,
    imageUrl: product!.imageUrl,
    price: product!.price,
    originalPrice: product!.originalPrice,
    discountPercent: product!.discountPercent,
    url: product!.url,
    brand: product!.brand,
    rating: product!.rating,
    reviewCount: product!.reviewCount,
    cartCode: product!.cartCode,
    inStock: product!.inStock,
  };
}

export const SIMREL_SPECS: Record<string, { spec: Record<string, unknown>; description: string }> = {
  ProductGrid: {
    description: 'Outer grid container for similar products.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProductGrid',
          props: { layout: 'grid', columns: 4 },
          children: ['c0', 'c1', 'c2', 'c3'],
        },
        c0: { type: 'ProductCard', props: { product: simrelProduct(p[0]), index: 0 } },
        c1: { type: 'ProductCard', props: { product: simrelProduct(p[1]), index: 1 } },
        c2: { type: 'ProductCard', props: { product: simrelProduct(p[2]), index: 2 } },
        c3: { type: 'ProductCard', props: { product: simrelProduct(p[3]), index: 3 } },
      },
    },
  },

  ProductCard: {
    description: 'A single product card with image, title, price, and actions.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'ProductCard',
          props: {
            product: simrelProduct(p[0]),
            index: 0,
            discountType: 'badge',
          },
        },
      },
    },
  },

  AddToCartButton: {
    description: 'Add-to-cart CTA rendered inside or below a product card.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'AddToCartButton',
          props: {
            sku: p[0]!.sku,
            label: 'Sepete Ekle',
            cartCode: p[0]!.cartCode,
          },
        },
      },
    },
  },

  QuickActions: {
    description: 'A row of quick-action buttons below product info.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'QuickActions',
          props: {
            actions: [
              { label: 'Karsilastir', action: { title: 'Karsilastir', type: 'compare', payload: { sku: p[0]!.sku } } },
              { label: 'Benzer Goster', action: { title: 'Benzer Goster', type: 'findSimilar', payload: { sku: p[0]!.sku } } },
            ],
          },
        },
      },
    },
  },

  EmptyState: {
    description: 'Empty state shown when no similar products are available.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'EmptyState',
          props: {
            message: 'Bu urun icin benzer urun bulunamadi.',
          },
        },
      },
    },
  },

  GroupTabs: {
    description: 'Tabbed product groupings with per-group product grids.',
    spec: {
      root: 'root',
      elements: {
        root: {
          type: 'GroupTabs',
          props: {
            groups: [
              {
                name: 'Benzer Urunler',
                highlight: 'Ayni kategoride en populer urunler',
                products: [simrelProduct(p[0]), simrelProduct(p[1]), simrelProduct(p[2])],
              },
              {
                name: 'Ayni Fiyat Araliginda',
                products: [simrelProduct(p[2]), simrelProduct(p[4])],
              },
              {
                name: 'Ayni Marka',
                products: [simrelProduct(p[0])],
              },
            ],
          },
        },
      },
    },
  },
};
