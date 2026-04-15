import { PRODUCTS } from './products.js';

const defaultProduct = PRODUCTS[0];

if (!defaultProduct) {
  throw new Error('Missing default product fixture for SimBut catalog previews.');
}

export const SIMBUT_SPECS = {
  FindSimilarPill: {
    description: 'PDP image overlay pill that forwards the current SKU and image into a findSimilar action.',
    product: defaultProduct,
    config: {
      sku: defaultProduct.sku,
      imageUrl: defaultProduct.imageUrl,
      locale: 'tr',
      label: 'Benzerlerini Bul',
    },
  },
} as const;