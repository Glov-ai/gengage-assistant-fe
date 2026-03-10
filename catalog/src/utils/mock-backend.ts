/**
 * fetch() interceptor returning canned NDJSON for the full-widget showcase.
 * Patches globalThis.fetch and returns a restore function.
 */

import {
  CHAT_GREETING_STREAM,
  CHAT_SEARCH_STREAM,
  CHAT_SILENT_STREAM,
  CHAT_MORE_PRODUCTS_STREAM,
  QNA_ACTIONS_STREAM,
  ANALYTICS_OK,
} from '../mock-data/ndjson-sequences.js';
import { PRODUCTS } from '../mock-data/products.js';

const originalFetch = globalThis.fetch;

function mockResponse(body: string, contentType = 'application/x-ndjson'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}

let requestCount = 0;

function toV1Product(product: (typeof PRODUCTS)[number]): Record<string, unknown> {
  return {
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    images: [product.imageUrl, ...product.images],
    price: Number(product.originalPrice || product.price),
    price_discounted: Number(product.price),
    url: product.url,
    rating: product.rating,
    review_count: product.reviewCount,
    cart_code: product.cartCode,
    in_stock: product.inStock,
    promotions: product.promotions,
    variants: product.variants,
  };
}

const SIMREL_PRODUCTS_JSON = JSON.stringify({
  results: PRODUCTS.map((product) => toV1Product(product)),
  count: PRODUCTS.length,
  source_sku: 'DRILL-001',
});

const SIMREL_GROUPINGS_JSON = JSON.stringify({
  count: 2,
  product_groupings: [
    {
      name: 'One Cikanlar',
      highlight: 'En populer secimler',
      group_products: PRODUCTS.slice(0, 3).map((product) => toV1Product(product)),
    },
    {
      name: 'Alternatifler',
      highlight: 'Butce ve ihtiyaca gore',
      group_products: PRODUCTS.slice(3).map((product) => toV1Product(product)),
    },
  ],
});

function interceptedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Chat process_action
  if (url.includes('/chat/process_action') || url.includes('/chat/message')) {
    // Parse action type from request body
    let actionType: string | undefined;
    try {
      const parsed = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : {};
      actionType =
        (parsed['actionType'] as string | undefined) ??
        (parsed['action_type'] as string | undefined) ??
        (parsed['type'] as string | undefined);
    } catch {
      /* ignore parse errors */
    }

    // like / addToCart: silent acknowledgment — no panel or chat update
    if (actionType === 'like' || actionType === 'addToCart') {
      return Promise.resolve(mockResponse(CHAT_SILENT_STREAM));
    }
    // moreProduct: append additional products
    if (actionType === 'moreProduct') {
      return Promise.resolve(mockResponse(CHAT_MORE_PRODUCTS_STREAM));
    }

    requestCount++;
    // First request gets greeting, subsequent get search results
    const body = requestCount <= 1 ? CHAT_GREETING_STREAM : CHAT_SEARCH_STREAM;
    return Promise.resolve(mockResponse(body));
  }

  // QNA launcher actions
  if (url.includes('/chat/launcher_action')) {
    return Promise.resolve(mockResponse(QNA_ACTIONS_STREAM));
  }

  // SimRel similar products
  if (url.includes('/chat/similar_products')) {
    return Promise.resolve(mockResponse(SIMREL_PRODUCTS_JSON, 'application/json'));
  }

  // SimRel product groupings
  if (url.includes('/chat/product_groupings')) {
    return Promise.resolve(mockResponse(SIMREL_GROUPINGS_JSON, 'application/json'));
  }

  // Analytics
  if (url.includes('/analytics') || url.includes('/collect') || url.includes('/event')) {
    return Promise.resolve(mockResponse(ANALYTICS_OK, 'application/json'));
  }

  // Fall through to real fetch
  return originalFetch(input, init);
}

export function installMockBackend(): () => void {
  requestCount = 0;
  globalThis.fetch = interceptedFetch as typeof fetch;
  console.log('[catalog] Mock backend installed — fetch() intercepted');
  return () => {
    globalThis.fetch = originalFetch;
    console.log('[catalog] Mock backend removed — fetch() restored');
  };
}
