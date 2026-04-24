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
    sessionStorage.clear();
    delete window.__gengageSessionId;
    delete window.gengage;
    renderShell();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    sessionStorage.clear();
    delete window.__gengageSessionId;
    delete window.gengage;
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

  it('clears placeholder copy when product details are sparse', () => {
    applyDemoProductToHostShell(
      {
        sku: 'SPARSE-1',
        name: 'Sparse Demo Product',
      },
      {
        accountId: 'trendyolcom',
        sku: 'SPARSE-1',
        middlewareUrl: 'http://localhost:7860',
        brandName: 'Trendyol',
      },
    );

    expect(document.querySelector('.summary-title')?.textContent).toBe('Sparse Demo Product');
    expect(document.querySelector('.feature-list')?.textContent).not.toContain('Placeholder');
    expect(document.querySelector('.feature-list')?.textContent).toBe('');
    expect(document.querySelector('.content-card p')?.textContent).toBe('');
  });

  it('hydrates product details from the middleware stream', async () => {
    sessionStorage.setItem('gengage_session_id', 'shared-demo-session');
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const streamBody = [
        'not-json',
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
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await hydrateDemoPdpShell({
      accountId: 'trendyolcom',
      sku: '917839672',
      middlewareUrl: 'https://chatbe-dev.gengage.ai',
      brandName: 'Trendyol',
      locale: 'tr',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0]![1];
    const body = JSON.parse(String((init as RequestInit).body)) as {
      session_id?: string;
      correlation_id?: string;
    };
    expect(body.session_id).toBe('shared-demo-session');
    expect(body.correlation_id).toBe('shared-demo-session');
    expect(document.querySelector('.summary-title')?.textContent).toBe('Trendyol Product');
    expect(document.querySelector('.summary-meta')?.textContent).toContain('86 değerlendirme');
    expect(document.querySelector('.feature-list')?.textContent).toContain('Renk: Turuncu');
  });

  it('hydrates from productDetails without waiting for the stream to close', async () => {
    let aborted = false;
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener(
            'abort',
            () => {
              aborted = true;
              controller.error(new DOMException('Aborted', 'AbortError'));
            },
            { once: true },
          );
          controller.enqueue(encoder.encode(`${JSON.stringify({ type: 'loading' })}\n`));
          controller.enqueue(
            encoder.encode(
              `${JSON.stringify({
                type: 'productDetails',
                payload: {
                  productDetails: {
                    sku: 'EARLY-1',
                    name: 'Early Product',
                    features: [{ name: 'Signal', value: 'streamed' }],
                  },
                },
              })}\n`,
            ),
          );
        },
      });
      return new Response(stream, { status: 200 });
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await hydrateDemoPdpShell({
      accountId: 'trendyolcom',
      sku: 'EARLY-1',
      middlewareUrl: 'https://chatbe-dev.gengage.ai',
      brandName: 'Trendyol',
      locale: 'tr',
    });

    expect(aborted).toBe(true);
    expect(document.querySelector('.summary-title')?.textContent).toBe('Early Product');
    expect(document.querySelector('.feature-list')?.textContent).toContain('Signal: streamed');
  });

  it('keeps the placeholder shell when the middleware response is not ok', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 500 }));
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    await hydrateDemoPdpShell({
      accountId: 'trendyolcom',
      sku: '917839672',
      middlewareUrl: 'https://chatbe-dev.gengage.ai',
      brandName: 'Trendyol',
      locale: 'tr',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(document.querySelector('.summary-title')?.textContent).toBe('Lorem Ipsum Demo Ürünü');
  });
});
