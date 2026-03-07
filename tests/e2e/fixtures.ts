/**
 * Shared mock data and route setup helpers for E2E tests.
 *
 * All backend endpoints are intercepted via page.route() so tests
 * run without a live backend.
 */

import type { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Mock response payloads
// ---------------------------------------------------------------------------

export const MOCK_SIMILAR_PRODUCTS = {
  results: [
    {
      sku: 'TEST-001',
      name: 'Stanley Matkap 750W',
      brand: 'Stanley',
      price: 1499,
      price_discounted: 1199,
      url: 'https://example.com/p/test-001',
      images: ['https://via.placeholder.com/200x200/ec6e00/fff?text=P1'],
      rating: 4.5,
      review_count: 120,
      in_stock: true,
      cart_code: 'CART-001',
    },
    {
      sku: 'TEST-002',
      name: 'Bosch Matkap 850W',
      brand: 'Bosch',
      price: 1899,
      url: 'https://example.com/p/test-002',
      images: ['https://via.placeholder.com/200x200/3b82f6/fff?text=P2'],
      rating: 4.2,
      review_count: 85,
      in_stock: true,
      cart_code: 'CART-002',
    },
    {
      sku: 'TEST-003',
      name: 'DeWalt Matkap 1000W',
      brand: 'DeWalt',
      price: 2499,
      price_discounted: 1999,
      url: 'https://example.com/p/test-003',
      images: ['https://via.placeholder.com/200x200/16a34a/fff?text=P3'],
      rating: 4.8,
      review_count: 200,
      in_stock: true,
      cart_code: 'CART-003',
    },
    {
      sku: 'TEST-004',
      name: 'Makita Matkap 600W',
      brand: 'Makita',
      price: 999,
      url: 'https://example.com/p/test-004',
      images: ['https://via.placeholder.com/200x200/ef4444/fff?text=P4'],
      rating: 3.9,
      review_count: 45,
      in_stock: false,
    },
  ],
  count: 4,
  source_sku: '1000465056',
};

export const MOCK_PRODUCT_GROUPINGS = {
  product_groupings: [
    {
      name: 'Profesyonel',
      highlight: 'Yuksek performans',
      group_products: [MOCK_SIMILAR_PRODUCTS.results[0], MOCK_SIMILAR_PRODUCTS.results[2]],
    },
    {
      name: 'Ekonomik',
      highlight: 'Uygun fiyat',
      group_products: [MOCK_SIMILAR_PRODUCTS.results[1], MOCK_SIMILAR_PRODUCTS.results[3]],
    },
  ],
  count: 2,
};

export const MOCK_QNA_NDJSON = [
  '{"type":"suggestedActions","payload":{"actions":[{"title":"Renk secenekleri","icon":"paint","requestDetails":{"type":"user_text","payload":{"text":"Bu urunun renk secenekleri neler?"}}},{"title":"Teknik ozellikler","icon":"list","requestDetails":{"type":"user_text","payload":{"text":"Teknik ozelliklerini goster"}}},{"title":"Kargo bilgisi","icon":"truck","requestDetails":{"type":"user_text","payload":{"text":"Kargo suresi ne kadar?"}}}]}}',
  '{"type":"chatStreamEnd","payload":{}}',
].join('\n');

export const MOCK_CHAT_NDJSON = [
  '{"type":"outputText","payload":{"text":"<p>Merhaba! Size nasil yardimci olabilirim?</p>"}}',
  '{"type":"chatStreamEnd","payload":{}}',
].join('\n');

/** Chat NDJSON that sends a productList (triggers sort toolbar in panel) */
export const MOCK_CHAT_PRODUCT_LIST_NDJSON = [
  '{"type":"outputText","payload":{"text":"<p>İşte size uygun ürünler:</p>"}}',
  `{"type":"productList","payload":{"product_list":[{"sku":"TEST-001","name":"Stanley Matkap 750W","brand":"Stanley","price":1499,"price_discounted":1199,"url":"https://example.com/p/test-001","images":["https://via.placeholder.com/200x200/ec6e00/fff?text=P1"],"rating":4.5,"review_count":120,"in_stock":true,"cart_code":"CART-001"},{"sku":"TEST-002","name":"Bosch Matkap 850W","brand":"Bosch","price":1899,"url":"https://example.com/p/test-002","images":["https://via.placeholder.com/200x200/3b82f6/fff?text=P2"],"rating":4.2,"review_count":85,"in_stock":true,"cart_code":"CART-002"},{"sku":"TEST-003","name":"DeWalt Matkap 1000W","brand":"DeWalt","price":2499,"price_discounted":1999,"url":"https://example.com/p/test-003","images":["https://via.placeholder.com/200x200/16a34a/fff?text=P3"],"rating":4.8,"review_count":200,"in_stock":true,"cart_code":"CART-003"}]}}`,
  '{"type":"chatStreamEnd","payload":{}}',
].join('\n');

/** Chat NDJSON that sends a productDetails (triggers detail panel with share button) */
export const MOCK_CHAT_PRODUCT_DETAILS_NDJSON = [
  '{"type":"productDetails","payload":{"productDetails":{"sku":"TEST-001","name":"Stanley Matkap 750W","brand":"Stanley","price":1499,"price_discounted":1199,"url":"https://example.com/p/test-001","images":["https://via.placeholder.com/200x200/ec6e00/fff?text=P1","https://via.placeholder.com/200x200/ec6e00/fff?text=P1b"],"rating":4.5,"review_count":120,"in_stock":true,"cart_code":"CART-001","description":"Profesyonel kullanim icin ideal matkap."}}}',
  '{"type":"chatStreamEnd","payload":{}}',
].join('\n');

// ---------------------------------------------------------------------------
// Demo page URL
// ---------------------------------------------------------------------------

export const DEMO_URL = '/demos/koctascomtr/index.html?sku=1000465056';

/**
 * Navigate to the demo page and wait for JS modules to finish executing.
 * The Koçtaş demo renders `—` as the SKU placeholder in HTML, then JS
 * replaces it with the real SKU. Waiting for that swap signals readiness.
 */
export async function gotoDemoReady(page: Page, url?: string): Promise<void> {
  const target = url ?? DEMO_URL;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt === 0) {
      await page.goto(target, { waitUntil: 'domcontentloaded' });
    } else {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }

    try {
      await page.locator('#dev-sku').filter({ hasNotText: '—' }).waitFor({ state: 'visible', timeout: 10_000 });
      await page.locator('#dev-session').filter({ hasNotText: '—' }).waitFor({ state: 'visible', timeout: 10_000 });
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1_000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Demo shell never became ready');
}

// ---------------------------------------------------------------------------
// Route setup
// ---------------------------------------------------------------------------

/**
 * Set up all backend route mocks. Call BEFORE page.goto().
 * Optionally override the process_action response body for chat tests.
 */
export async function setupMockRoutes(page: Page, options?: { processActionBody?: string }): Promise<void> {
  // SimRel: similar_products
  await page.route('**/chat/similar_products', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_SIMILAR_PRODUCTS),
    });
  });

  // SimRel: product_groupings
  await page.route('**/chat/product_groupings', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(MOCK_PRODUCT_GROUPINGS),
    });
  });

  // QNA: launcher_action
  await page.route('**/chat/launcher_action', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: MOCK_QNA_NDJSON,
    });
  });

  // Chat: process_action
  await page.route('**/chat/process_action', (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/x-ndjson',
      body: options?.processActionBody ?? MOCK_CHAT_NDJSON,
    });
  });

  // Analytics: swallow backend analytics calls.
  // Use a URL-matching function to avoid intercepting Vite module scripts
  // that contain "analytics" in their path (e.g., /src/common/analytics.ts).
  await page.route(
    (url) => {
      const path = url.pathname;
      // Only intercept requests to the backend analytics endpoint
      return path === '/analytics' || path.endsWith('/analytics');
    },
    (route) => {
      return route.fulfill({ status: 200, body: '{}' });
    },
  );

  // GA/GTM: swallow data collection calls
  await page.route('**/collect?**', (route) => {
    return route.fulfill({ status: 200, body: '' });
  });
}
