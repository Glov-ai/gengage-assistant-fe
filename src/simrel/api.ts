import { buildChatEndpointUrl } from '../common/api-paths.js';
import { consumeStream } from '../common/streaming.js';
import {
  adaptV1Event,
  normalizeSimilarProductsResponse,
  normalizeProductGroupingsResponse,
} from '../common/v1-protocol-adapter.js';
import type { NormalizedProduct } from '../common/v1-protocol-adapter.js';
import type { StreamEvent } from '../common/types.js';
import type { ChatTransportConfig } from '../common/api-paths.js';

export interface SimilarProductsRequest {
  account_id: string;
  session_id: string;
  correlation_id: string;
  sku: string;
  domain?: string;
  limit?: number;
  output_language?: string;
}

export interface ProductGroupingsRequest {
  account_id: string;
  session_id: string;
  correlation_id: string;
  skus: string[];
  output_language?: string;
}

export interface ProductGroup {
  name: string;
  highlight?: string;
  products: NormalizedProduct[];
}

function isNDJSONResponse(response: Response): boolean {
  const ct = response.headers.get('Content-Type') ?? '';
  return ct.includes('application/x-ndjson') || ct.includes('text/event-stream');
}

async function collectProductsFromStream(response: Response, signal?: AbortSignal): Promise<NormalizedProduct[]> {
  const products: NormalizedProduct[] = [];
  const opts: import('../common/streaming.js').StreamOptions = {
    onEvent: (event: StreamEvent) => {
      const normalized = adaptV1Event(event as unknown as Record<string, unknown>);
      if (!normalized || normalized.type !== 'ui_spec') return;

      for (const el of Object.values(normalized.spec.elements)) {
        if (el.type === 'ProductCard' && el.props) {
          const product = (el.props['product'] ?? el.props) as Record<string, unknown>;
          if (typeof product['sku'] === 'string' && typeof product['name'] === 'string') {
            products.push(product as unknown as NormalizedProduct);
          }
        }
      }
    },
  };
  if (signal !== undefined) opts.signal = signal;
  await consumeStream(response, opts);
  return products;
}

export async function fetchSimilarProducts(
  request: SimilarProductsRequest,
  transport: ChatTransportConfig,
  signal?: AbortSignal,
): Promise<NormalizedProduct[]> {
  const url = buildChatEndpointUrl('similar_products', transport);

  const fetchInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  };
  if (signal !== undefined) fetchInit.signal = signal;
  const response = await fetch(url, fetchInit);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (isNDJSONResponse(response)) {
    return collectProductsFromStream(response, signal);
  }

  const text = await response.text();
  if (!text) return [];
  try {
    return normalizeSimilarProductsResponse(JSON.parse(text));
  } catch {
    throw new Error(`Invalid JSON from similar_products endpoint`);
  }
}

async function collectGroupingsFromStream(response: Response, signal?: AbortSignal): Promise<ProductGroup[]> {
  const groups: ProductGroup[] = [];
  let currentGroup: ProductGroup | null = null;

  const opts: import('../common/streaming.js').StreamOptions = {
    onEvent: (event: StreamEvent) => {
      const normalized = adaptV1Event(event as unknown as Record<string, unknown>);
      if (!normalized) return;

      if (normalized.type === 'metadata' && normalized.meta) {
        const name = normalized.meta['group_name'];
        if (typeof name === 'string') {
          currentGroup = { name, products: [] };
          const highlight = normalized.meta['highlight'];
          if (typeof highlight === 'string') currentGroup.highlight = highlight;
          groups.push(currentGroup);
        }
      }

      if (normalized.type === 'ui_spec' && currentGroup) {
        for (const el of Object.values(normalized.spec.elements)) {
          if (el.type === 'ProductCard' && el.props) {
            const product = (el.props['product'] ?? el.props) as Record<string, unknown>;
            if (typeof product['sku'] === 'string' && typeof product['name'] === 'string') {
              currentGroup.products.push(product as unknown as NormalizedProduct);
            }
          }
        }
      }
    },
  };
  if (signal !== undefined) opts.signal = signal;
  await consumeStream(response, opts);

  return groups;
}

export async function fetchProductGroupings(
  request: ProductGroupingsRequest,
  transport: ChatTransportConfig,
  signal?: AbortSignal,
): Promise<ProductGroup[]> {
  const url = buildChatEndpointUrl('product_groupings', transport);

  const fetchInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  };
  if (signal !== undefined) fetchInit.signal = signal;
  const response = await fetch(url, fetchInit);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (isNDJSONResponse(response)) {
    return collectGroupingsFromStream(response, signal);
  }

  const text = await response.text();
  if (!text) return [];
  try {
    return normalizeProductGroupingsResponse(JSON.parse(text));
  } catch {
    throw new Error(`Invalid JSON from product_groupings endpoint`);
  }
}
