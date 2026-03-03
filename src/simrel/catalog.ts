/**
 * Similar Products (SimRel) widget — json-render catalog definition.
 *
 * Backend endpoints:
 *   POST /chat/similar_products    — primary product list
 *   POST /chat/product_groupings   — grouped/tabbed view
 *
 * The backend streams NDJSON events. `ui_spec` events reference
 * component names defined below. Implementations live in ./registry.
 */

import { z } from 'zod';

const SimilarProductSchema = z.object({
  sku: z.string(),
  name: z.string(),
  imageUrl: z.string().url().optional(),
  price: z.string().optional(),
  originalPrice: z.string().optional(),
  discountPercent: z.number().optional(),
  url: z.string().url(),
  brand: z.string().optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
});

export const ProductGridSchema = z.object({
  layout: z.enum(['grid', 'carousel']).optional(),
  columns: z.number().int().positive().optional(),
});

export const ProductCardSchema = z.object({
  product: SimilarProductSchema,
  index: z.number().int().nonnegative(),
  discountType: z.enum(['strike-through', 'badge']).optional(),
});

export const AddToCartButtonSchema = z.object({
  sku: z.string(),
  label: z.string().optional(),
  cartCode: z.string(),
});

export const QuickActionsSchema = z.object({
  actions: z.array(
    z.object({
      label: z.string(),
      action: z.object({
        title: z.string(),
        type: z.string(),
        payload: z.unknown().optional(),
      }),
    }),
  ),
});

export const EmptyStateSchema = z.object({
  message: z.string().optional(),
});

export const simRelCatalog = {
  components: {
    ProductGrid: {
      schema: ProductGridSchema,
      description: 'Outer grid or carousel container for similar products.',
    },
    ProductCard: {
      schema: ProductCardSchema,
      description: 'A single product card with image, title, price, and actions.',
    },
    AddToCartButton: {
      schema: AddToCartButtonSchema,
      description: 'Add-to-cart CTA rendered inside or below a product card.',
    },
    QuickActions: {
      schema: QuickActionsSchema,
      description: 'A row of quick-action buttons below product info.',
    },
    EmptyState: {
      schema: EmptyStateSchema,
      description: 'Empty state shown when no similar products are available.',
    },
  },
} as const;

export type SimRelCatalog = typeof simRelCatalog;
export type SimRelComponentName = keyof SimRelCatalog['components'];
