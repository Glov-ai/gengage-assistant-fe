import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyDemoProductToHostShell,
  createBrandAvatarDataUrl,
  hydrateDemoPdpShell,
} from '../demos/shared/demo-shell.ts';

const originalFetch = globalThis.fetch;

function renderShell(): void {
  document.body.innerHTML = `
    <p class="host-breadcrumb">Placeholder / <strong id="breadcrumb-sku">—</strong></p>
    <div class="summary-card">
      <div class="badge-chip">Demo</div>
      <h1 class="summary-title">Lorem Ipsum Demo Ürünü</h1>
      <div class="summary-meta">
        <span>Ürün Kodu: <span id="summary-sku">—</span></span>
        <span>&bull;</span>
        <span>0.0 / 5 (0 değerlendirme)</span>
      </div>
      <div class="price-wrap">
        <div class="price-main">XXX TL</div>
        <div class="price-old">YYY TL</div>
      </div>
      <ul class="feature-list">
        <li>Placeholder</li>
      </ul>
    </div>
    <section class="content-card">
      <p>placeholder body</p>
    </section>
    <div class="gallery-main">Demo Ürün Görseli</div>
    <div class="gallery-thumbs">
      <div class="gallery-thumb"></div>
      <div class="gallery-thumb"></div>
    </div>
  `;
}

describe('demo-shell helpers', () => {
  beforeEach(() => {
    renderShell();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('creates a data-url avatar for brand fallbacks', () => {
    const url = createBrandAvatarDataUrl({ brandName: 'Trendyol', primaryColor: '#f27a1a' });
    expect(url.startsWith('data:image/svg+xml')).toBe(true);
    expect(decodeURIComponent(url)).toContain('Trendyol');
  });

  it('applies locale-aware product details to the host shell', () => {
    applyDemoProductToHostShell(
      {
        sku: '979HF',
        name: 'Site Light',
        brand: 'Screwfix',
        images: ['https://cdn.example.com/light.jpg', 'https://cdn.example.com/light-2.jpg'],
        price: 199.99,
        price_discounted: 149.99,
        price_currency: 'GBP',
        rating: 4.5,
        review_count: 18,
        promotions: ['Free next day delivery'],
        description: 'Compact work light with magnetic base and rechargeable battery.',
        features: [
          { name: 'Battery', value: 'Rechargeable' },
          { name: 'Brightness', value: '700 lm' },
        ],
        category_names: ['Lighting', 'Work Lights'],
      },
      {
        accountId: 'screwfixcom',
        sku: '979HF',
        middlewareUrl: 'http://localhost:7860',
        brandName: 'Screwfix',
        locale: 'en',
        currencyLocale: 'en-GB',
      },
    );

    expect(document.querySelector('.summary-title')?.textContent).toBe('Site Light');
    expect(document.querySelector('.host-breadcrumb')?.textContent).toContain('Home / Lighting / Work Lights / 979HF');
    expect(document.querySelector('.summary-meta')?.textContent).toContain('Product Code: 979HF');
    expect(document.querySelector('.summary-meta')?.textContent).toContain('4.5 / 5 (18 reviews)');
    expect(document.querySelector('.badge-chip')?.textContent).toBe('Free next day delivery');
    expect(document.querySelector('.price-main')?.textContent).toContain('149');
    expect(document.querySelector('.feature-list')?.textContent).toContain('Battery: Rechargeable');
    expect(document.querySelector('.content-card p')?.textContent).toContain('Compact work light');
    expect(document.querySelectorAll('.gallery-thumb img')).toHaveLength(2);
    expect((document.querySelector('.gallery-main img') as HTMLImageElement | null)?.src).toContain('light.jpg');
    expect((document.querySelector('.gallery-main img') as HTMLImageElement | null)?.alt).toBe(
      'Site Light main product image',
    );
  });

  it('hydrates product details from the middleware stream', async () => {
    globalThis.fetch = vi.fn(async () => {
      const streamBody = [
        JSON.stringify({ type: 'loading', payload: { text: 'loading' } }),
        JSON.stringify({
          type: 'productDetails',
          payload: {
            productDetails: {
              sku: '917839672',
              name: 'Trendyol Product',
              brand: 'Trendyol',
              price: 1299.9,
              price_discounted: 999.9,
              price_currency: 'TRY',
              rating: 4.9,
              review_count: 86,
              images: ['https://cdn.example.com/product.jpg'],
              features: [{ name: 'Renk', value: 'Turuncu' }],
              category_names: ['Kadın', 'Elbise'],
            },
          },
        }),
      ].join('\n');
      return new Response(streamBody, { status: 200 });
    }) as typeof globalThis.fetch;

    await hydrateDemoPdpShell({
      accountId: 'trendyolcom',
      sku: '917839672',
      middlewareUrl: 'https://chatbe-dev.gengage.ai',
      brandName: 'Trendyol',
      locale: 'tr',
    });

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(document.querySelector('.summary-title')?.textContent).toBe('Trendyol Product');
    expect(document.querySelector('.summary-meta')?.textContent).toContain('86 değerlendirme');
    expect(document.querySelector('.feature-list')?.textContent).toContain('Renk: Turuncu');
  });
});
