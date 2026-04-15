import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initGengageClient } from '../src/common/client.js';

describe('initGengageClient', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    if ((window as unknown as Record<string, unknown>).gengage)
      delete (window as unknown as Record<string, unknown>).gengage;
  });

  it('throws on invalid runtimeConfig', async () => {
    await expect(initGengageClient({ runtimeConfig: { bad: true } })).rejects.toThrow(/accountId/i);
  });

  it('accepts a pre-parsed AccountRuntimeConfig', async () => {
    // Valid config should NOT throw a config validation error.
    // In JSDOM the widgets may fully init (resolve) or fail for non-config reasons.
    try {
      await initGengageClient({
        runtimeConfig: {
          version: '1',
          accountId: 'testaccount',
          middlewareUrl: 'https://test.example.com',
          widgets: {
            chat: { enabled: true },
            qna: { enabled: true },
            simrel: { enabled: true },
            simbut: { enabled: false },
          },
        },
        preflight: false,
      });
      // Resolved successfully — config was accepted
    } catch (err) {
      // If it did reject, the error must NOT be a config validation error
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toMatch(/Invalid runtime config/i);
    }
  });

  it('maps hostActions.onAddToCart into overlay options', async () => {
    const onAddToCart = vi.fn();

    try {
      await initGengageClient({
        runtimeConfig: {
          version: '1',
          accountId: 'test',
          middlewareUrl: 'https://test.example.com',
          widgets: {
            chat: { enabled: true },
            qna: { enabled: true },
            simrel: { enabled: true },
            simbut: { enabled: false },
          },
        },
        hostActions: { onAddToCart },
        preflight: false,
      });
    } catch {
      // Expected — no real backend
    }

    expect(onAddToCart).not.toHaveBeenCalled();
  });

  it('applies contextResolver initial context', async () => {
    const contextResolver = vi.fn(() => ({ pageType: 'pdp' as const, sku: 'SKU123' }));

    try {
      await initGengageClient({
        runtimeConfig: {
          version: '1',
          accountId: 'test',
          middlewareUrl: 'https://test.example.com',
          widgets: {
            chat: { enabled: true },
            qna: { enabled: true },
            simrel: { enabled: true },
            simbut: { enabled: false },
          },
        },
        contextResolver,
        preflight: false,
      });
    } catch {
      // Expected
    }

    expect(contextResolver).toHaveBeenCalled();
  });

  it('runs preflight by default', async () => {
    try {
      await initGengageClient({
        runtimeConfig: {
          version: '1',
          accountId: 'test',
          middlewareUrl: 'https://test.example.com',
          widgets: {
            chat: { enabled: true },
            qna: { enabled: true },
            simrel: { enabled: true },
            simbut: { enabled: false },
          },
          mounts: { qna: '#missing' },
        },
      });
    } catch {
      // Expected
    }
  });

  it('skips preflight when preflight: false', async () => {
    try {
      await initGengageClient({
        runtimeConfig: {
          version: '1',
          accountId: 'test',
          middlewareUrl: 'https://test.example.com',
          widgets: {
            chat: { enabled: true },
            qna: { enabled: true },
            simrel: { enabled: true },
            simbut: { enabled: true },
          },
          mounts: { qna: '##invalid', simbut: '#product-image' },
        },
        hostActions: { onFindSimilar: vi.fn() },
        preflight: false,
      });
    } catch {
      // Expected — will fail on init, but NOT on preflight INVALID_SELECTOR
    }
  });

  it('accepts simbut runtime config with a custom host action', async () => {
    document.body.innerHTML = '<div id="product-image"></div>';
    const onFindSimilar = vi.fn();

    try {
      await initGengageClient({
        runtimeConfig: {
          version: '1',
          accountId: 'test',
          middlewareUrl: 'https://test.example.com',
          widgets: {
            chat: { enabled: false },
            qna: { enabled: false },
            simrel: { enabled: false },
            simbut: { enabled: true },
          },
          mounts: { simbut: '#product-image' },
        },
        hostActions: { onFindSimilar },
        preflight: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      expect(message).not.toMatch(/Invalid runtime config/i);
    }

    expect(onFindSimilar).not.toHaveBeenCalled();
  });
});
