import { describe, it, expect } from 'vitest';

/**
 * Tests the thinking step accumulation pattern used in the ChatDrawer
 * typing indicator (#26 from GAPS.md).
 *
 * The backend sends multiple `loading` events during streaming. Each one
 * becomes a thinking step rendered as a checklist:
 *   ✓ Found 15 products
 *   ✓ Analyzing features
 *   ● Ranking...
 *
 * Completed steps (all but the last) show ✓, the current/last step shows ●.
 */
describe('Thinking Step Messages', () => {
  /** Lightweight simulator matching ChatDrawer's accumulation logic. */
  class ThinkingStepsSimulator {
    steps: string[] = [];

    addStep(text: string): void {
      this.steps.push(text);
    }

    getRenderedSteps(): Array<{ text: string; marker: string }> {
      return this.steps.map((text, i) => ({
        text,
        marker: i < this.steps.length - 1 ? '\u2713' : '\u25CF',
      }));
    }

    clear(): void {
      this.steps = [];
    }
  }

  it('accumulates thinking steps', () => {
    const sim = new ThinkingStepsSimulator();
    sim.addStep('Searching products...');
    sim.addStep('Found 15 products');
    sim.addStep('Analyzing features...');

    expect(sim.steps).toHaveLength(3);
  });

  it('marks completed steps with checkmark', () => {
    const sim = new ThinkingStepsSimulator();
    sim.addStep('Found 15 products');
    sim.addStep('Analyzing');
    sim.addStep('Ranking...');

    const rendered = sim.getRenderedSteps();
    expect(rendered[0]!.marker).toBe('\u2713'); // ✓
    expect(rendered[1]!.marker).toBe('\u2713'); // ✓
    expect(rendered[2]!.marker).toBe('\u25CF'); // ●
  });

  it('last step is always marked as active', () => {
    const sim = new ThinkingStepsSimulator();
    sim.addStep('Step 1');

    const rendered = sim.getRenderedSteps();
    expect(rendered[0]!.marker).toBe('\u25CF'); // ●
  });

  it('clears steps on reset', () => {
    const sim = new ThinkingStepsSimulator();
    sim.addStep('Step 1');
    sim.addStep('Step 2');

    sim.clear();
    expect(sim.steps).toHaveLength(0);
  });

  it('single step shows as active, not done', () => {
    const sim = new ThinkingStepsSimulator();
    sim.addStep('Thinking...');

    const rendered = sim.getRenderedSteps();
    expect(rendered).toHaveLength(1);
    expect(rendered[0]!.marker).toBe('\u25CF'); // ●
    expect(rendered[0]!.text).toBe('Thinking...');
  });

  it('promotes previously-active step to done when new step arrives', () => {
    const sim = new ThinkingStepsSimulator();
    sim.addStep('Searching...');

    // First step is active
    expect(sim.getRenderedSteps()[0]!.marker).toBe('\u25CF');

    sim.addStep('Found 12 products');

    // First step is now done, second is active
    const rendered = sim.getRenderedSteps();
    expect(rendered[0]!.marker).toBe('\u2713');
    expect(rendered[1]!.marker).toBe('\u25CF');
  });
});
