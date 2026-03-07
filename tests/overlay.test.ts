import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock widget constructors so overlay doesn't try to create real DOM/fetch
vi.mock('../src/chat/index.js', () => ({
  GengageChat: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.init = vi.fn().mockResolvedValue(undefined);
    this.open = vi.fn();
    this.close = vi.fn();
    this.update = vi.fn();
    this.destroy = vi.fn();
    this.saveSession = vi.fn();
    this.on = vi.fn().mockReturnValue(() => {});
  }),
}));

vi.mock('../src/qna/index.js', () => ({
  GengageQNA: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.init = vi.fn().mockResolvedValue(undefined);
    this.update = vi.fn();
    this.show = vi.fn();
    this.destroy = vi.fn();
  }),
}));

vi.mock('../src/simrel/index.js', () => ({
  GengageSimRel: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.init = vi.fn().mockResolvedValue(undefined);
    this.update = vi.fn();
    this.show = vi.fn();
    this.destroy = vi.fn();
  }),
}));

vi.mock('../src/common/events.js', () => ({
  wireQNAToChat: vi.fn().mockReturnValue(() => {}),
}));

vi.mock('../src/common/ga-datalayer.js', () => ({
  trackInit: vi.fn(),
  trackShow: vi.fn(),
  trackCompareClear: vi.fn(),
}));

import {
  initOverlayWidgets,
  getOverlayWidgets,
  destroyOverlayWidgets,
  buildOverlayIdempotencyKey,
} from '../src/common/overlay.js';

describe('overlay', () => {
  beforeEach(() => {
    // Clear the global registry between tests
    const win = window as unknown as Record<string, unknown>;
    delete win['__gengageOverlayRegistry'];
    delete win['gengage'];

    // Set up mount targets for QNA and SimRel
    document.body.innerHTML = '<div id="gengage-qna"></div><div id="gengage-simrel"></div>';
  });

  describe('buildOverlayIdempotencyKey', () => {
    it('returns key with default prefix + accountId', () => {
      const key = buildOverlayIdempotencyKey('mystore');
      expect(key).toBe('__gengageWidgetsInit_overlay_mystore');
    });
  });

  describe('initOverlayWidgets', () => {
    it('initializes and returns a controller', async () => {
      const controller = await initOverlayWidgets({
        accountId: 'test-account',
        middlewareUrl: 'https://example.com',
        sku: 'SKU123',
      });

      expect(controller).toBeDefined();
      expect(controller.session).toBeDefined();
      expect(controller.session.sessionId).toBeTruthy();
      expect(controller.chat).toBeDefined();
    });

    it('returns same instance for same accountId (idempotent)', async () => {
      const opts = {
        accountId: 'idem-test',
        middlewareUrl: 'https://example.com',
      };

      const first = await initOverlayWidgets(opts);
      const second = await initOverlayWidgets(opts);

      expect(first).toBe(second);
    });

    it('returns different instances for different accountIds', async () => {
      const a = await initOverlayWidgets({
        accountId: 'account-a',
        middlewareUrl: 'https://example.com',
      });
      const b = await initOverlayWidgets({
        accountId: 'account-b',
        middlewareUrl: 'https://example.com',
      });

      expect(a).not.toBe(b);
    });

    it('supports custom idempotencyKey', async () => {
      const controller = await initOverlayWidgets({
        accountId: 'custom-key-test',
        middlewareUrl: 'https://example.com',
        idempotencyKey: 'my-custom-key',
      });

      expect(controller.idempotencyKey).toBe('my-custom-key');
      expect(getOverlayWidgets('my-custom-key')).toBe(controller);
    });
  });

  describe('getOverlayWidgets', () => {
    it('returns null for unknown key', () => {
      expect(getOverlayWidgets('nonexistent')).toBeNull();
    });

    it('returns controller after init', async () => {
      const key = buildOverlayIdempotencyKey('get-test');
      await initOverlayWidgets({
        accountId: 'get-test',
        middlewareUrl: 'https://example.com',
      });

      expect(getOverlayWidgets(key)).not.toBeNull();
    });
  });

  describe('destroyOverlayWidgets', () => {
    it('removes controller from registry', async () => {
      const key = buildOverlayIdempotencyKey('destroy-test');
      await initOverlayWidgets({
        accountId: 'destroy-test',
        middlewareUrl: 'https://example.com',
      });

      expect(getOverlayWidgets(key)).not.toBeNull();

      destroyOverlayWidgets(key);

      expect(getOverlayWidgets(key)).toBeNull();
    });

    it('is safe to call with unknown key', () => {
      expect(() => destroyOverlayWidgets('nonexistent')).not.toThrow();
    });
  });

  describe('controller lifecycle', () => {
    it('destroy clears widget references', async () => {
      const controller = await initOverlayWidgets({
        accountId: 'lifecycle-test',
        middlewareUrl: 'https://example.com',
      });

      expect(controller.chat).not.toBeNull();

      controller.destroy();

      expect(controller.chat).toBeNull();
      expect(controller.qna).toBeNull();
      expect(controller.simrel).toBeNull();
    });

    it('allows re-init after destroy', async () => {
      const opts = {
        accountId: 'reinit-test',
        middlewareUrl: 'https://example.com',
      };

      const first = await initOverlayWidgets(opts);
      first.destroy();

      const second = await initOverlayWidgets(opts);
      expect(second).not.toBe(first);
      expect(second.chat).not.toBeNull();
    });

    it('openChat and closeChat delegate to chat widget', async () => {
      const controller = await initOverlayWidgets({
        accountId: 'delegate-test',
        middlewareUrl: 'https://example.com',
      });

      controller.openChat({ state: 'full' });
      expect(controller.chat!.open).toHaveBeenCalledWith({ state: 'full' });

      controller.closeChat();
      expect(controller.chat!.close).toHaveBeenCalled();
    });
  });
});
