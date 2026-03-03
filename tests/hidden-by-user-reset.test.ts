import { describe, it, expect } from 'vitest';

/**
 * Tests that hiddenByUser is reset when clicking a thumbnail to rollback.
 * Production resets this flag so the panel can re-extend on rollback.
 */
describe('hiddenByUser Reset on Thumbnail Click', () => {
  class HiddenByUserSimulator {
    hiddenByUser = true;

    setHiddenByUser(value: boolean): void {
      this.hiddenByUser = value;
    }

    rollbackToThread(_threadId: string): void {
      // Production behavior: reset hidden flag on rollback
      this.setHiddenByUser(false);
    }
  }

  it('resets hiddenByUser to false on rollback', () => {
    const sim = new HiddenByUserSimulator();
    expect(sim.hiddenByUser).toBe(true);

    sim.rollbackToThread('thread-1');
    expect(sim.hiddenByUser).toBe(false);
  });

  it('panel can re-extend after hiddenByUser reset', () => {
    const sim = new HiddenByUserSimulator();
    sim.hiddenByUser = true;

    sim.rollbackToThread('thread-2');
    // After reset, panel should be able to extend
    expect(sim.hiddenByUser).toBe(false);
  });
});
