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
});
