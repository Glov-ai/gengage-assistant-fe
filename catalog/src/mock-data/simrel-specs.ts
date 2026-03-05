/**
 * UISpec fixtures for all SimRel catalog components.
 */

import { PRODUCTS } from './products.js';

const p = PRODUCTS;

function getProduct(index: number): (typeof PRODUCTS)[number] {
  const product = p[index];
  if (!product) {
    throw new Error(`Missing mock product at index ${index}`);
  }
  return product;
}

const p0 = getProduct(0);
const p1 = getProduct(1);
const p2 = getProduct(2);
const p3 = getProduct(3);
const p4 = getProduct(4);

function simrelProduct(product: (typeof PRODUCTS)[number]) {
  return {
    sku: product.sku,
    name: product.name,
    imageUrl: product.imageUrl,
    price: product.price,
    originalPrice: product.originalPrice,
    discountPercent: product.discountPercent,
    url: product.url,
    brand: product.brand,
    rating: product.rating,
    reviewCount: product.reviewCount,
    cartCode: product.cartCode,
    inStock: product.inStock,
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
        c0: { type: 'ProductCard', props: { product: simrelProduct(p0), index: 0 } },
        c1: { type: 'ProductCard', props: { product: simrelProduct(p1), index: 1 } },
        c2: { type: 'ProductCard', props: { product: simrelProduct(p2), index: 2 } },
        c3: { type: 'ProductCard', props: { product: simrelProduct(p3), index: 3 } },
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
            product: simrelProduct(p0),
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
            sku: p0.sku,
            label: 'Sepete Ekle',
            cartCode: p0.cartCode,
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
              { label: 'Karsilastir', action: { title: 'Karsilastir', type: 'compare', payload: { sku: p0.sku } } },
              {
                label: 'Benzer Goster',
                action: { title: 'Benzer Goster', type: 'findSimilar', payload: { sku: p0.sku } },
              },
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
                products: [simrelProduct(p0), simrelProduct(p1), simrelProduct(p2)],
              },
              {
                name: 'Ayni Fiyat Araliginda',
                products: [simrelProduct(p2), simrelProduct(p4)],
              },
              {
                name: 'Ayni Marka',
                products: [simrelProduct(p0)],
              },
            ],
          },
        },
      },
    },
  },
};
