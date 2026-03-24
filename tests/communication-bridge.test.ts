import { describe, it, expect, vi, afterEach } from 'vitest';
import { CommunicationBridge } from '../src/common/communication-bridge.js';

describe('CommunicationBridge', () => {
  let bridge: CommunicationBridge;

  afterEach(() => {
    bridge?.destroy();
  });

  it('receives postMessage matching namespace and type', () => {
    const handler = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat' });
    bridge.on('openChat', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'openChat', payload: { state: 'full' } },
        origin: window.location.origin,
      }),
    );

    expect(handler).toHaveBeenCalledWith({ state: 'full' });
  });

  it('ignores messages targeting different namespace', () => {
    const handler = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat' });
    bridge.on('openChat', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'qna', type: 'openChat' },
        origin: window.location.origin,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it('ignores messages with invalid shape', () => {
    const handler = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat' });
    bridge.on('openChat', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'not an object',
        origin: window.location.origin,
      }),
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { notGengage: true },
        origin: window.location.origin,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it('checks allowedOrigins', () => {
    const handler = vi.fn();
    bridge = new CommunicationBridge({
      namespace: 'chat',
      allowedOrigins: ['https://trusted.com'],
    });
    bridge.on('openChat', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'openChat' },
        origin: 'https://evil.com',
      }),
    );

    expect(handler).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'openChat' },
        origin: 'https://trusted.com',
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('send dispatches CustomEvent on window', () => {
    bridge = new CommunicationBridge({ namespace: 'chat' });
    const listener = vi.fn();
    window.addEventListener('gengage:bridge:message', listener);

    bridge.send('testAction', { key: 'value' });

    expect(listener).toHaveBeenCalledTimes(1);
    const event = listener.mock.calls[0]![0] as CustomEvent;
    expect(event.detail.namespace).toBe('chat');
    expect(event.detail.type).toBe('testAction');
    expect(event.detail.payload).toEqual({ key: 'value' });

    window.removeEventListener('gengage:bridge:message', listener);
  });

  it('on returns unsubscribe function', () => {
    const handler = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat' });
    const off = bridge.on('test', handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'test' },
        origin: window.location.origin,
      }),
    );
    expect(handler).toHaveBeenCalledTimes(1);

    off();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'test' },
        origin: window.location.origin,
      }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls onMessage callback for every valid message', () => {
    const onMessage = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat', onMessage });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'ping' },
        origin: window.location.origin,
      }),
    );

    expect(onMessage).toHaveBeenCalledWith({ type: 'ping' });
  });

  it('ignores messages after destroy', () => {
    const handler = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat' });
    bridge.on('test', handler);
    bridge.destroy();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'test' },
        origin: window.location.origin,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it('send is no-op after destroy', () => {
    bridge = new CommunicationBridge({ namespace: 'chat' });
    const listener = vi.fn();
    window.addEventListener('gengage:bridge:message', listener);

    bridge.destroy();
    bridge.send('test');

    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener('gengage:bridge:message', listener);
  });

  it('double destroy is safe', () => {
    bridge = new CommunicationBridge({ namespace: 'chat' });
    bridge.destroy();
    expect(() => bridge.destroy()).not.toThrow();
  });

  it('supports multiple handlers for the same type', () => {
    bridge = new CommunicationBridge({ namespace: 'chat' });
    const h1 = vi.fn();
    const h2 = vi.fn();
    bridge.on('openChat', h1);
    bridge.on('openChat', h2);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'openChat' },
        origin: window.location.origin,
      }),
    );

    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribing one handler does not affect others', () => {
    bridge = new CommunicationBridge({ namespace: 'chat' });
    const h1 = vi.fn();
    const h2 = vi.fn();
    const unsub1 = bridge.on('openChat', h1);
    bridge.on('openChat', h2);

    unsub1();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'openChat' },
        origin: window.location.origin,
      }),
    );

    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('send omits payload from detail when not provided', () => {
    bridge = new CommunicationBridge({ namespace: 'chat' });
    const listener = vi.fn();
    window.addEventListener('gengage:bridge:message', listener);

    bridge.send('ping');

    const detail = (listener.mock.calls[0]![0] as CustomEvent).detail;
    expect(detail).toEqual({ namespace: 'chat', type: 'ping' });
    expect(detail).not.toHaveProperty('payload');

    window.removeEventListener('gengage:bridge:message', listener);
  });

  it('omits payload from BridgeMessage when postMessage has no payload', () => {
    const onMessage = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat', onMessage });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'closeChat' },
        origin: window.location.origin,
      }),
    );

    expect(onMessage).toHaveBeenCalledWith({ type: 'closeChat' });
    expect(onMessage.mock.calls[0]![0]).not.toHaveProperty('payload');
  });

  it('wildcard origin accepts messages from any origin', () => {
    const onMessage = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat', allowedOrigins: ['*'], onMessage });

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { gengage: 'chat', type: 'test' },
        origin: 'https://random-origin.com',
      }),
    );

    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it('ignores null data in postMessage', () => {
    const onMessage = vi.fn();
    bridge = new CommunicationBridge({ namespace: 'chat', onMessage });

    window.dispatchEvent(new MessageEvent('message', { data: null, origin: window.location.origin }));

    expect(onMessage).not.toHaveBeenCalled();
  });
});
