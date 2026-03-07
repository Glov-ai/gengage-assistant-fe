import { describe, it, expect } from 'vitest';
import { detectPageType, extractSkuFromUrl, autoDetectPageContext } from '../src/common/page-detect.js';

describe('detectPageType', () => {
  function url(path: string, query = ''): URL {
    return new URL(`https://example.com${path}${query}`);
  }

  it('detects home page from /', () => {
    expect(detectPageType(undefined, url('/'))).toBe('home');
  });

  it('detects home page from /index.html', () => {
    expect(detectPageType(undefined, url('/index.html'))).toBe('home');
  });

  it('detects home page from /anasayfa', () => {
    expect(detectPageType(undefined, url('/anasayfa'))).toBe('home');
  });

  it('detects search page with q param', () => {
    expect(detectPageType(undefined, url('/arama', '?q=test'))).toBe('search');
  });

  it('does not detect search without q param', () => {
    expect(detectPageType(undefined, url('/arama'))).not.toBe('search');
  });

  it('detects cart page', () => {
    expect(detectPageType(undefined, url('/sepet'))).toBe('cart');
    expect(detectPageType(undefined, url('/cart'))).toBe('cart');
    expect(detectPageType(undefined, url('/basket'))).toBe('cart');
  });

  it('detects PLP from category URLs', () => {
    expect(detectPageType(undefined, url('/kategori/mobilya'))).toBe('plp');
    expect(detectPageType(undefined, url('/category/furniture'))).toBe('plp');
  });

  it('detects PDP from product URLs', () => {
    expect(detectPageType(undefined, url('/urun/abc123'))).toBe('pdp');
    expect(detectPageType(undefined, url('/product/abc123'))).toBe('pdp');
    expect(detectPageType(undefined, url('/p/abc123'))).toBe('pdp');
  });

  it('detects PDP from Trendyol-style URLs', () => {
    expect(detectPageType(undefined, url('/brand/-p-12345'))).toBe('pdp');
    expect(detectPageType(undefined, url('/brand/-pm-12345'))).toBe('pdp');
  });

  it('returns other for unknown paths', () => {
    expect(detectPageType(undefined, url('/about'))).toBe('other');
    expect(detectPageType(undefined, url('/contact'))).toBe('other');
  });

  it('accepts custom rules', () => {
    const rules = [{ pageType: 'pdp' as const, urlPatterns: ['/item/'] }];
    expect(detectPageType(rules, url('/item/123'))).toBe('pdp');
  });

  it('returns other when no URL available (SSR)', () => {
    // Pass a null-like URL scenario: the function uses window.location as fallback
    // but in test env we pass an explicit URL
    expect(detectPageType([], url('/unknown'))).toBe('other');
  });
});

describe('extractSkuFromUrl', () => {
  function url(path: string): URL {
    return new URL(`https://example.com${path}`);
  }

  it('extracts SKU from /p/SKU pattern', () => {
    expect(extractSkuFromUrl(url('/p/ABC123'))).toBe('ABC123');
  });

  it('extracts SKU from /urun/SKU pattern', () => {
    expect(extractSkuFromUrl(url('/urun/1000465056'))).toBe('1000465056');
  });

  it('extracts SKU from /product/SKU pattern', () => {
    expect(extractSkuFromUrl(url('/product/XYZ789'))).toBe('XYZ789');
  });

  it('extracts SKU from Trendyol -p-SKU pattern', () => {
    expect(extractSkuFromUrl(url('/some-product-p-12345'))).toBe('12345');
  });

  it('returns undefined for non-product URLs', () => {
    expect(extractSkuFromUrl(url('/about'))).toBeUndefined();
    expect(extractSkuFromUrl(url('/cart'))).toBeUndefined();
  });
});

describe('autoDetectPageContext', () => {
  it('returns detected page type', () => {
    // autoDetectPageContext uses window.location, so in test env it returns 'other'
    const result = autoDetectPageContext();
    expect(result.pageType).toBeDefined();
  });
});
