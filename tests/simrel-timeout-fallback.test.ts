import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/simrel/api.js', () => ({
  fetchSimilarProducts: vi.fn(),
  fetchProductGroupings: vi.fn(),
}));

import { GengageSimRel } from '../src/simrel/index.js';
import { fetchProductGroupings, fetchSimilarProducts } from '../src/simrel/api.js';

describe('GengageSimRel timeout fallback', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  it('renders the flat product grid when optional groupings time out', async () => {
    const mount = document.createElement('div');
    mount.id = 'simrel-mount';
    document.body.appendChild(mount);

    vi.mocked(fetchSimilarProducts).mockResolvedValue([
      {
        sku: 'SKU-1',
        name: 'Arcelik Klima',
        url: 'https://example.test/p/sku-1',
        price: '12999',
        brand: 'Arcelik',
        rating: 4.6,
        reviewCount: 32,
        inStock: true,
      },
    ]);
    vi.mocked(fetchProductGroupings).mockImplementation(
      (_request, _transport, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Timed out', 'AbortError'));
          });
        }),
    );

    const widget = new GengageSimRel();
    const initPromise = widget.init({
      accountId: 'assistant-id',
      middlewareUrl: 'https://example.test/api/assistant-id',
      sku: 'SKU-ORIGIN',
      mountTarget: '#simrel-mount',
      locale: 'tr',
      requestTimeoutMs: 10_000,
    });

    await vi.advanceTimersByTimeAsync(10_100);
    await initPromise;

    expect(mount.querySelector('.gengage-simrel-card')).toBeTruthy();
    expect(mount.textContent).toContain('Arcelik Klima');
  });

  it('does not log expected request timeouts as console errors', async () => {
    const mount = document.createElement('div');
    mount.id = 'simrel-mount';
    document.body.appendChild(mount);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    vi.mocked(fetchSimilarProducts).mockImplementation(
      (_request, _transport, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            reject(new DOMException('Timed out', 'AbortError'));
          });
        }),
    );

    const widget = new GengageSimRel();
    const initPromise = widget.init({
      accountId: 'assistant-id',
      middlewareUrl: 'https://example.test/api/assistant-id',
      sku: 'SKU-ORIGIN',
      mountTarget: '#simrel-mount',
      locale: 'tr',
      requestTimeoutMs: 50,
    });

    await vi.advanceTimersByTimeAsync(60);
    await initPromise;

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(mount.querySelector('.gengage-simrel-error')).toBeTruthy();
  });

  it('renders the flat product grid when groupings resolve without usable products', async () => {
    const mount = document.createElement('div');
    mount.id = 'simrel-mount';
    document.body.appendChild(mount);

    vi.mocked(fetchSimilarProducts).mockResolvedValue([
      {
        sku: 'SKU-2',
        name: 'Arcelik Buzdolabi',
        url: 'https://example.test/p/sku-2',
        price: '18999',
        brand: 'Arcelik',
        rating: 4.8,
        reviewCount: 18,
        inStock: true,
      },
    ]);
    vi.mocked(fetchProductGroupings).mockResolvedValue([
      {
        name: 'Sessiz',
        products: [],
      },
    ]);

    const widget = new GengageSimRel();
    await widget.init({
      accountId: 'assistant-id',
      middlewareUrl: 'https://example.test/api/assistant-id',
      sku: 'SKU-ORIGIN',
      mountTarget: '#simrel-mount',
      locale: 'tr',
    });

    expect(mount.querySelector('.gengage-simrel-card')).toBeTruthy();
    expect(mount.textContent).toContain('Arcelik Buzdolabi');
  });

  it('hydrates partial grouping products from similar products before rendering tabs', async () => {
    const mount = document.createElement('div');
    mount.id = 'simrel-mount';
    document.body.appendChild(mount);

    vi.mocked(fetchSimilarProducts).mockResolvedValue([
      {
        sku: 'SKU-3',
        name: 'Arcelik Kurutma Makinesi',
        url: 'https://example.test/p/sku-3',
        price: '23999',
        brand: 'Arcelik',
        rating: 4.7,
        reviewCount: 44,
        inStock: true,
      },
    ]);
    vi.mocked(fetchProductGroupings).mockResolvedValue([
      {
        name: 'Enerji Verimli',
        products: [
          {
            sku: 'SKU-3',
            name: 'Arcelik Kurutma Makinesi',
          } as never,
        ],
      },
    ]);

    const widget = new GengageSimRel();
    await widget.init({
      accountId: 'assistant-id',
      middlewareUrl: 'https://example.test/api/assistant-id',
      sku: 'SKU-ORIGIN',
      mountTarget: '#simrel-mount',
      locale: 'tr',
    });

    expect(mount.querySelector('.gengage-simrel-tab')).toBeTruthy();
    expect(mount.querySelector('.gengage-simrel-card')).toBeTruthy();
    expect(mount.textContent).toContain('Arcelik Kurutma Makinesi');
  });
});
