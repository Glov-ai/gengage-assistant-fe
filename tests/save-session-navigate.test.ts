import { describe, it, expect } from 'vitest';

/**
 * Tests the save-session-and-navigate pattern.
 * Production saves IDB session before sending openURLInNewTab bridge message.
 */
describe('Save Session and Navigate', () => {
  class NavigationSimulator {
    bridgeMessages: Array<{ type: string; payload: unknown }> = [];
    sessionSaved = false;
    sessionSaveError = false;

    async saveSession(): Promise<void> {
      if (this.sessionSaveError) throw new Error('IDB error');
      this.sessionSaved = true;
    }

    sendBridge(type: string, payload: unknown): void {
      this.bridgeMessages.push({ type, payload });
    }

    async saveSessionAndOpenURL(url: string): Promise<void> {
      try {
        await this.saveSession();
      } catch {
        // Non-fatal
      }
      this.sendBridge('openURLInNewTab', { url });
    }
  }

  it('saves session before sending bridge message', async () => {
    const sim = new NavigationSimulator();
    await sim.saveSessionAndOpenURL('https://example.com/product');

    expect(sim.sessionSaved).toBe(true);
    expect(sim.bridgeMessages).toHaveLength(1);
    expect(sim.bridgeMessages[0]).toEqual({
      type: 'openURLInNewTab',
      payload: { url: 'https://example.com/product' },
    });
  });

  it('still navigates when session save fails', async () => {
    const sim = new NavigationSimulator();
    sim.sessionSaveError = true;

    await sim.saveSessionAndOpenURL('https://example.com/product');

    expect(sim.sessionSaved).toBe(false);
    expect(sim.bridgeMessages).toHaveLength(1);
    expect(sim.bridgeMessages[0]!.type).toBe('openURLInNewTab');
  });

  it('sends correct URL in bridge message', async () => {
    const sim = new NavigationSimulator();
    await sim.saveSessionAndOpenURL('https://shop.com/p/12345');

    expect(sim.bridgeMessages[0]!.payload).toEqual({ url: 'https://shop.com/p/12345' });
  });
});
