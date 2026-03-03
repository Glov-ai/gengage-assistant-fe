import { describe, it, expect } from 'vitest';

/**
 * Tests inbound bridge message handlers.
 * Production handles 8+ message types from the host page.
 * Uses a simulator that mirrors the switch logic in GengageChat._handleBridgeMessage().
 */
describe('Inbound Bridge Message Handlers', () => {
  class BridgeHandlerSimulator {
    opened = false;
    closed = false;
    actions: Array<{ type: string; payload?: unknown }> = [];
    scrolledToBottom = false;
    hiddenByUser: boolean | null = null;
    bgColor: string | null = null;
    bridgeContext: Record<string, unknown> | null = null;
    cartQuantity: number | null = null;
    addToCardResult: unknown = null;
    bridgeSent: Array<{ type: string; payload?: unknown }> = [];

    handleMessage(msg: { type: string; payload?: Record<string, unknown> }): void {
      switch (msg.type) {
        case 'openChat':
          this.opened = true;
          break;
        case 'closeChat':
          this.closed = true;
          break;
        case 'startNewChatWithLauncherAction': {
          const action = msg.payload?.action;
          if (action && typeof action === 'object' && 'type' in (action as Record<string, unknown>)) {
            this.actions.push(action as { type: string });
          }
          this.opened = true;
          break;
        }
        case 'startNewChatWithDetailContext':
          if (msg.payload && typeof msg.payload === 'object') {
            this.bridgeContext = msg.payload;
          }
          this.opened = true;
          break;
        case 'launcherAction': {
          const action = msg.payload?.action;
          if (action && typeof action === 'object' && 'type' in (action as Record<string, unknown>)) {
            this.actions.push(action as { type: string });
          }
          break;
        }
        case 'scrollToBottom':
          this.scrolledToBottom = true;
          break;
        case 'addToCardHandler':
          this.addToCardResult = msg.payload;
          this.bridgeSent.push({ type: 'addToCardResult', payload: msg.payload });
          break;
        case 'cartQuantityHandler': {
          const payload = msg.payload;
          if (payload && 'quantity' in payload && typeof payload.quantity === 'number') {
            this.cartQuantity = payload.quantity;
          }
          break;
        }
        case 'minimizeRequestedByUser':
          this.hiddenByUser = true;
          break;
        case 'bgColorChange':
          if (typeof msg.payload?.color === 'string') {
            this.bgColor = msg.payload.color as string;
          }
          break;
        default:
          break;
      }
    }
  }

  it('handles openChat', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'openChat' });
    expect(sim.opened).toBe(true);
  });

  it('handles closeChat', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'closeChat' });
    expect(sim.closed).toBe(true);
  });

  it('handles startNewChatWithLauncherAction', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({
      type: 'startNewChatWithLauncherAction',
      payload: { action: { type: 'searchProducts', title: 'Search', payload: {} } },
    });
    expect(sim.opened).toBe(true);
    expect(sim.actions).toHaveLength(1);
    expect(sim.actions[0]!.type).toBe('searchProducts');
  });

  it('handles startNewChatWithLauncherAction with missing action gracefully', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({
      type: 'startNewChatWithLauncherAction',
      payload: {},
    });
    expect(sim.opened).toBe(true);
    expect(sim.actions).toHaveLength(0);
  });

  it('handles startNewChatWithDetailContext', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({
      type: 'startNewChatWithDetailContext',
      payload: { sku: 'SKU123', pageType: 'pdp' },
    });
    expect(sim.opened).toBe(true);
    expect(sim.bridgeContext).toEqual({ sku: 'SKU123', pageType: 'pdp' });
  });

  it('handles launcherAction', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({
      type: 'launcherAction',
      payload: { action: { type: 'showReviews', title: 'Reviews', payload: {} } },
    });
    expect(sim.actions).toHaveLength(1);
    expect(sim.actions[0]!.type).toBe('showReviews');
  });

  it('handles launcherAction with missing action gracefully', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({
      type: 'launcherAction',
      payload: {},
    });
    expect(sim.actions).toHaveLength(0);
  });

  it('handles scrollToBottom', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'scrollToBottom' });
    expect(sim.scrolledToBottom).toBe(true);
  });

  it('handles addToCardHandler by forwarding as addToCardResult', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'addToCardHandler', payload: { success: true, sku: 'ABC' } });
    expect(sim.bridgeSent).toHaveLength(1);
    expect(sim.bridgeSent[0]!.type).toBe('addToCardResult');
    expect(sim.bridgeSent[0]!.payload).toEqual({ success: true, sku: 'ABC' });
  });

  it('handles cartQuantityHandler', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'cartQuantityHandler', payload: { quantity: 3 } });
    expect(sim.cartQuantity).toBe(3);
  });

  it('ignores cartQuantityHandler with non-number quantity', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'cartQuantityHandler', payload: { quantity: 'abc' as unknown as number } });
    expect(sim.cartQuantity).toBeNull();
  });

  it('handles minimizeRequestedByUser', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'minimizeRequestedByUser' });
    expect(sim.hiddenByUser).toBe(true);
  });

  it('handles bgColorChange', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'bgColorChange', payload: { color: '#ff0000' } });
    expect(sim.bgColor).toBe('#ff0000');
  });

  it('ignores bgColorChange with non-string color', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'bgColorChange', payload: { color: 123 as unknown as string } });
    expect(sim.bgColor).toBeNull();
  });

  it('ignores unknown message types without error', () => {
    const sim = new BridgeHandlerSimulator();
    sim.handleMessage({ type: 'unknownType' });
    // No error thrown, no state changed
    expect(sim.opened).toBe(false);
    expect(sim.closed).toBe(false);
    expect(sim.actions).toHaveLength(0);
    expect(sim.scrolledToBottom).toBe(false);
    expect(sim.hiddenByUser).toBeNull();
    expect(sim.bgColor).toBeNull();
    expect(sim.bridgeContext).toBeNull();
    expect(sim.cartQuantity).toBeNull();
  });
});
