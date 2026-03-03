import { describe, it, expect } from 'vitest';

/**
 * Simulates the deferred init queue behavior from GengageChat._sendAction.
 * Mirrors the queue/gate logic without requiring a full widget instantiation.
 */
class DeferredInitSimulator {
  initComplete = false;
  pendingActions: Array<{
    action: { type: string; payload: Record<string, unknown> };
    options?: { silent?: boolean };
  }> = [];
  executedActions: Array<{ type: string; payload: Record<string, unknown> }> = [];

  sendAction(action: { type: string; payload: Record<string, unknown> }, options?: { silent?: boolean }): void {
    if (!this.initComplete) {
      if (this.pendingActions.length < 10) {
        this.pendingActions.push({ action, options });
      }
      return;
    }
    this.executedActions.push(action);
  }

  completeInit(): void {
    this.initComplete = true;
    for (const pending of this.pendingActions) {
      this.sendAction(pending.action, pending.options);
    }
    this.pendingActions = [];
  }
}

describe('Deferred Init Queue', () => {
  it('queues actions before init completes', () => {
    const sim = new DeferredInitSimulator();
    sim.sendAction({ type: 'chat', payload: { text: 'hello' } });
    sim.sendAction({ type: 'chat', payload: { text: 'world' } });

    expect(sim.pendingActions).toHaveLength(2);
    expect(sim.executedActions).toHaveLength(0);
  });

  it('drains queue in order after init completes', () => {
    const sim = new DeferredInitSimulator();
    sim.sendAction({ type: 'chat', payload: { text: 'first' } });
    sim.sendAction({ type: 'chat', payload: { text: 'second' } });
    sim.sendAction({ type: 'chat', payload: { text: 'third' } });

    sim.completeInit();

    expect(sim.pendingActions).toHaveLength(0);
    expect(sim.executedActions).toHaveLength(3);
    expect(sim.executedActions[0]!.payload).toEqual({ text: 'first' });
    expect(sim.executedActions[1]!.payload).toEqual({ text: 'second' });
    expect(sim.executedActions[2]!.payload).toEqual({ text: 'third' });
  });

  it('caps queue at 10 items (FIFO discard)', () => {
    const sim = new DeferredInitSimulator();
    for (let i = 0; i < 15; i++) {
      sim.sendAction({ type: 'chat', payload: { text: `msg-${i}` } });
    }

    expect(sim.pendingActions).toHaveLength(10);
    // Only first 10 are kept
    expect(sim.pendingActions[0]!.action.payload).toEqual({ text: 'msg-0' });
    expect(sim.pendingActions[9]!.action.payload).toEqual({ text: 'msg-9' });

    sim.completeInit();
    expect(sim.executedActions).toHaveLength(10);
  });

  it('executes actions immediately after init completes', () => {
    const sim = new DeferredInitSimulator();
    sim.completeInit();

    sim.sendAction({ type: 'chat', payload: { text: 'immediate' } });

    expect(sim.pendingActions).toHaveLength(0);
    expect(sim.executedActions).toHaveLength(1);
    expect(sim.executedActions[0]!.payload).toEqual({ text: 'immediate' });
  });

  it('preserves options through the queue', () => {
    const sim = new DeferredInitSimulator();
    sim.sendAction({ type: 'chat', payload: { text: 'silent' } }, { silent: true });

    expect(sim.pendingActions[0]!.options).toEqual({ silent: true });

    sim.completeInit();
    // Options should have been passed through
    expect(sim.executedActions).toHaveLength(1);
  });
});
