/**
 * fetch() interceptor returning canned NDJSON for the full-widget showcase.
 * Patches globalThis.fetch and returns a restore function.
 */

import {
  CHAT_GREETING_STREAM,
  CHAT_SEARCH_STREAM,
  QNA_ACTIONS_STREAM,
  SIMREL_PRODUCTS_STREAM,
  ANALYTICS_OK,
} from '../mock-data/ndjson-sequences.js';

const originalFetch = globalThis.fetch;

function mockResponse(body: string, contentType = 'application/x-ndjson'): Response {
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': contentType },
  });
}

let requestCount = 0;

function interceptedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Chat process_action
  if (url.includes('/chat/process_action') || url.includes('/chat/message')) {
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
    return Promise.resolve(mockResponse(SIMREL_PRODUCTS_STREAM));
  }

  // SimRel product groupings
  if (url.includes('/chat/product_groupings')) {
    return Promise.resolve(mockResponse('{}', 'application/json'));
  }

  // Analytics
  if (url.includes('/analytics') || url.includes('/collect') || url.includes('/event')) {
    return Promise.resolve(mockResponse(ANALYTICS_OK, 'application/json'));
  }

  // Heartbeat
  if (url.includes('/heartbeat')) {
    return Promise.resolve(mockResponse('{}', 'application/json'));
  }

  // Proactive
  if (url.includes('/proactive')) {
    return Promise.resolve(mockResponse('{}', 'application/json'));
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
