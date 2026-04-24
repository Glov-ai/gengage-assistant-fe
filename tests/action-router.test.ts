import { describe, it, expect, vi } from 'vitest';
import { routeStreamAction } from '../src/common/action-router.js';
import type { StreamEventAction } from '../src/common/types.js';

describe('routeStreamAction', () => {
  it('routes open_chat to handler', () => {
    const handler = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'open_chat', payload: { title: 'Test', type: 'user_message' } },
    };
    routeStreamAction(event, { openChat: handler });
    expect(handler).toHaveBeenCalledWith({ title: 'Test', type: 'user_message' });
  });

  it('routes navigate to handler', () => {
    const handler = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'navigate', url: 'https://example.com', newTab: true },
    };
    routeStreamAction(event, { navigate: handler });
    expect(handler).toHaveBeenCalledWith({ url: 'https://example.com', newTab: true });
  });

  it('routes save_session to handler', () => {
    const handler = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'save_session', sessionId: 's1', sku: 'sku1' },
    };
    routeStreamAction(event, { saveSession: handler });
    expect(handler).toHaveBeenCalledWith({ sessionId: 's1', sku: 'sku1' });
  });

  it('routes add_to_cart to handler', () => {
    const handler = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'add_to_cart', sku: 'SKU1', quantity: 2, cartCode: 'CC1' },
    };
    routeStreamAction(event, { addToCart: handler });
    expect(handler).toHaveBeenCalledWith({ sku: 'SKU1', quantity: 2, cartCode: 'CC1' });
  });

  it('routes script_call to handler when allowed', () => {
    const handler = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'script_call', name: 'myCallback', payload: { key: 'val' } },
    };
    routeStreamAction(event, { scriptCall: handler }, { allowScriptCall: true });
    expect(handler).toHaveBeenCalledWith({ name: 'myCallback', payload: { key: 'val' } });
  });

  it('blocks script_call when not allowed', () => {
    const handler = vi.fn();
    const unknownHandler = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'script_call', name: 'evil', payload: {} },
    };
    routeStreamAction(
      event,
      { scriptCall: handler, unknown: unknownHandler },
      { allowScriptCall: false, unknownActionPolicy: 'delegate' },
    );
    expect(handler).not.toHaveBeenCalled();
    expect(unknownHandler).toHaveBeenCalled();
  });

  it('delegates unknown actions when policy is delegate', () => {
    const handler = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'custom_action' },
    };
    routeStreamAction(event, { unknown: handler }, { unknownActionPolicy: 'delegate' });
    expect(handler).toHaveBeenCalledWith({ kind: 'custom_action' });
  });

  it('logs unknown actions when policy is log-and-ignore', () => {
    const logger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'mystery_action' },
    };
    routeStreamAction(event, {}, { unknownActionPolicy: 'log-and-ignore', logger });
    expect(logger.warn).toHaveBeenCalled();
  });

  it('throws on unknown actions when policy is throw', () => {
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'bad_action' },
    };
    expect(() => routeStreamAction(event, {}, { unknownActionPolicy: 'throw' })).toThrow(/bad_action/);
  });

  it('handles navigate without newTab', () => {
    const handler = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'navigate', url: 'https://example.com' },
    };
    routeStreamAction(event, { navigate: handler });
    expect(handler).toHaveBeenCalledWith({ url: 'https://example.com' });
  });

  it('blocks default navigation to javascript: URLs', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'navigate', url: 'javascript:alert(1)' },
    };
    // No custom handler — falls through to defaultNavigate which should block
    routeStreamAction(event, {});
    // defaultNavigate validates URL safety and blocks javascript: protocol
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Blocked navigation'), expect.any(String));
    warnSpy.mockRestore();
  });

  it('allows default navigation to https: URLs', () => {
    const defaultNavigate = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'navigate', url: 'https://example.com/product' },
    };
    expect(() => routeStreamAction(event, {}, { defaultNavigate })).not.toThrow();
    expect(defaultNavigate).toHaveBeenCalledWith('https://example.com/product', undefined);
  });

  it('allows default navigation to relative URLs', () => {
    const defaultNavigate = vi.fn();
    const event: StreamEventAction = {
      type: 'action',
      action: { kind: 'navigate', url: '/product/123' },
    };
    expect(() => routeStreamAction(event, {}, { defaultNavigate })).not.toThrow();
    expect(defaultNavigate).toHaveBeenCalledWith('/product/123', undefined);
  });

  it('treats navigate without url string as unknown action', () => {
    const navigate = vi.fn();
    const logger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    routeStreamAction(
      { type: 'action', action: { kind: 'navigate' } as StreamEventAction['action'] },
      { navigate },
      { logger },
    );
    expect(navigate).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('treats save_session with missing sku as unknown action', () => {
    const saveSession = vi.fn();
    const logger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    routeStreamAction(
      { type: 'action', action: { kind: 'save_session', sessionId: 's1' } as StreamEventAction['action'] },
      { saveSession },
      { logger },
    );
    expect(saveSession).not.toHaveBeenCalled();
  });

  it('treats add_to_cart with wrong quantity type as unknown action', () => {
    const addToCart = vi.fn();
    const logger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    routeStreamAction(
      {
        type: 'action',
        action: {
          kind: 'add_to_cart',
          sku: 'X',
          quantity: 'bad',
          cartCode: 'C',
        } as unknown as StreamEventAction['action'],
      },
      { addToCart },
      { logger },
    );
    expect(addToCart).not.toHaveBeenCalled();
  });

  it('treats script_call with missing name as unknown action', () => {
    const scriptCall = vi.fn();
    const logger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    routeStreamAction(
      { type: 'action', action: { kind: 'script_call' } as StreamEventAction['action'] },
      { scriptCall },
      { logger },
    );
    expect(scriptCall).not.toHaveBeenCalled();
  });

  it('logs warning when delegate policy has no unknown handler', () => {
    const logger = { warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
    routeStreamAction(
      { type: 'action', action: { kind: 'custom_thing' } },
      {},
      { unknownActionPolicy: 'delegate', logger },
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]![0]).toContain('without delegate handler');
  });

  it('routes script_call without payload (name only)', () => {
    const scriptCall = vi.fn();
    routeStreamAction(
      { type: 'action', action: { kind: 'script_call', name: 'noPayload' } },
      { scriptCall },
      { logger: { warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
    );
    expect(scriptCall).toHaveBeenCalledWith({ name: 'noPayload' });
  });
});
