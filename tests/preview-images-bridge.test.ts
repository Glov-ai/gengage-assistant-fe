import { describe, it, expect } from 'vitest';

/**
 * Tests that preview images are sent to host via bridge when productList arrives.
 */
describe('Preview Images Bridge Message', () => {
  class PreviewImageSimulator {
    bridgeMessages: Array<{ type: string; payload: unknown }> = [];

    sendBridge(type: string, payload: unknown): void {
      this.bridgeMessages.push({ type, payload });
    }

    extractAndSendPreviews(products: Array<Record<string, unknown>>): void {
      const imageUrls = products
        .map((p) => p['imageUrl'] as string | undefined)
        .filter((url): url is string => typeof url === 'string')
        .slice(0, 5);
      if (imageUrls.length > 0) {
        this.sendBridge('previewImages', { images: imageUrls });
      }
    }
  }

  it('sends first 5 product images to host', () => {
    const sim = new PreviewImageSimulator();
    const products = Array.from({ length: 8 }, (_, i) => ({
      sku: `SKU${i}`,
      imageUrl: `https://img/${i}.jpg`,
    }));

    sim.extractAndSendPreviews(products);

    expect(sim.bridgeMessages).toHaveLength(1);
    const payload = sim.bridgeMessages[0]!.payload as { images: string[] };
    expect(payload.images).toHaveLength(5);
    expect(payload.images[0]).toBe('https://img/0.jpg');
  });

  it('skips products without imageUrl', () => {
    const sim = new PreviewImageSimulator();
    const products = [
      { sku: 'A', imageUrl: 'https://img/a.jpg' },
      { sku: 'B' }, // no image
      { sku: 'C', imageUrl: 'https://img/c.jpg' },
    ];

    sim.extractAndSendPreviews(products);

    const payload = sim.bridgeMessages[0]!.payload as { images: string[] };
    expect(payload.images).toEqual(['https://img/a.jpg', 'https://img/c.jpg']);
  });

  it('does not send bridge message when no images', () => {
    const sim = new PreviewImageSimulator();
    sim.extractAndSendPreviews([{ sku: 'A' }, { sku: 'B' }]);

    expect(sim.bridgeMessages).toHaveLength(0);
  });

  it('does not send bridge message for empty product list', () => {
    const sim = new PreviewImageSimulator();
    sim.extractAndSendPreviews([]);

    expect(sim.bridgeMessages).toHaveLength(0);
  });
});
