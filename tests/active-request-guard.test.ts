import { describe, it, expect } from 'vitest';

/**
 * Tests the active request guard pattern used in GengageChat._sendAction().
 *
 * The guard prevents stale stream events from being processed after a new
 * request supersedes the previous one. Each request generates a unique threadId
 * and sets _activeRequestThreadId. Callbacks check their closure threadId
 * against the instance _activeRequestThreadId and silently drop mismatches.
 */

describe('Active Request Guard Pattern', () => {
  // Simulate the guard logic in isolation (without instantiating GengageChat)
  class RequestGuardSimulator {
    activeRequestThreadId: string | null = null;
    processed: string[] = [];

    startRequest(threadId: string): {
      onTextChunk: (text: string) => void;
      onUISpec: (data: string) => void;
      onAction: (data: string) => void;
      onMetadata: (data: string) => void;
      onDone: () => void;
      onError: (msg: string) => void;
    } {
      this.activeRequestThreadId = threadId;

      return {
        onTextChunk: (text: string) => {
          if (threadId !== this.activeRequestThreadId) return;
          this.processed.push(`text:${text}`);
        },
        onUISpec: (data: string) => {
          if (threadId !== this.activeRequestThreadId) return;
          this.processed.push(`ui:${data}`);
        },
        onAction: (data: string) => {
          if (threadId !== this.activeRequestThreadId) return;
          this.processed.push(`action:${data}`);
        },
        onMetadata: (data: string) => {
          if (threadId !== this.activeRequestThreadId) return;
          this.processed.push(`meta:${data}`);
        },
        onDone: () => {
          // Skip cleanup for superseded requests
          if (threadId !== this.activeRequestThreadId && this.activeRequestThreadId !== null) return;
          this.activeRequestThreadId = null;
          this.processed.push('done');
        },
        onError: (msg: string) => {
          // Skip error handling for superseded requests
          if (threadId !== this.activeRequestThreadId && this.activeRequestThreadId !== null) return;
          this.activeRequestThreadId = null;
          this.processed.push(`error:${msg}`);
        },
      };
    }
  }

  it('processes events when threadId matches', () => {
    const sim = new RequestGuardSimulator();
    const callbacks = sim.startRequest('thread-1');

    callbacks.onTextChunk('hello');
    callbacks.onUISpec('card');
    callbacks.onAction('click');
    callbacks.onMetadata('ctx');

    expect(sim.processed).toEqual(['text:hello', 'ui:card', 'action:click', 'meta:ctx']);
  });

  it('drops events when threadId does not match (new request started)', () => {
    const sim = new RequestGuardSimulator();
    const oldCallbacks = sim.startRequest('thread-1');
    sim.startRequest('thread-2');

    // Old callbacks should be dropped
    oldCallbacks.onTextChunk('stale');
    oldCallbacks.onUISpec('stale');
    oldCallbacks.onAction('stale');
    oldCallbacks.onMetadata('stale');

    expect(sim.processed).toEqual([]);
  });

  it('new request replaces active request ID', () => {
    const sim = new RequestGuardSimulator();
    sim.startRequest('thread-1');
    expect(sim.activeRequestThreadId).toBe('thread-1');

    sim.startRequest('thread-2');
    expect(sim.activeRequestThreadId).toBe('thread-2');
  });

  it('onDone clears active request ID', () => {
    const sim = new RequestGuardSimulator();
    const callbacks = sim.startRequest('thread-1');

    callbacks.onDone();
    expect(sim.activeRequestThreadId).toBeNull();
  });

  it('events after onDone are dropped', () => {
    const sim = new RequestGuardSimulator();
    const callbacks = sim.startRequest('thread-1');

    callbacks.onDone();
    callbacks.onTextChunk('late');
    callbacks.onUISpec('late');

    expect(sim.processed).toEqual(['done']);
  });

  it('concurrent requests — only latest receives events', () => {
    const sim = new RequestGuardSimulator();
    const req1 = sim.startRequest('thread-1');
    const req2 = sim.startRequest('thread-2');

    req1.onTextChunk('from-1');
    req2.onTextChunk('from-2');

    expect(sim.processed).toEqual(['text:from-2']);
  });

  it('onDone for superseded request does not clear activeRequestThreadId', () => {
    const sim = new RequestGuardSimulator();
    const req1 = sim.startRequest('thread-1');
    sim.startRequest('thread-2');

    req1.onDone();
    expect(sim.activeRequestThreadId).toBe('thread-2');
  });

  it('onDone for superseded request does not trigger processed events', () => {
    const sim = new RequestGuardSimulator();
    const req1 = sim.startRequest('thread-1');
    sim.startRequest('thread-2');

    req1.onDone();
    expect(sim.processed).not.toContain('done');
  });

  it('onError for superseded request is silently dropped', () => {
    const sim = new RequestGuardSimulator();
    const req1 = sim.startRequest('thread-1');
    sim.startRequest('thread-2');

    req1.onError('fail');
    expect(sim.processed).toEqual([]);
    expect(sim.activeRequestThreadId).toBe('thread-2');
  });

  it('onDone still works for active request', () => {
    const sim = new RequestGuardSimulator();
    const req1 = sim.startRequest('thread-1');

    req1.onDone();
    expect(sim.processed).toContain('done');
    expect(sim.activeRequestThreadId).toBeNull();
  });

  it('onError still works for active request', () => {
    const sim = new RequestGuardSimulator();
    const req1 = sim.startRequest('thread-1');

    req1.onError('network failure');
    expect(sim.processed).toContain('error:network failure');
    expect(sim.activeRequestThreadId).toBeNull();
  });
});
