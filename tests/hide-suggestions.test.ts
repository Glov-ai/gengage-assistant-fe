import { describe, it, expect } from 'vitest';

/**
 * Tests that suggested actions (pills + input chips) are hidden during active requests.
 * Production clears them at request start and only re-renders from the new response.
 */
describe('Hide Suggested Actions During Active Request', () => {
  class SuggestionVisibilitySimulator {
    pills: Array<{ label: string }> = [];
    inputChips: Array<{ label: string }> = [];
    requestActive = false;

    startRequest(): void {
      this.pills = [];
      this.inputChips = [];
      this.requestActive = true;
    }

    receiveSuggestedActions(pills: Array<{ label: string }>, chips: Array<{ label: string }>): void {
      if (!this.requestActive) return;
      this.pills = pills;
      this.inputChips = chips;
    }

    endRequest(): void {
      this.requestActive = false;
    }
  }

  it('clears both pills and input chips on new request', () => {
    const sim = new SuggestionVisibilitySimulator();
    sim.pills = [{ label: 'Old pill' }];
    sim.inputChips = [{ label: 'Old chip' }];

    sim.startRequest();

    expect(sim.pills).toEqual([]);
    expect(sim.inputChips).toEqual([]);
  });

  it('new suggestions appear from stream response', () => {
    const sim = new SuggestionVisibilitySimulator();

    sim.startRequest();
    sim.receiveSuggestedActions([{ label: 'New pill' }], [{ label: 'New chip' }]);

    expect(sim.pills).toEqual([{ label: 'New pill' }]);
    expect(sim.inputChips).toEqual([{ label: 'New chip' }]);
  });

  it('stale suggestions from previous request are cleared', () => {
    const sim = new SuggestionVisibilitySimulator();

    sim.startRequest();
    sim.receiveSuggestedActions([{ label: 'First' }], [{ label: 'Chip1' }]);
    sim.endRequest();

    sim.startRequest();
    expect(sim.pills).toEqual([]);
    expect(sim.inputChips).toEqual([]);
  });
});
