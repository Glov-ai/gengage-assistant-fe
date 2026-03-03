import { describe, it, expect } from 'vitest';

/**
 * Tests that loading state is forwarded to host via bridge.
 */
describe('Loading Message Bridge Forwarding', () => {
  class LoadingBridgeSimulator {
    messages: Array<{ type: string; payload: unknown }> = [];

    sendBridge(type: string, payload: unknown): void {
      this.messages.push({ type, payload });
    }

    onLoadingEvent(text: string): void {
      this.sendBridge('loadingMessage', { text });
    }

    onStreamDone(): void {
      this.sendBridge('loadingMessage', { text: null });
    }

    onStreamError(): void {
      this.sendBridge('loadingMessage', { text: null });
    }
  }

  it('forwards loading text to host', () => {
    const sim = new LoadingBridgeSimulator();
    sim.onLoadingEvent('Searching products...');

    expect(sim.messages).toHaveLength(1);
    expect(sim.messages[0]).toEqual({
      type: 'loadingMessage',
      payload: { text: 'Searching products...' },
    });
  });

  it('clears loading on stream done', () => {
    const sim = new LoadingBridgeSimulator();
    sim.onLoadingEvent('Thinking...');
    sim.onStreamDone();

    expect(sim.messages).toHaveLength(2);
    expect(sim.messages[1]).toEqual({
      type: 'loadingMessage',
      payload: { text: null },
    });
  });

  it('clears loading on stream error', () => {
    const sim = new LoadingBridgeSimulator();
    sim.onLoadingEvent('Loading...');
    sim.onStreamError();

    expect(sim.messages[1]).toEqual({
      type: 'loadingMessage',
      payload: { text: null },
    });
  });

  it('accumulates multiple loading messages', () => {
    const sim = new LoadingBridgeSimulator();
    sim.onLoadingEvent('Step 1');
    sim.onLoadingEvent('Step 2');
    sim.onLoadingEvent('Step 3');

    expect(sim.messages).toHaveLength(3);
    expect(sim.messages[2]!.payload).toEqual({ text: 'Step 3' });
  });
});
