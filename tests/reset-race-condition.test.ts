/**
 * Tests that _resetForNewPage invalidates in-flight stream callbacks.
 *
 * The pattern: stream callbacks check `threadId !== this._activeRequestThreadId`
 * before touching DOM. When _resetForNewPage sets _activeRequestThreadId = null,
 * any queued callback with a non-null threadId is discarded.
 */

import { describe, it, expect, vi } from 'vitest';
import { uuidv7 } from '../src/common/uuidv7.js';

/**
 * Minimal simulation of the race-condition guard pattern used in GengageChat.
 * Extracted from src/chat/index.ts to test independently of DOM.
 */
class StreamGuard {
  activeRequestThreadId: string | null = null;
  drawerCalls: string[] = [];

  startRequest(): string {
    const threadId = uuidv7();
    this.activeRequestThreadId = threadId;
    return threadId;
  }

  resetForNewPage(): void {
    this.activeRequestThreadId = null;
  }

  /** Simulates a stream callback — returns true if it was discarded. */
  handleCallback(threadId: string, isPreservePanel: boolean): boolean {
    if (!isPreservePanel && threadId !== this.activeRequestThreadId) return true;
    this.drawerCalls.push(`callback:${threadId.slice(-4)}`);
    return false;
  }
}

describe('Reset vs in-flight stream race condition', () => {
  it('callbacks are discarded after resetForNewPage', () => {
    const guard = new StreamGuard();

    // Start a request — callbacks will capture this threadId
    const threadId = guard.startRequest();
    expect(guard.handleCallback(threadId, false)).toBe(false);

    // Simulate page navigation — reset invalidates the thread
    guard.resetForNewPage();

    // Queued callback from old stream fires after reset — should be discarded
    expect(guard.handleCallback(threadId, false)).toBe(true);
    expect(guard.drawerCalls).toHaveLength(1);
  });

  it('new request after reset accepts its own callbacks', () => {
    const guard = new StreamGuard();

    const oldThreadId = guard.startRequest();
    guard.resetForNewPage();
    const newThreadId = guard.startRequest();

    // Old callback discarded
    expect(guard.handleCallback(oldThreadId, false)).toBe(true);
    // New callback accepted
    expect(guard.handleCallback(newThreadId, false)).toBe(false);
  });

  it('preservePanel callbacks are not discarded by reset', () => {
    const guard = new StreamGuard();

    const threadId = guard.startRequest();
    guard.resetForNewPage();

    // preservePanel callbacks (like/addToCart) skip the thread guard
    expect(guard.handleCallback(threadId, true)).toBe(false);
  });

  it('rapid page changes discard all prior callbacks', () => {
    const guard = new StreamGuard();
    const threads: string[] = [];

    // Simulate 3 rapid SKU changes
    for (let i = 0; i < 3; i++) {
      threads.push(guard.startRequest());
      guard.resetForNewPage();
    }
    const finalThread = guard.startRequest();

    // All old threads are discarded
    for (const t of threads) {
      expect(guard.handleCallback(t, false)).toBe(true);
    }
    // Only the final thread's callbacks proceed
    expect(guard.handleCallback(finalThread, false)).toBe(false);
  });

  it('onDone callback is discarded after reset', () => {
    const guard = new StreamGuard();
    const onDone = vi.fn();

    const threadId = guard.startRequest();
    guard.resetForNewPage();

    // Simulate onDone callback with thread guard
    if (threadId !== guard.activeRequestThreadId) {
      // discarded
    } else {
      onDone();
    }

    expect(onDone).not.toHaveBeenCalled();
  });
});
