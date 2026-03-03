import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { GengageIndexedDB } from '../src/common/indexed-db.js';
import type { SessionData, ContextData, PayloadData } from '../src/common/indexed-db.js';

describe('GengageIndexedDB', () => {
  let db: GengageIndexedDB;

  // Use a unique DB name per test to avoid cross-test contamination
  let testCounter = 0;
  function uniqueDbName(): string {
    return `gengage_test_${++testCounter}_${Date.now()}`;
  }

  beforeEach(async () => {
    db = new GengageIndexedDB(uniqueDbName());
    await db.open();
  });

  afterEach(() => {
    db.close();
  });

  // ---------------------------------------------------------------------------
  // open
  // ---------------------------------------------------------------------------

  it('creates all three object stores', async () => {
    const freshDb = new GengageIndexedDB(uniqueDbName());
    const idb = await freshDb.open();
    expect(idb.objectStoreNames.contains('sessions')).toBe(true);
    expect(idb.objectStoreNames.contains('context')).toBe(true);
    expect(idb.objectStoreNames.contains('payload')).toBe(true);
    freshDb.close();
  });

  it('returns the same db on second open() call', async () => {
    const db1 = await db.open();
    const db2 = await db.open();
    expect(db1).toBe(db2);
  });

  // ---------------------------------------------------------------------------
  // sessions (compound key: [userId, appId, sessionId])
  // ---------------------------------------------------------------------------

  it('saveSession + loadSession roundtrip', async () => {
    const session: SessionData = {
      userId: 'user-1',
      appId: 'app-1',
      sessionId: 'sess-001',
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Hello',
          timestamp: 1000,
          status: 'done',
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Hi there',
          timestamp: 1001,
          status: 'done',
          threadId: 'thread-1',
        },
      ],
      currentThreadId: 'thread-1',
      lastThreadId: 'thread-1',
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    await db.saveSession(session);
    const loaded = await db.loadSession('user-1', 'app-1', 'sess-001');

    expect(loaded).not.toBeNull();
    expect(loaded!.userId).toBe('user-1');
    expect(loaded!.appId).toBe('app-1');
    expect(loaded!.sessionId).toBe('sess-001');
    expect(loaded!.messages).toHaveLength(2);
    expect(loaded!.messages[0]!.content).toBe('Hello');
    expect(loaded!.messages[1]!.threadId).toBe('thread-1');
    expect(loaded!.currentThreadId).toBe('thread-1');
    expect(loaded!.lastThreadId).toBe('thread-1');
    expect(loaded!.createdAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('loadSession returns null for non-existent session', async () => {
    const result = await db.loadSession('user-x', 'app-x', 'does-not-exist');
    expect(result).toBeNull();
  });

  it('saveSession overwrites existing session', async () => {
    const session1: SessionData = {
      userId: 'user-1',
      appId: 'app-1',
      sessionId: 'sess-002',
      messages: [{ id: 'msg-1', role: 'user', content: 'v1', timestamp: 1, status: 'done' }],
      currentThreadId: null,
      lastThreadId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    await db.saveSession(session1);

    const session2: SessionData = {
      ...session1,
      messages: [
        { id: 'msg-1', role: 'user', content: 'v1', timestamp: 1, status: 'done' },
        { id: 'msg-2', role: 'assistant', content: 'v2', timestamp: 2, status: 'done' },
      ],
      currentThreadId: 'thread-x',
    };
    await db.saveSession(session2);

    const loaded = await db.loadSession('user-1', 'app-1', 'sess-002');
    expect(loaded!.messages).toHaveLength(2);
    expect(loaded!.currentThreadId).toBe('thread-x');
  });

  it('sessions are scoped by userId + appId (no collisions)', async () => {
    const baseSession: Omit<SessionData, 'userId' | 'appId'> = {
      sessionId: 'shared-sess',
      messages: [],
      currentThreadId: null,
      lastThreadId: null,
      createdAt: '2025-01-01T00:00:00.000Z',
    };

    await db.saveSession({ ...baseSession, userId: 'alice', appId: 'store-a' });
    await db.saveSession({
      ...baseSession,
      userId: 'bob',
      appId: 'store-a',
      currentThreadId: 'thread-bob',
    });
    await db.saveSession({
      ...baseSession,
      userId: 'alice',
      appId: 'store-b',
      currentThreadId: 'thread-alice-b',
    });

    const alice_a = await db.loadSession('alice', 'store-a', 'shared-sess');
    const bob_a = await db.loadSession('bob', 'store-a', 'shared-sess');
    const alice_b = await db.loadSession('alice', 'store-b', 'shared-sess');
    const nobody = await db.loadSession('charlie', 'store-a', 'shared-sess');

    expect(alice_a).not.toBeNull();
    expect(alice_a!.currentThreadId).toBeNull();

    expect(bob_a).not.toBeNull();
    expect(bob_a!.currentThreadId).toBe('thread-bob');

    expect(alice_b).not.toBeNull();
    expect(alice_b!.currentThreadId).toBe('thread-alice-b');

    expect(nobody).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // context (compound key: [sessionId, threadId])
  // ---------------------------------------------------------------------------

  it('saveContext + loadContext roundtrip with compound key', async () => {
    const ctx: ContextData = {
      sessionId: 'sess-001',
      threadId: 'thread-abc',
      context: { panel: { type: 'product' }, messages: [{ role: 'user', content: 'hi' }] },
    };

    await db.saveContext(ctx);
    const loaded = await db.loadContext('sess-001', 'thread-abc');

    expect(loaded).not.toBeNull();
    expect(loaded!.sessionId).toBe('sess-001');
    expect(loaded!.threadId).toBe('thread-abc');
    expect(loaded!.context).toEqual({
      panel: { type: 'product' },
      messages: [{ role: 'user', content: 'hi' }],
    });
  });

  it('loadContext returns null for non-existent compound key', async () => {
    const result = await db.loadContext('sess-999', 'thread-999');
    expect(result).toBeNull();
  });

  it('loadContext distinguishes different sessions with same threadId', async () => {
    await db.saveContext({
      sessionId: 'sess-A',
      threadId: 'thread-1',
      context: { source: 'A' },
    });
    await db.saveContext({
      sessionId: 'sess-B',
      threadId: 'thread-1',
      context: { source: 'B' },
    });

    const a = await db.loadContext('sess-A', 'thread-1');
    const b = await db.loadContext('sess-B', 'thread-1');
    expect(a!.context).toEqual({ source: 'A' });
    expect(b!.context).toEqual({ source: 'B' });
  });

  it('deleteContextsAfterThread removes later threads only', async () => {
    // Use UUIDv7-like strings that are lexicographically sortable
    await db.saveContext({ sessionId: 's1', threadId: '01900000-0000-7000-8000-000000000001', context: { n: 1 } });
    await db.saveContext({ sessionId: 's1', threadId: '01900000-0000-7000-8000-000000000002', context: { n: 2 } });
    await db.saveContext({ sessionId: 's1', threadId: '01900000-0000-7000-8000-000000000003', context: { n: 3 } });
    await db.saveContext({ sessionId: 's1', threadId: '01900000-0000-7000-8000-000000000004', context: { n: 4 } });

    // Delete everything after thread 2
    await db.deleteContextsAfterThread('s1', '01900000-0000-7000-8000-000000000002');

    const ctx1 = await db.loadContext('s1', '01900000-0000-7000-8000-000000000001');
    const ctx2 = await db.loadContext('s1', '01900000-0000-7000-8000-000000000002');
    const ctx3 = await db.loadContext('s1', '01900000-0000-7000-8000-000000000003');
    const ctx4 = await db.loadContext('s1', '01900000-0000-7000-8000-000000000004');

    expect(ctx1).not.toBeNull();
    expect(ctx2).not.toBeNull();
    expect(ctx3).toBeNull();
    expect(ctx4).toBeNull();
  });

  it('deleteContextsAfterThread does not affect other sessions', async () => {
    await db.saveContext({ sessionId: 's1', threadId: 'thread-a', context: { n: 1 } });
    await db.saveContext({ sessionId: 's1', threadId: 'thread-b', context: { n: 2 } });
    await db.saveContext({ sessionId: 's2', threadId: 'thread-b', context: { n: 3 } });

    await db.deleteContextsAfterThread('s1', 'thread-a');

    // s1/thread-b should be deleted, but s2/thread-b should remain
    expect(await db.loadContext('s1', 'thread-a')).not.toBeNull();
    expect(await db.loadContext('s1', 'thread-b')).toBeNull();
    expect(await db.loadContext('s2', 'thread-b')).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // loadLatestContext
  // ---------------------------------------------------------------------------

  it('loadLatestContext returns the context with the latest threadId', async () => {
    await db.saveContext({ sessionId: 's1', threadId: '01900000-0000-7000-8000-000000000001', context: { n: 1 } });
    await db.saveContext({ sessionId: 's1', threadId: '01900000-0000-7000-8000-000000000003', context: { n: 3 } });
    await db.saveContext({ sessionId: 's1', threadId: '01900000-0000-7000-8000-000000000002', context: { n: 2 } });

    const latest = await db.loadLatestContext('s1');
    expect(latest).not.toBeNull();
    expect(latest!.threadId).toBe('01900000-0000-7000-8000-000000000003');
    expect(latest!.context).toEqual({ n: 3 });
  });

  it('loadLatestContext returns null for session with no contexts', async () => {
    const result = await db.loadLatestContext('nonexistent-session');
    expect(result).toBeNull();
  });

  it('loadLatestContext does not return contexts from other sessions', async () => {
    await db.saveContext({ sessionId: 's1', threadId: '01900000-0000-7000-8000-000000000001', context: { n: 1 } });
    await db.saveContext({ sessionId: 's2', threadId: '01900000-0000-7000-8000-000000000099', context: { n: 99 } });

    const latest = await db.loadLatestContext('s1');
    expect(latest).not.toBeNull();
    expect(latest!.sessionId).toBe('s1');
    expect(latest!.threadId).toBe('01900000-0000-7000-8000-000000000001');
  });

  // ---------------------------------------------------------------------------
  // payload (compound key: [threadId, messageId])
  // ---------------------------------------------------------------------------

  it('savePayload + loadPayload roundtrip', async () => {
    const payload: PayloadData = {
      threadId: 'thread-1',
      messageId: 'msg-42',
      uiSpec: {
        root: 'root',
        elements: {
          root: {
            type: 'ProductCard',
            props: { sku: 'ABC123', name: 'Widget' },
          },
        },
      },
    };

    await db.savePayload(payload);
    const loaded = await db.loadPayload('thread-1', 'msg-42');

    expect(loaded).not.toBeNull();
    expect(loaded!.threadId).toBe('thread-1');
    expect(loaded!.messageId).toBe('msg-42');
    expect(loaded!.uiSpec.root).toBe('root');
    expect(loaded!.uiSpec.elements['root']!.type).toBe('ProductCard');
    expect(loaded!.uiSpec.elements['root']!.props).toEqual({ sku: 'ABC123', name: 'Widget' });
  });

  it('loadPayload returns null for non-existent compound key', async () => {
    const result = await db.loadPayload('thread-x', 'msg-nonexistent');
    expect(result).toBeNull();
  });

  it('loadPayload distinguishes different threads with same messageId', async () => {
    await db.savePayload({
      threadId: 'thread-a',
      messageId: 'msg-1',
      uiSpec: { root: 'r', elements: { r: { type: 'Text', props: { text: 'from-a' } } } },
    });
    await db.savePayload({
      threadId: 'thread-b',
      messageId: 'msg-1',
      uiSpec: { root: 'r', elements: { r: { type: 'Text', props: { text: 'from-b' } } } },
    });

    const a = await db.loadPayload('thread-a', 'msg-1');
    const b = await db.loadPayload('thread-b', 'msg-1');
    expect(a!.uiSpec.elements['r']!.props).toEqual({ text: 'from-a' });
    expect(b!.uiSpec.elements['r']!.props).toEqual({ text: 'from-b' });
  });

  // ---------------------------------------------------------------------------
  // loadPayloadsByThread
  // ---------------------------------------------------------------------------

  it('loadPayloadsByThread returns all payloads for a given thread', async () => {
    await db.savePayload({
      threadId: 'thread-1',
      messageId: 'msg-a',
      uiSpec: { root: 'r', elements: { r: { type: 'Text', props: { text: 'a' } } } },
    });
    await db.savePayload({
      threadId: 'thread-1',
      messageId: 'msg-b',
      uiSpec: { root: 'r', elements: { r: { type: 'Text', props: { text: 'b' } } } },
    });
    await db.savePayload({
      threadId: 'thread-2',
      messageId: 'msg-c',
      uiSpec: { root: 'r', elements: { r: { type: 'Text', props: { text: 'c' } } } },
    });

    const results = await db.loadPayloadsByThread('thread-1');
    expect(results).toHaveLength(2);

    const messageIds = results.map((p) => p.messageId).sort();
    expect(messageIds).toEqual(['msg-a', 'msg-b']);
  });

  it('loadPayloadsByThread returns empty array for unknown thread', async () => {
    const results = await db.loadPayloadsByThread('nonexistent-thread');
    expect(results).toEqual([]);
  });

  it('loadPayloadsByThread does not include payloads from other threads', async () => {
    await db.savePayload({
      threadId: 'thread-x',
      messageId: 'msg-1',
      uiSpec: { root: 'r', elements: { r: { type: 'Text', props: { text: 'x' } } } },
    });
    await db.savePayload({
      threadId: 'thread-y',
      messageId: 'msg-2',
      uiSpec: { root: 'r', elements: { r: { type: 'Text', props: { text: 'y' } } } },
    });

    const results = await db.loadPayloadsByThread('thread-x');
    expect(results).toHaveLength(1);
    expect(results[0]!.messageId).toBe('msg-1');
  });

  // ---------------------------------------------------------------------------
  // close
  // ---------------------------------------------------------------------------

  it('close() does not throw', () => {
    expect(() => db.close()).not.toThrow();
  });

  it('close() on already-closed db does not throw', () => {
    db.close();
    expect(() => db.close()).not.toThrow();
  });

  // ---------------------------------------------------------------------------
  // error handling
  // ---------------------------------------------------------------------------

  it('throws when calling methods without open()', async () => {
    const closedDb = new GengageIndexedDB(uniqueDbName());
    await expect(
      closedDb.saveSession({
        userId: 'u',
        appId: 'a',
        sessionId: 'x',
        messages: [],
        currentThreadId: null,
        lastThreadId: null,
        createdAt: '',
      }),
    ).rejects.toThrow('database not open');
  });
});
