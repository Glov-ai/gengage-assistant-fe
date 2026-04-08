import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionPersistence } from '../src/chat/session-persistence.js';
import type { GengageIndexedDB, PayloadData } from '../src/common/indexed-db.js';
import type { CommunicationBridge } from '../src/common/communication-bridge.js';
import type { ChatMessage } from '../src/chat/types.js';
import type { UISpec } from '../src/common/types.js';

function createMockDb(): GengageIndexedDB {
  return {
    saveSession: vi.fn().mockResolvedValue(undefined),
    loadSession: vi.fn().mockResolvedValue(null),
    saveContext: vi.fn().mockResolvedValue(undefined),
    loadContext: vi.fn().mockResolvedValue(null),
    savePayload: vi.fn().mockResolvedValue(undefined),
    loadPayload: vi.fn().mockResolvedValue(null),
    saveFavorite: vi.fn().mockResolvedValue(undefined),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
    loadFavorites: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  } as unknown as GengageIndexedDB;
}

function createMockBridge(): CommunicationBridge {
  return { send: vi.fn() } as unknown as CommunicationBridge;
}

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    role: 'assistant',
    timestamp: Date.now(),
    status: 'done',
    ...overrides,
  } as ChatMessage;
}

function basePersistParams() {
  return {
    userId: 'u1',
    appId: 'a1',
    sessionId: 's1',
    messages: [] as ChatMessage[],
    currentThreadId: null as string | null,
    lastThreadId: null as string | null,
    chatCreatedAt: '2026-01-01T00:00:00Z',
    panelSnapshots: new Map<string, HTMLElement>(),
    panelThreads: [] as string[],
    thumbnailEntries: [] as Array<{ sku: string; imageUrl: string; threadId: string }>,
    lastBackendContext: null,
    expertModeState: { activeSession: null as null },
    sku: 'SKU1',
  };
}

describe('SessionPersistence', () => {
  let db: ReturnType<typeof createMockDb>;
  let sp: SessionPersistence;

  beforeEach(() => {
    db = createMockDb();
    sp = new SessionPersistence(db);
  });

  // ---------------------------------------------------------------------------
  // persist()
  // ---------------------------------------------------------------------------

  describe('persist', () => {
    it('saves session to IDB', async () => {
      await sp.persist(basePersistParams());

      expect(db.saveSession).toHaveBeenCalledTimes(1);
      const saved = (db.saveSession as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(saved.userId).toBe('u1');
      expect(saved.appId).toBe('a1');
      expect(saved.sessionId).toBe('s1');
      expect(saved.expertModeState).toEqual({ activeSession: null });
    });

    it('serializes messages — converts streaming status to done', async () => {
      const params = basePersistParams();
      params.messages = [makeMessage({ id: 'm1', status: 'streaming' })];

      await sp.persist(params);

      const saved = (db.saveSession as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(saved.messages[0].status).toBe('done');
    });

    it('saves context when lastBackendContext and currentThreadId are set', async () => {
      const params = basePersistParams();
      params.currentThreadId = 't1';
      params.lastBackendContext = { messages: [], panel: null } as never;

      await sp.persist(params);

      expect(db.saveContext).toHaveBeenCalledTimes(1);
      expect((db.saveContext as ReturnType<typeof vi.fn>).mock.calls[0]![0].threadId).toBe('t1');
    });

    it('does not save context when currentThreadId is null', async () => {
      const params = basePersistParams();
      params.lastBackendContext = { messages: [] } as never;
      params.currentThreadId = null;

      await sp.persist(params);

      expect(db.saveContext).not.toHaveBeenCalled();
    });

    it('saves UISpec payloads for messages that have them', async () => {
      const uiSpec: UISpec = { root: 'r1', elements: {} };
      const params = basePersistParams();
      params.messages = [makeMessage({ id: 'm1', threadId: 't1', uiSpec })];

      await sp.persist(params);

      expect(db.savePayload).toHaveBeenCalledTimes(1);
      expect((db.savePayload as ReturnType<typeof vi.fn>).mock.calls[0]![0]).toEqual({
        threadId: 't1',
        messageId: 'm1',
        uiSpec,
      });
    });

    it('skips UISpec save when message has no threadId', async () => {
      const uiSpec: UISpec = { root: 'r1', elements: {} };
      const params = basePersistParams();
      params.messages = [makeMessage({ id: 'm1', uiSpec })];

      await sp.persist(params);

      expect(db.savePayload).not.toHaveBeenCalled();
    });

    it('is a no-op when db is null', async () => {
      sp.db = null;
      await sp.persist(basePersistParams());
      expect(db.saveSession).not.toHaveBeenCalled();
    });

    it('serializes concurrent persist() calls through mutex', async () => {
      const callOrder: number[] = [];
      let callCount = 0;
      (db.saveSession as ReturnType<typeof vi.fn>).mockImplementation(async () => {
        const n = ++callCount;
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push(n);
      });

      const p1 = sp.persist(basePersistParams());
      const p2 = sp.persist(basePersistParams());

      await Promise.all([p1, p2]);

      expect(callOrder).toEqual([1, 2]);
    });

    it('omits empty panelThreads and thumbnailEntries', async () => {
      await sp.persist(basePersistParams());

      const saved = (db.saveSession as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(saved.panelThreads).toBeUndefined();
      expect(saved.thumbnailEntries).toBeUndefined();
    });

    it('skips panel snapshots containing skeleton elements', async () => {
      const params = basePersistParams();
      const el = document.createElement('div');
      el.innerHTML = '<div class="gengage-chat-panel-skeleton">loading...</div>';
      params.panelSnapshots.set('msg-1', el);

      await sp.persist(params);

      const saved = (db.saveSession as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(saved.panelSnapshotHtml).toBeUndefined();
    });

    it('serializes valid panel snapshots as HTML strings', async () => {
      const params = basePersistParams();
      const el = document.createElement('div');
      el.innerHTML = '<p>Panel content</p>';
      params.panelSnapshots.set('msg-1', el);

      await sp.persist(params);

      const saved = (db.saveSession as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(saved.panelSnapshotHtml).toEqual({ 'msg-1': '<p>Panel content</p>' });
    });
  });

  // ---------------------------------------------------------------------------
  // loadPayload()
  // ---------------------------------------------------------------------------

  describe('loadPayload', () => {
    it('returns UISpec when found', async () => {
      const uiSpec: UISpec = { root: 'r1', elements: {} };
      (db.loadPayload as ReturnType<typeof vi.fn>).mockResolvedValue({
        threadId: 't1',
        messageId: 'm1',
        uiSpec,
      } as PayloadData);

      const result = await sp.loadPayload('t1', 'm1');
      expect(result).toBe(uiSpec);
    });

    it('returns null when not found', async () => {
      (db.loadPayload as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const result = await sp.loadPayload('t1', 'm1');
      expect(result).toBeNull();
    });

    it('returns null when db is null', async () => {
      sp.db = null;
      const result = await sp.loadPayload('t1', 'm1');
      expect(result).toBeNull();
    });

    it('retries up to 3 times on failure then returns null', async () => {
      (db.loadPayload as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('IDB error'));

      const result = await sp.loadPayload('t1', 'm1');

      expect(result).toBeNull();
      expect(db.loadPayload).toHaveBeenCalledTimes(3);
    });
  });

  // ---------------------------------------------------------------------------
  // Favorites
  // ---------------------------------------------------------------------------

  describe('loadFavorites', () => {
    it('populates favoritedSkus set from IDB', async () => {
      (db.loadFavorites as ReturnType<typeof vi.fn>).mockResolvedValue([
        { sku: 'A', userId: 'u1', appId: 'a1', savedAt: '2026-01-01' },
        { sku: 'B', userId: 'u1', appId: 'a1', savedAt: '2026-01-01' },
      ]);

      await sp.loadFavorites('u1', 'a1');

      expect(sp.favoritedSkus.has('A')).toBe(true);
      expect(sp.favoritedSkus.has('B')).toBe(true);
    });

    it('is a no-op when db is null', async () => {
      sp.db = null;
      await sp.loadFavorites('u1', 'a1');
      expect(sp.favoritedSkus.size).toBe(0);
    });

    it('swallows IDB errors gracefully', async () => {
      (db.loadFavorites as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('quota'));
      await expect(sp.loadFavorites('u1', 'a1')).resolves.toBeUndefined();
    });
  });

  describe('toggleFavorite', () => {
    it('adds SKU when not favorited', async () => {
      await sp.toggleFavorite('u1', 'a1', 'SKU1', { name: 'Product' });

      expect(sp.favoritedSkus.has('SKU1')).toBe(true);
      expect(db.saveFavorite).toHaveBeenCalledTimes(1);
    });

    it('removes SKU when already favorited', async () => {
      sp.favoritedSkus.add('SKU1');

      await sp.toggleFavorite('u1', 'a1', 'SKU1', {});

      expect(sp.favoritedSkus.has('SKU1')).toBe(false);
      expect(db.removeFavorite).toHaveBeenCalledWith('u1', 'a1', 'SKU1');
    });

    it('updates in-memory state even when db is null', async () => {
      sp.db = null;
      await sp.toggleFavorite('u1', 'a1', 'SKU1', {});
      // In-memory set is always updated — IDB is optional persistence
      expect(sp.favoritedSkus.has('SKU1')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // saveAndOpenURL()
  // ---------------------------------------------------------------------------

  describe('saveAndOpenURL', () => {
    it('calls persistFn and sends bridge message', async () => {
      const persistFn = vi.fn().mockResolvedValue(undefined);
      const bridge = createMockBridge();

      await sp.saveAndOpenURL('https://example.com/product', persistFn, bridge);

      expect(persistFn).toHaveBeenCalledTimes(1);
      expect(bridge.send).toHaveBeenCalledWith('openURLInNewTab', { url: 'https://example.com/product' });
    });

    it('navigates even when persistFn throws', async () => {
      const persistFn = vi.fn().mockRejectedValue(new Error('IDB failure'));
      const bridge = createMockBridge();

      await sp.saveAndOpenURL('https://example.com', persistFn, bridge);

      expect(bridge.send).toHaveBeenCalledTimes(1);
    });

    it('does not navigate for unsafe URLs (javascript:)', async () => {
      const persistFn = vi.fn().mockResolvedValue(undefined);
      const originalHref = window.location.href;

      await sp.saveAndOpenURL('javascript:alert(1)', persistFn, null);

      expect(window.location.href).toBe(originalHref);
    });

    it('works when bridge is null', async () => {
      const persistFn = vi.fn().mockResolvedValue(undefined);
      await expect(sp.saveAndOpenURL('https://example.com', persistFn, null)).resolves.toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // close()
  // ---------------------------------------------------------------------------

  describe('close', () => {
    it('closes the db and sets it to null', () => {
      sp.close();
      expect(db.close).toHaveBeenCalledTimes(1);
      expect(sp.db).toBeNull();
    });

    it('is safe when db is already null', () => {
      sp.db = null;
      expect(() => sp.close()).not.toThrow();
    });
  });
});
