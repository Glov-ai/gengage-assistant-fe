import { describe, it, expect, vi } from 'vitest';
import { renderUISpec } from '../src/chat/components/renderUISpec.js';
import type { UISpec } from '../src/common/types.js';
import type { ChatUISpecRenderContext } from '../src/chat/types.js';

function makeContext(overrides?: Partial<ChatUISpecRenderContext>): ChatUISpecRenderContext {
  return { onAction: vi.fn(), ...overrides };
}

/** Create a minimal touch event with changedTouches. */
function createTouchEvent(type: string, clientX: number): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'changedTouches', {
    value: [{ clientX }],
  });
  return event;
}

function makeGallerySpec(): UISpec {
  return {
    root: 'root',
    elements: {
      root: {
        type: 'ProductDetailsPanel',
        props: {
          product: {
            name: 'Test Product',
            sku: 'SKU1',
            images: ['https://example.com/1.jpg', 'https://example.com/2.jpg', 'https://example.com/3.jpg'],
            price: '100 TL',
          },
        },
        children: [],
      },
    },
    widget: 'chat',
  };
}

describe('Gallery swipe gesture', () => {
  it('swipe left advances to next image', () => {
    const result = renderUISpec(makeGallerySpec(), makeContext());
    const mainImg = result.querySelector('.gengage-chat-product-details-img') as HTMLImageElement;
    const thumbs = result.querySelectorAll('.gengage-chat-product-gallery-thumb');

    expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);

    // Swipe left: start at 200, end at 100 (diff = 100 > threshold)
    mainImg.dispatchEvent(createTouchEvent('touchstart', 200));
    mainImg.dispatchEvent(createTouchEvent('touchend', 100));

    expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(false);
    expect(thumbs[1]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);
  });

  it('swipe right goes to previous image', () => {
    const result = renderUISpec(makeGallerySpec(), makeContext());
    const mainImg = result.querySelector('.gengage-chat-product-details-img') as HTMLImageElement;
    const thumbs = result.querySelectorAll('.gengage-chat-product-gallery-thumb');

    // First advance to index 1 by clicking
    (thumbs[1] as HTMLElement).click();
    expect(thumbs[1]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);

    // Swipe right: start at 100, end at 200 (diff = -100 < -threshold)
    mainImg.dispatchEvent(createTouchEvent('touchstart', 100));
    mainImg.dispatchEvent(createTouchEvent('touchend', 200));

    expect(thumbs[1]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(false);
    expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);
  });

  it('swipe below threshold is ignored', () => {
    const result = renderUISpec(makeGallerySpec(), makeContext());
    const mainImg = result.querySelector('.gengage-chat-product-details-img') as HTMLImageElement;
    const thumbs = result.querySelectorAll('.gengage-chat-product-gallery-thumb');

    expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);

    // Swipe distance = 30, below 50 threshold
    mainImg.dispatchEvent(createTouchEvent('touchstart', 200));
    mainImg.dispatchEvent(createTouchEvent('touchend', 170));

    // Should stay on first image
    expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);
  });

  it('swipe at last image stays on last', () => {
    const result = renderUISpec(makeGallerySpec(), makeContext());
    const mainImg = result.querySelector('.gengage-chat-product-details-img') as HTMLImageElement;
    const thumbs = result.querySelectorAll('.gengage-chat-product-gallery-thumb');

    // Navigate to last image (index 2)
    (thumbs[2] as HTMLElement).click();
    expect(thumbs[2]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);

    // Swipe left again (should not advance beyond last)
    mainImg.dispatchEvent(createTouchEvent('touchstart', 200));
    mainImg.dispatchEvent(createTouchEvent('touchend', 100));

    // Still on last image
    expect(thumbs[2]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);
  });

  it('swipe at first image stays on first', () => {
    const result = renderUISpec(makeGallerySpec(), makeContext());
    const mainImg = result.querySelector('.gengage-chat-product-details-img') as HTMLImageElement;
    const thumbs = result.querySelectorAll('.gengage-chat-product-gallery-thumb');

    expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);

    // Swipe right (should not go before first)
    mainImg.dispatchEvent(createTouchEvent('touchstart', 100));
    mainImg.dispatchEvent(createTouchEvent('touchend', 200));

    // Still on first image
    expect(thumbs[0]!.classList.contains('gengage-chat-product-gallery-thumb--active')).toBe(true);
  });
});
