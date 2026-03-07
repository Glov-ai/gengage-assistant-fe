import { describe, it, expect, vi } from 'vitest';
import { SessionPersistence } from '../src/chat/session-persistence.js';
import type { GengageIndexedDB } from '../src/common/indexed-db.js';
import type { PersistSessionParams } from '../src/chat/session-persistence.js';

function makeMockDB(saveSpy: ReturnType<typeof vi.fn>): GengageIndexedDB {
  return {
    saveSession: saveSpy,
    saveContext: vi.fn().mockResolvedValue(undefined),
    savePayload: vi.fn().mockResolvedValue(undefined),
    loadPayload: vi.fn().mockResolvedValue(null),
    loadFavorites: vi.fn().mockResolvedValue([]),
    saveFavorite: vi.fn().mockResolvedValue(undefined),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  } as unknown as GengageIndexedDB;
}

function makeParams(id: string): PersistSessionParams {
  return {
    userId: 'u1',
    appId: 'a1',
    sessionId: 's1',
    messages: [
      {
        id,
        role: 'user' as const,
        content: `msg-${id}`,
        timestamp: Date.now(),
        status: 'done' as const,
      },
    ],
    currentThreadId: null,
    lastThreadId: null,
    chatCreatedAt: new Date().toISOString(),
    panelSnapshots: new Map(),
    panelThreads: [],
    thumbnailEntries: [],
    lastBackendContext: null,
  };
}

describe('SessionPersistence mutex', () => {
  it('serializes concurrent persist() calls', async () => {
    const callOrder: string[] = [];

    const saveSpy = vi.fn().mockImplementation(async (data: { messages: Array<{ id: string }> }) => {
      const id = data.messages[0]!.id;
      callOrder.push(`start:${id}`);
      await new Promise((r) => setTimeout(r, 10));
      callOrder.push(`end:${id}`);
    });

    const db = makeMockDB(saveSpy);
    const persistence = new SessionPersistence(db);

    // Fire 3 concurrent persist calls
    const p1 = persistence.persist(makeParams('A'));
    const p2 = persistence.persist(makeParams('B'));
    const p3 = persistence.persist(makeParams('C'));

    await Promise.all([p1, p2, p3]);

    // Without mutex, we'd see: start:A, start:B, start:C, end:A, end:B, end:C
    // With mutex, each call completes before the next starts:
    expect(callOrder).toEqual(['start:A', 'end:A', 'start:B', 'end:B', 'start:C', 'end:C']);
  });

  it('does not deadlock when persist() throws', async () => {
    let callCount = 0;
    const saveSpy = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) throw new Error('IDB write error');
    });

    const db = makeMockDB(saveSpy);
    const persistence = new SessionPersistence(db);

    // First call throws, second should still proceed
    const p1 = persistence.persist(makeParams('A')).catch(() => {});
    const p2 = persistence.persist(makeParams('B'));

    await Promise.all([p1, p2]);
    expect(saveSpy).toHaveBeenCalledTimes(2);
  });

  it('skips persist when db is null', async () => {
    const persistence = new SessionPersistence(null);
    // Should not throw
    await persistence.persist(makeParams('X'));
  });
});
