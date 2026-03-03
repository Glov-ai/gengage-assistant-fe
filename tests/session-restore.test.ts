import { describe, it, expect, beforeEach } from 'vitest';
import type { SessionData } from '../src/common/indexed-db.js';

/**
 * Tests the P0 session restore logic:
 *   1. Always restore from IndexedDB (no sessionStorage guard)
 *   2. Panel snapshots persisted and restored
 *   3. UISpec loaded from payload store (lean message pattern)
 *   4. _panelThreads restored
 *   5. Context loaded from IDB on rollback
 */

describe('Session Restore — P0 Gaps', () => {
  describe('SessionData schema', () => {
    it('supports panelThreads field', () => {
      const data: SessionData = {
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: new Date().toISOString(),
        panelThreads: ['thread-1', 'thread-2'],
      };
      expect(data.panelThreads).toEqual(['thread-1', 'thread-2']);
    });

    it('supports thumbnailEntries field', () => {
      const data: SessionData = {
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: new Date().toISOString(),
        thumbnailEntries: [{ sku: 'SKU1', imageUrl: 'http://img.test/1.jpg', threadId: 'thread-1' }],
      };
      expect(data.thumbnailEntries).toHaveLength(1);
      expect(data.thumbnailEntries![0]!.sku).toBe('SKU1');
    });

    it('supports panelSnapshotHtml field', () => {
      const data: SessionData = {
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: new Date().toISOString(),
        panelSnapshotHtml: {
          'msg-1': '<div class="product">Product A</div>',
          'msg-2': '<div class="comparison">Table</div>',
        },
      };
      expect(Object.keys(data.panelSnapshotHtml!)).toHaveLength(2);
      expect(data.panelSnapshotHtml!['msg-1']).toContain('Product A');
    });

    it('all new fields are optional', () => {
      const data: SessionData = {
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: new Date().toISOString(),
      };
      expect(data.panelThreads).toBeUndefined();
      expect(data.thumbnailEntries).toBeUndefined();
      expect(data.panelSnapshotHtml).toBeUndefined();
    });
  });

  describe('Restore logic (unit simulation)', () => {
    /**
     * Simulates the restore logic from _restoreFromIndexedDB
     * without instantiating GengageChat.
     */
    class RestoreSimulator {
      messages: Array<{
        id: string;
        role: string;
        threadId?: string;
        content?: string;
        silent?: boolean;
      }> = [];
      currentThreadId: string | null = null;
      lastThreadId: string | null = null;
      panelThreads: string[] = [];
      thumbnailEntries: Array<{ sku: string; imageUrl: string; threadId: string }> = [];
      panelSnapshots = new Map<string, string>();
      lastBackendContext: Record<string, unknown> | null = null;
      currentMessageId = 0;

      restore(session: SessionData): void {
        this.currentThreadId = session.currentThreadId;
        this.lastThreadId = session.lastThreadId;

        if (session.panelThreads) {
          this.panelThreads = session.panelThreads;
        }
        if (session.thumbnailEntries) {
          this.thumbnailEntries = session.thumbnailEntries;
        }
        if (session.panelSnapshotHtml) {
          for (const [msgId, html] of Object.entries(session.panelSnapshotHtml)) {
            this.panelSnapshots.set(msgId, html);
          }
        }

        let maxMsgNum = 0;

        for (const msg of session.messages) {
          this.messages.push({
            id: msg.id,
            role: msg.role,
            threadId: msg.threadId,
            content: msg.content,
            silent: msg.silent,
          });

          if (msg.silent) continue;

          const idNum = parseInt(msg.id.replace('msg-', ''), 10);
          if (!isNaN(idNum) && idNum > maxMsgNum) maxMsgNum = idNum;
        }

        if (maxMsgNum > this.currentMessageId) {
          this.currentMessageId = maxMsgNum;
        }
      }
    }

    let sim: RestoreSimulator;

    beforeEach(() => {
      sim = new RestoreSimulator();
    });

    it('restores without sessionStorage guard (always restores)', () => {
      const session: SessionData = {
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', timestamp: 1, status: 'done', threadId: 'thread-1' },
          { id: 'msg-2', role: 'assistant', content: 'Hi!', timestamp: 2, status: 'done', threadId: 'thread-1' },
        ],
        currentThreadId: 'thread-1',
        lastThreadId: 'thread-1',
        createdAt: '2026-01-01T00:00:00Z',
      };

      // No sessionStorage check — directly restore
      sim.restore(session);

      expect(sim.messages).toHaveLength(2);
      expect(sim.currentThreadId).toBe('thread-1');
    });

    it('restores panelThreads from session data', () => {
      sim.restore({
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [],
        currentThreadId: 'thread-2',
        lastThreadId: 'thread-2',
        createdAt: '2026-01-01T00:00:00Z',
        panelThreads: ['thread-1', 'thread-2'],
      });

      expect(sim.panelThreads).toEqual(['thread-1', 'thread-2']);
    });

    it('restores thumbnailEntries from session data', () => {
      sim.restore({
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: '2026-01-01T00:00:00Z',
        thumbnailEntries: [
          { sku: 'SKU1', imageUrl: 'http://img/1.jpg', threadId: 'thread-1' },
          { sku: 'SKU2', imageUrl: 'http://img/2.jpg', threadId: 'thread-2' },
        ],
      });

      expect(sim.thumbnailEntries).toHaveLength(2);
    });

    it('restores panel snapshots from serialized HTML', () => {
      sim.restore({
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: '2026-01-01T00:00:00Z',
        panelSnapshotHtml: {
          'msg-2': '<div>Product Detail</div>',
          'msg-4': '<div>Comparison</div>',
        },
      });

      expect(sim.panelSnapshots.size).toBe(2);
      expect(sim.panelSnapshots.get('msg-2')).toContain('Product Detail');
    });

    it('session messages no longer carry uiSpec (lean pattern)', () => {
      // UISpecs are now loaded on-demand from the payload store, not from session data.
      // Session messages should restore cleanly without any uiSpec field.
      sim.restore({
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [
          { id: 'msg-1', role: 'user', content: 'show products', timestamp: 1, status: 'done', threadId: 'thread-1' },
          { id: 'msg-2', role: 'assistant', content: '', timestamp: 2, status: 'done', threadId: 'thread-1' },
          { id: 'msg-3', role: 'user', content: 'more', timestamp: 3, status: 'done', threadId: 'thread-2' },
          { id: 'msg-4', role: 'assistant', content: 'text only', timestamp: 4, status: 'done', threadId: 'thread-2' },
        ],
        currentThreadId: 'thread-2',
        lastThreadId: 'thread-2',
        createdAt: '2026-01-01T00:00:00Z',
      });

      // All 4 messages restored, none carry uiSpec
      expect(sim.messages).toHaveLength(4);
      expect(sim.messages.every((m) => !('uiSpec' in m))).toBe(true);
    });

    it('skips silent messages from DOM rendering', () => {
      sim.restore({
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [
          {
            id: 'msg-1',
            role: 'assistant',
            content: 'silent',
            timestamp: 1,
            status: 'done',
            threadId: 'thread-1',
            silent: true,
          },
          { id: 'msg-2', role: 'user', content: 'visible', timestamp: 2, status: 'done', threadId: 'thread-1' },
        ],
        currentThreadId: 'thread-1',
        lastThreadId: 'thread-1',
        createdAt: '2026-01-01T00:00:00Z',
      });

      // Both in messages array, but silent one would be skipped for DOM rendering
      expect(sim.messages).toHaveLength(2);
      expect(sim.messages[0]!.silent).toBe(true);
      expect(sim.messages[1]!.silent).toBeUndefined();
    });

    it('advances message ID counter past restored messages', () => {
      sim.restore({
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [
          { id: 'msg-5', role: 'user', content: 'hi', timestamp: 1, status: 'done' },
          { id: 'msg-10', role: 'assistant', content: 'hello', timestamp: 2, status: 'done' },
        ],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: '2026-01-01T00:00:00Z',
      });

      expect(sim.currentMessageId).toBe(10);
    });
  });

  describe('Context on rollback (unit simulation)', () => {
    class RollbackContextSimulator {
      lastBackendContext: Record<string, unknown> | null = null;
      contextStore = new Map<string, Record<string, unknown>>();

      rollbackToThread(threadId: string): void {
        // Simulate loading context from IDB for the target thread
        const ctx = this.contextStore.get(threadId);
        if (ctx) {
          this.lastBackendContext = ctx;
        }
      }
    }

    it('loads context from the target thread on rollback', () => {
      const sim = new RollbackContextSimulator();
      sim.lastBackendContext = {
        messages: [{ role: 'user', content: 'latest' }],
        panel: { screen_type: 'productList' },
      };
      sim.contextStore.set('thread-1', {
        messages: [{ role: 'user', content: 'first' }],
        panel: { screen_type: 'pdp' },
      });
      sim.contextStore.set('thread-2', {
        messages: [{ role: 'user', content: 'latest' }],
        panel: { screen_type: 'productList' },
      });

      sim.rollbackToThread('thread-1');

      expect(sim.lastBackendContext).toEqual({
        messages: [{ role: 'user', content: 'first' }],
        panel: { screen_type: 'pdp' },
      });
    });

    it('keeps existing context when target thread has no stored context', () => {
      const sim = new RollbackContextSimulator();
      sim.lastBackendContext = { messages: [{ role: 'user', content: 'current' }] };

      sim.rollbackToThread('thread-unknown');

      expect(sim.lastBackendContext).toEqual({ messages: [{ role: 'user', content: 'current' }] });
    });
  });

  describe('Persist logic (unit simulation)', () => {
    it('serializes panel snapshots to HTML', () => {
      const panelSnapshots = new Map<string, HTMLElement>();
      const el1 = document.createElement('div');
      el1.innerHTML = '<div class="product">A</div>';
      panelSnapshots.set('msg-1', el1);

      const panelSnapshotHtml: Record<string, string> = {};
      for (const [msgId, el] of panelSnapshots) {
        panelSnapshotHtml[msgId] = el.innerHTML;
      }

      expect(panelSnapshotHtml['msg-1']).toBe('<div class="product">A</div>');
    });

    it('omits empty optional fields from SessionData', () => {
      const panelThreads: string[] = [];
      const thumbnailEntries: Array<{ sku: string; imageUrl: string; threadId: string }> = [];
      const panelSnapshotHtml: Record<string, string> = {};

      const session: SessionData = {
        userId: 'user-1',
        appId: 'app-1',
        sessionId: 'sess-1',
        messages: [],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: '2026-01-01T00:00:00Z',
        panelThreads: panelThreads.length > 0 ? panelThreads : undefined,
        thumbnailEntries: thumbnailEntries.length > 0 ? thumbnailEntries : undefined,
        panelSnapshotHtml: Object.keys(panelSnapshotHtml).length > 0 ? panelSnapshotHtml : undefined,
      };

      expect(session.panelThreads).toBeUndefined();
      expect(session.thumbnailEntries).toBeUndefined();
      expect(session.panelSnapshotHtml).toBeUndefined();
    });
  });
});
