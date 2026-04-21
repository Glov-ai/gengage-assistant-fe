import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverlayWidgetsController } from '../src/common/overlay.js';
import {
  applyNativeSession,
  createNativeWebViewBridge,
  detectNativeEnvironment,
} from '../src/common/native-webview.js';

function clearNativeGlobals(): void {
  delete (window as Window & Record<string, unknown>).gengageNative;
  delete (window as Window & Record<string, unknown>).GengageNative;
  delete (window as Window & Record<string, unknown>).ReactNativeWebView;
  delete (window as Window & Record<string, unknown>).webkit;
}

describe('native-webview bridge', () => {
  beforeEach(() => {
    clearNativeGlobals();
    sessionStorage.clear();
    window.__gengageSessionId = undefined;
    if (window.gengage) delete window.gengage;
  });

  afterEach(() => {
    clearNativeGlobals();
  });

  it('detects browser environment by default', () => {
    expect(detectNativeEnvironment()).toBe('browser');
  });

  it('detects android environment when javascript interface exists', () => {
    const postMessage = vi.fn();
    (window as Window & Record<string, unknown>).GengageNative = { postMessage };
    expect(detectNativeEnvironment()).toBe('android');
  });

  it('detects react-native environment when ReactNativeWebView exists', () => {
    const postMessage = vi.fn();
    (window as Window & Record<string, unknown>).ReactNativeWebView = { postMessage };
    expect(detectNativeEnvironment()).toBe('react-native');
  });

  it('applies session information from native payload', () => {
    applyNativeSession({ sessionId: 'native-session', userId: 'native-user' });

    expect(window.__gengageSessionId).toBe('native-session');
    expect(sessionStorage.getItem('gengage_session_id')).toBe('native-session');
    expect(window.gengage?.sessionId).toBe('native-session');

    const sessionBag = (window.gengage as unknown as Record<string, unknown>)['session'] as
      | Record<string, unknown>
      | undefined;
    expect(sessionBag?.['userId']).toBe('native-user');
  });

  it('forwards tracked widget events to android host', () => {
    const postMessage = vi.fn();
    (window as Window & Record<string, unknown>).GengageNative = { postMessage };

    const bridge = createNativeWebViewBridge();
    window.dispatchEvent(new CustomEvent('gengage:chat:open', { detail: { state: 'full' } }));

    expect(postMessage).toHaveBeenCalledTimes(1);
    const raw = postMessage.mock.calls[0]?.[0];
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(String(raw)) as { type: string; payload?: { event?: string; detail?: unknown } };
    expect(parsed.type).toBe('widget_event');
    expect(parsed.payload?.event).toBe('gengage:chat:open');
    expect(parsed.payload?.detail).toEqual({ state: 'full' });

    bridge.destroy();
  });

  it('forwards tracked widget events to react-native host', () => {
    const postMessage = vi.fn();
    (window as Window & Record<string, unknown>).ReactNativeWebView = { postMessage };

    const bridge = createNativeWebViewBridge();
    window.dispatchEvent(new CustomEvent('gengage:chat:open', { detail: { state: 'full' } }));

    expect(postMessage).toHaveBeenCalledTimes(1);
    const raw = postMessage.mock.calls[0]?.[0];
    expect(typeof raw).toBe('string');
    const parsed = JSON.parse(String(raw)) as { type: string; payload?: { event?: string; detail?: unknown } };
    expect(parsed.type).toBe('widget_event');
    expect(parsed.payload?.event).toBe('gengage:chat:open');
    expect(parsed.payload?.detail).toEqual({ state: 'full' });

    bridge.destroy();
  });

  it('routes inbound commands to overlay controller', () => {
    const bridge = createNativeWebViewBridge();

    const controller: OverlayWidgetsController = {
      idempotencyKey: 'test',
      session: { sessionId: 's1' },
      chat: null,
      qna: null,
      simrel: null,
      simbut: null,
      analyticsClient: null,
      openChat: vi.fn(),
      closeChat: vi.fn(),
      updateContext: vi.fn().mockResolvedValue(undefined),
      updatePageContext: vi.fn().mockResolvedValue(undefined),
      setPageContext: vi.fn().mockResolvedValue(undefined),
      updateSku: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    bridge.setController(controller);

    bridge.receive({ type: 'openChat', payload: { state: 'half' } });
    bridge.receive({ type: 'closeChat' });
    bridge.receive({ type: 'updateContext', payload: { pageType: 'pdp', sku: 'SKU-1' } });
    bridge.receive({ type: 'updatePageContext', payload: { sku: 'SKU-1B' } });
    bridge.receive({ type: 'setPageContext', payload: { sku: 'SKU-1C' } });
    bridge.receive({ type: 'updateSku', payload: { sku: 'SKU-2', pageType: 'pdp' } });
    bridge.receive({ type: 'destroy' });

    expect(controller.openChat).toHaveBeenCalledWith({ state: 'half' });
    expect(controller.closeChat).toHaveBeenCalledTimes(1);
    expect(controller.updateContext).toHaveBeenCalledWith({ pageType: 'pdp', sku: 'SKU-1' });
    expect(controller.updateContext).toHaveBeenCalledWith({ sku: 'SKU-1B' });
    expect(controller.updateContext).toHaveBeenCalledWith({ sku: 'SKU-1C' });
    expect(controller.updateSku).toHaveBeenCalledWith('SKU-2', 'pdp');
    expect(controller.destroy).toHaveBeenCalledTimes(1);

    bridge.destroy();
  });

  it('queues inbound commands until controller is attached', () => {
    const bridge = createNativeWebViewBridge();
    const openChat = vi.fn();
    const updateSku = vi.fn().mockResolvedValue(undefined);

    bridge.receive({ type: 'openChat', payload: { state: 'full' } });
    bridge.receive({ type: 'updateSku', payload: 'SKU-QUEUED' });

    const controller: OverlayWidgetsController = {
      idempotencyKey: 'queued',
      session: { sessionId: 's1' },
      chat: null,
      qna: null,
      simrel: null,
      simbut: null,
      analyticsClient: null,
      openChat,
      closeChat: vi.fn(),
      updateContext: vi.fn().mockResolvedValue(undefined),
      updatePageContext: vi.fn().mockResolvedValue(undefined),
      setPageContext: vi.fn().mockResolvedValue(undefined),
      updateSku,
      destroy: vi.fn(),
    };

    bridge.setController(controller);

    expect(openChat).toHaveBeenCalledWith({ state: 'full' });
    expect(updateSku).toHaveBeenCalledWith('SKU-QUEUED', undefined);

    bridge.destroy();
  });

  it('accepts shorthand native command shapes', () => {
    const bridge = createNativeWebViewBridge();

    const controller: OverlayWidgetsController = {
      idempotencyKey: 'shape-test',
      session: { sessionId: 's1' },
      chat: null,
      qna: null,
      simrel: null,
      simbut: null,
      analyticsClient: null,
      openChat: vi.fn(),
      closeChat: vi.fn(),
      updateContext: vi.fn().mockResolvedValue(undefined),
      updatePageContext: vi.fn().mockResolvedValue(undefined),
      setPageContext: vi.fn().mockResolvedValue(undefined),
      updateSku: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
    };

    bridge.setController(controller);

    bridge.receive('openChat');
    bridge.receive(JSON.stringify({ command: 'updateSku', data: 'SKU-STRING' }));
    bridge.receive({ action: 'setSession', sessionId: 'session-inline', userId: 'user-inline' } as unknown as {
      type: string;
      payload?: unknown;
    });

    expect(controller.openChat).toHaveBeenCalledWith(undefined);
    expect(controller.updateSku).toHaveBeenCalledWith('SKU-STRING', undefined);
    expect(window.__gengageSessionId).toBe('session-inline');

    const sessionBag = (window.gengage as unknown as Record<string, unknown>)['session'] as
      | Record<string, unknown>
      | undefined;
    expect(sessionBag?.['userId']).toBe('user-inline');

    bridge.destroy();
  });
});
