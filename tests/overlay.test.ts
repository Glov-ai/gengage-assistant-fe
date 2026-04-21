import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    this.hide = vi.fn();
    this.destroy = vi.fn();
  }),
}));

vi.mock('../src/simrel/index.js', () => ({
  GengageSimRel: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.init = vi.fn().mockResolvedValue(undefined);
    this.update = vi.fn();
    this.show = vi.fn();
    this.hide = vi.fn();
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
import { GengageQNA } from '../src/qna/index.js';
import { GengageChat } from '../src/chat/index.js';

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

    it('updates page context through controller aliases', async () => {
      const controller = await initOverlayWidgets({
        accountId: 'context-aliases',
        middlewareUrl: 'https://example.com',
        pageContext: { pageType: 'pdp', sku: 'SKU-OLD', categoryTree: ['Root'] },
      });

      await controller.updatePageContext({ sku: 'SKU-NEW' });

      expect(window.gengage?.pageContext).toEqual({
        pageType: 'pdp',
        sku: 'SKU-NEW',
        categoryTree: ['Root'],
      });
      expect(controller.chat!.update).toHaveBeenLastCalledWith({
        pageType: 'pdp',
        sku: 'SKU-NEW',
        categoryTree: ['Root'],
      });

      await controller.setPageContext({ pageType: 'plp', skuList: ['SKU-A', 'SKU-B'] });

      expect(window.gengage?.pageContext).toEqual({
        pageType: 'plp',
        categoryTree: ['Root'],
        skuList: ['SKU-A', 'SKU-B'],
      });
      expect(controller.chat!.update).toHaveBeenLastCalledWith({
        pageType: 'plp',
        categoryTree: ['Root'],
        skuList: ['SKU-A', 'SKU-B'],
      });
    });
  });

  describe('QNA headerTitle forwarding', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('passes qna.headerTitle directly to QNA init config', async () => {
      await initOverlayWidgets({
        accountId: 'qna-headertitle-direct',
        middlewareUrl: 'https://example.com',
        sku: 'SKU123',
        qna: { headerTitle: "Koçtaş'a Sor" },
      });

      const qnaInstance = vi.mocked(GengageQNA).mock.instances[0] as Record<string, ReturnType<typeof vi.fn>>;
      const initArg = qnaInstance['init'].mock.calls[0][0] as Record<string, unknown>;
      expect(initArg['headerTitle']).toBe("Koçtaş'a Sor");
    });

    it('does NOT inherit chat.headerTitle for QNA when qna.headerTitle is absent', async () => {
      await initOverlayWidgets({
        accountId: 'qna-headertitle-no-fallback',
        middlewareUrl: 'https://example.com',
        sku: 'SKU123',
        chat: { headerTitle: "Boyner'e Sor" },
        // qna.headerTitle deliberately absent — must not be silently inherited
      });

      const qnaInstance = vi.mocked(GengageQNA).mock.instances[0] as Record<string, ReturnType<typeof vi.fn>>;
      const initArg = qnaInstance['init'].mock.calls[0][0] as Record<string, unknown>;
      expect(initArg['headerTitle']).toBeUndefined();
    });

    it('qna.headerTitle takes precedence over chat.headerTitle', async () => {
      await initOverlayWidgets({
        accountId: 'qna-headertitle-priority',
        middlewareUrl: 'https://example.com',
        sku: 'SKU123',
        chat: { headerTitle: 'Chat Title' },
        qna: { headerTitle: 'QNA Title' },
      });

      const qnaInstance = vi.mocked(GengageQNA).mock.instances[0] as Record<string, ReturnType<typeof vi.fn>>;
      const initArg = qnaInstance['init'].mock.calls[0][0] as Record<string, unknown>;
      expect(initArg['headerTitle']).toBe('QNA Title');
    });

    it('qna.headingTitle (deprecated) is used when headerTitle is absent', async () => {
      await initOverlayWidgets({
        accountId: 'qna-headertitle-deprecated',
        middlewareUrl: 'https://example.com',
        sku: 'SKU123',
        qna: { headingTitle: 'Legacy Title' },
      });

      const qnaInstance = vi.mocked(GengageQNA).mock.instances[0] as Record<string, ReturnType<typeof vi.fn>>;
      const initArg = qnaInstance['init'].mock.calls[0][0] as Record<string, unknown>;
      expect(initArg['headerTitle']).toBe('Legacy Title');
    });

    it('forwards pillLauncher from chat options to GengageChat init config', async () => {
      const pillLauncher = {
        label: "Koçtaş'a Sor",
        avatarUrl: 'https://example.com/logo.svg',
        primaryColor: '#ec6e00',
      };

      await initOverlayWidgets({
        accountId: 'pill-launcher-forward',
        middlewareUrl: 'https://example.com',
        chat: { pillLauncher },
      });

      const chatInstance = vi.mocked(GengageChat).mock.instances[0] as Record<string, ReturnType<typeof vi.fn>>;
      const initArg = chatInstance['init'].mock.calls[0][0] as Record<string, unknown>;
      expect(initArg['pillLauncher']).toEqual(pillLauncher);
    });

    it('forwards top-level demo flags to GengageChat init config', async () => {
      await initOverlayWidgets({
        accountId: 'top-level-demo-flags',
        middlewareUrl: 'https://example.com',
        isDemoWebsite: true,
        productDetailsExtended: true,
      });

      const chatInstance = vi.mocked(GengageChat).mock.instances[0] as Record<string, ReturnType<typeof vi.fn>>;
      const initArg = chatInstance['init'].mock.calls[0][0] as Record<string, unknown>;
      expect(initArg['isDemoWebsite']).toBe(true);
      expect(initArg['productDetailsExtended']).toBe(true);
    });

    it('prefers chat demo flags over top-level compatibility flags', async () => {
      await initOverlayWidgets({
        accountId: 'chat-demo-flags-precedence',
        middlewareUrl: 'https://example.com',
        isDemoWebsite: false,
        productDetailsExtended: false,
        chat: {
          isDemoWebsite: true,
          productDetailsExtended: true,
        },
      });

      const chatInstance = vi.mocked(GengageChat).mock.instances[0] as Record<string, ReturnType<typeof vi.fn>>;
      const initArg = chatInstance['init'].mock.calls[0][0] as Record<string, unknown>;
      expect(initArg['isDemoWebsite']).toBe(true);
      expect(initArg['productDetailsExtended']).toBe(true);
    });
  });
});
