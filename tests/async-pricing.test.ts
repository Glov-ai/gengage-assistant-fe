/**
 * Tests for async pricing skeleton — price_async flag shows a shimmer placeholder
 * that resolves to the actual price after 300ms.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { UISpec } from '../src/common/types.js';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpecRenderContext } from '../src/chat/components/renderUISpec.js';

function makeProductCardSpec(productProps: Record<string, unknown>): UISpec {
  return {
    root: 'root',
    elements: {
      root: {
        type: 'ProductCard',
        props: { product: productProps },
      },
    },
  };
}

function makeProductDetailsPanelSpec(productProps: Record<string, unknown>): UISpec {
  return {
    root: 'root',
    elements: {
      root: {
        type: 'ProductDetailsPanel',
        props: { product: productProps },
      },
    },
  };
}

function makeCtx(overrides: Partial<UISpecRenderContext> = {}): UISpecRenderContext {
  return {
    onAction: vi.fn(),
    onProductClick: vi.fn(),
    ...overrides,
  };
}

describe('Async pricing skeleton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows skeleton when price_async is true', () => {
    const spec = makeProductCardSpec({ name: 'Test', price: '100 TL', price_async: true, sku: 'S1' });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-price-skeleton')).not.toBeNull();
  });

  it('replaces skeleton with price after 300ms', () => {
    const spec = makeProductCardSpec({ name: 'Test', price: '100 TL', price_async: true, sku: 'S1' });
    const el = renderUISpec(spec, makeCtx());
    vi.advanceTimersByTime(300);
    expect(el.querySelector('.gengage-chat-price-skeleton')).toBeNull();
    const priceRow = el.querySelector('.gengage-chat-product-card-price');
    expect(priceRow?.textContent).toContain('100');
  });

  it('renders price immediately when price_async is not set', () => {
    const spec = makeProductCardSpec({ name: 'Test', price: '200 TL', sku: 'S2' });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-price-skeleton')).toBeNull();
    expect(el.querySelector('.gengage-chat-product-card-price')?.textContent).toContain('200');
  });

  it('removes skeleton gracefully when no price available', () => {
    const spec = makeProductCardSpec({ name: 'Test', price_async: true, sku: 'S3' });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-price-skeleton')).not.toBeNull();
    vi.advanceTimersByTime(300);
    expect(el.querySelector('.gengage-chat-price-skeleton')).toBeNull();
  });

  it('product details panel shows skeleton with price_async', () => {
    const spec = makeProductDetailsPanelSpec({
      name: 'Detail',
      price: '500 TL',
      price_async: true,
      sku: 'D1',
      imageUrl: 'https://example.com/img.jpg',
    });
    const el = renderUISpec(spec, makeCtx());
    expect(el.querySelector('.gengage-chat-price-skeleton')).not.toBeNull();
    vi.advanceTimersByTime(300);
    expect(el.querySelector('.gengage-chat-price-skeleton')).toBeNull();
  });
});
