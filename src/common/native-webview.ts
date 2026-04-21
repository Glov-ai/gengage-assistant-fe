import { initOverlayWidgets } from './overlay.js';
import type { OverlayWidgetsController, OverlayWidgetsOptions } from './overlay.js';
import type { PageContext } from './types.js';

export const DEFAULT_NATIVE_TRACKED_EVENTS = [
  'gengage:chat:open',
  'gengage:chat:close',
  'gengage:chat:ready',
  'gengage:chat:add-to-cart',
  'gengage:qna:action',
  'gengage:qna:open-chat',
  'gengage:similar:product-click',
  'gengage:similar:add-to-cart',
  'gengage:global:error',
  'gengage:context:update',
] as const;

export type NativeTrackedEvent = (typeof DEFAULT_NATIVE_TRACKED_EVENTS)[number];
export type NativeInboundMessage =
  | 'openChat'
  | 'closeChat'
  | 'updateContext'
  | 'updatePageContext'
  | 'setPageContext'
  | 'updateSku'
  | 'setSession'
  | 'destroy';

export type NativeBridgeEnvironment = 'ios' | 'android' | 'react-native' | 'browser';

export interface NativeSessionPayload {
  sessionId?: string;
  userId?: string;
}

export interface NativeBridgeMessage {
  type: string;
  payload?: unknown;
}

export interface NativeWebViewBridgeOptions {
  iosHandlerName?: string;
  androidInterfaceName?: string;
  reactNativeInterfaceName?: string;
  trackedEvents?: NativeTrackedEvent[] | string[];
  /** Log unhandled inbound message types to console in addition to forwarding to postMessage. */
  logUnhandled?: boolean;
  /** Injected for tests; defaults to global window. */
  win?: Window;
}

export interface NativeWebViewBridge {
  readonly env: NativeBridgeEnvironment;
  sendToNative(type: string, payload?: unknown): void;
  receive(message: NativeBridgeMessage | string): void;
  setController(controller: OverlayWidgetsController | null): void;
  destroy(): void;
}

export interface NativeOverlayInitOptions extends OverlayWidgetsOptions {
  nativeBridge?: Omit<NativeWebViewBridgeOptions, 'win'>;
  emitReadyEvent?: boolean;
}

export interface NativeOverlayInitResult {
  controller: OverlayWidgetsController;
  bridge: NativeWebViewBridge;
  destroy(): void;
}

const MAX_QUEUED_NATIVE_COMMANDS = 32;
const DEFAULT_NATIVE_QNA_MOUNT = '#gengage-qna';
const DEFAULT_NATIVE_SIMREL_MOUNT = '#gengage-simrel';

interface NativeWindow extends Window {
  webkit?: {
    messageHandlers?: Record<string, { postMessage?: (message: unknown) => void }>;
  };
  GengageNative?: {
    postMessage?: (message: string) => void;
  };
  ReactNativeWebView?: {
    postMessage?: (message: string) => void;
  };
  gengageNative?: NativeWebViewBridge;
}

function toNativeWindow(win: Window): NativeWindow {
  return win as NativeWindow;
}

function parseNativeBridgeMessage(raw: NativeBridgeMessage | string): NativeBridgeMessage | null {
  let candidate: unknown = raw;

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;

    // Allow plain command strings such as "openChat" from native evaluateJavaScript calls.
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
      return { type: trimmed };
    }

    try {
      candidate = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!candidate || typeof candidate !== 'object') return null;
  const obj = candidate as Record<string, unknown>;

  const typeCandidate = [obj['type'], obj['command'], obj['action'], obj['event']].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  );
  if (!typeCandidate) return null;

  let payload = obj['payload'];
  if (payload === undefined && 'data' in obj) payload = obj['data'];

  // Common native shorthand:
  // { type: "setSession", sessionId: "...", userId: "..." }
  if (typeCandidate === 'setSession' && payload === undefined) {
    const sessionPayload: NativeSessionPayload = {};
    if (typeof obj['sessionId'] === 'string') sessionPayload.sessionId = obj['sessionId'];
    if (typeof obj['userId'] === 'string') sessionPayload.userId = obj['userId'];
    if (sessionPayload.sessionId !== undefined || sessionPayload.userId !== undefined) {
      payload = sessionPayload;
    }
  }

  return payload === undefined ? { type: typeCandidate } : { type: typeCandidate, payload };
}

function parseUpdateSkuPayload(payload: unknown): { sku: string; pageType?: PageContext['pageType'] } | null {
  if (typeof payload === 'string' && payload.length > 0) {
    return { sku: payload };
  }
  if (payload && typeof payload === 'object' && 'sku' in payload) {
    const sku = (payload as { sku?: unknown }).sku;
    if (typeof sku === 'string' && sku.length > 0) {
      const pageType = (payload as { pageType?: PageContext['pageType'] }).pageType;
      return pageType !== undefined ? { sku, pageType } : { sku };
    }
  }
  return null;
}

function hasMountTarget(win: Window, target: HTMLElement | string): boolean {
  if (target instanceof HTMLElement) return true;
  if (typeof target !== 'string') return false;
  return win.document.querySelector(target) !== null;
}

function ensureMountTarget(
  win: Window,
  preferredTarget: HTMLElement | string,
  fallbackId: string,
): HTMLElement | string {
  if (preferredTarget instanceof HTMLElement) return preferredTarget;
  if (hasMountTarget(win, preferredTarget)) return preferredTarget;
  if (typeof preferredTarget !== 'string') return preferredTarget;

  // If target is a simple #id selector, create that mount.
  if (preferredTarget.startsWith('#')) {
    const id = preferredTarget.slice(1);
    if (id.length > 0) {
      const existing = win.document.getElementById(id);
      if (existing) return existing;
      const mount = win.document.createElement('div');
      mount.id = id;
      win.document.body.appendChild(mount);
      return mount;
    }
  }

  const fallback = win.document.getElementById(fallbackId);
  if (fallback) return fallback;
  const mount = win.document.createElement('div');
  mount.id = fallbackId;
  win.document.body.appendChild(mount);
  return mount;
}

function getIosPostMessage(win: Window, handlerName: string): ((message: unknown) => void) | null {
  const handler = toNativeWindow(win).webkit?.messageHandlers?.[handlerName];
  if (handler && typeof handler.postMessage === 'function') {
    return handler.postMessage.bind(handler);
  }
  return null;
}

function getNamedBridge(win: Window, interfaceName: string): { postMessage: (message: string) => void } | null {
  const candidate = (win as Window & Record<string, unknown>)[interfaceName];
  if (candidate && typeof candidate === 'object') {
    const postMessage = (candidate as { postMessage?: unknown }).postMessage;
    if (typeof postMessage === 'function') {
      return candidate as { postMessage: (message: string) => void };
    }
  }
  return null;
}

export function detectNativeEnvironment(
  options: Pick<
    NativeWebViewBridgeOptions,
    'iosHandlerName' | 'androidInterfaceName' | 'reactNativeInterfaceName' | 'win'
  > = {},
): NativeBridgeEnvironment {
  const win = options.win ?? window;
  const iosHandlerName = options.iosHandlerName ?? 'gengage';
  const androidInterfaceName = options.androidInterfaceName ?? 'GengageNative';
  const reactNativeInterfaceName = options.reactNativeInterfaceName ?? 'ReactNativeWebView';

  if (getIosPostMessage(win, iosHandlerName)) return 'ios';
  if (getNamedBridge(win, androidInterfaceName)) return 'android';
  if (getNamedBridge(win, reactNativeInterfaceName)) return 'react-native';
  return 'browser';
}

/**
 * Applies native-provided session identity so widgets can share correlation IDs
 * with the host app. Safe to call before or after widget initialization.
 */
export function applyNativeSession(
  payload: NativeSessionPayload,
  options: Pick<NativeWebViewBridgeOptions, 'win'> = {},
): void {
  const win = options.win ?? window;

  if (payload.sessionId !== undefined) {
    win.__gengageSessionId = payload.sessionId;
    if (!win.gengage) win.gengage = {};
    win.gengage.sessionId = payload.sessionId;
    try {
      win.sessionStorage.setItem('gengage_session_id', payload.sessionId);
    } catch {
      // sessionStorage can be unavailable in restricted WebView modes.
    }
  }

  if (payload.userId !== undefined) {
    if (!win.gengage) win.gengage = {};
    const bag = win.gengage as unknown as Record<string, unknown>;
    const session = (bag['session'] as Record<string, unknown> | undefined) ?? {};
    session['userId'] = payload.userId;
    bag['session'] = session;
  }
}

/**
 * Installs a native WebView bridge compatible with:
 *  - iOS WKWebView (`webkit.messageHandlers`)
 *  - Android JavascriptInterface (`window.GengageNative`)
 *  - React Native WebView (`window.ReactNativeWebView`)
 * and exposes it on `window.gengageNative`.
 */
export function createNativeWebViewBridge(options: NativeWebViewBridgeOptions = {}): NativeWebViewBridge {
  const win = options.win ?? window;
  const nativeWin = toNativeWindow(win);
  if (nativeWin.gengageNative) return nativeWin.gengageNative;

  const iosHandlerName = options.iosHandlerName ?? 'gengage';
  const androidInterfaceName = options.androidInterfaceName ?? 'GengageNative';
  const reactNativeInterfaceName = options.reactNativeInterfaceName ?? 'ReactNativeWebView';
  const trackedEvents = options.trackedEvents ?? [...DEFAULT_NATIVE_TRACKED_EVENTS];
  const env = detectNativeEnvironment({ win, iosHandlerName, androidInterfaceName, reactNativeInterfaceName });

  let controller: OverlayWidgetsController | null = win.gengage?.overlay ?? null;
  const queuedCommands: NativeBridgeMessage[] = [];

  const sendToNative = (type: string, payload?: unknown): void => {
    const message: NativeBridgeMessage = payload === undefined ? { type } : { type, payload };

    if (env === 'ios') {
      const postMessage = getIosPostMessage(win, iosHandlerName);
      postMessage?.(message);
      return;
    }

    if (env === 'android') {
      const androidBridge = getNamedBridge(win, androidInterfaceName);
      androidBridge?.postMessage(JSON.stringify(message));
      return;
    }

    if (env === 'react-native') {
      const reactNativeBridge = getNamedBridge(win, reactNativeInterfaceName);
      reactNativeBridge?.postMessage(JSON.stringify(message));
      return;
    }

    // Browser fallback: no-op. Useful when running the same integration
    // outside a native WebView (desktop QA, local dev, docs previews).
    return;
  };

  const bridgeMessageHandler: EventListener = (event) => {
    const detail = (event as CustomEvent<{ namespace: string; type: string; payload?: unknown }>).detail;
    if (!detail || typeof detail.namespace !== 'string' || typeof detail.type !== 'string') return;
    sendToNative('bridge_message', {
      namespace: detail.namespace,
      type: detail.type,
      payload: detail.payload,
    });
  };

  win.addEventListener('gengage:bridge:message', bridgeMessageHandler);

  const trackedEventHandlers: Array<{ event: string; handler: EventListener }> = trackedEvents.map((eventName) => {
    const handler: EventListener = (event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      sendToNative('widget_event', {
        event: eventName,
        detail,
      });
    };
    win.addEventListener(eventName, handler);
    return { event: eventName, handler };
  });

  const queueCommand = (command: NativeBridgeMessage): void => {
    if (queuedCommands.length >= MAX_QUEUED_NATIVE_COMMANDS) {
      queuedCommands.shift();
    }
    queuedCommands.push(command);
  };

  const flushQueuedCommands = (): void => {
    if (!controller || queuedCommands.length === 0) return;
    const pending = queuedCommands.splice(0, queuedCommands.length);
    for (const command of pending) {
      receive(command);
    }
  };

  const receive = (message: NativeBridgeMessage | string): void => {
    const incoming = parseNativeBridgeMessage(message);
    if (!incoming || typeof incoming.type !== 'string') {
      console.warn('[gengage:native-bridge] Invalid message:', message);
      return;
    }

    const type = incoming.type as NativeInboundMessage | string;
    const payload = incoming.payload;

    switch (type) {
      case 'openChat': {
        if (controller) {
          controller.openChat(
            payload && typeof payload === 'object'
              ? (payload as { state?: 'half' | 'full' })
              : payload === 'half' || payload === 'full'
                ? { state: payload }
                : undefined,
          );
        } else {
          queueCommand(incoming);
        }
        return;
      }

      case 'closeChat': {
        if (controller) {
          controller.closeChat();
        } else {
          queueCommand(incoming);
        }
        return;
      }

      case 'updateContext':
      case 'updatePageContext':
      case 'setPageContext': {
        if (controller && payload && typeof payload === 'object') {
          void controller.updateContext(payload as Partial<PageContext>);
        } else if (!controller) {
          queueCommand(incoming);
        } else {
          console.warn(`[gengage:native-bridge] ${type}: missing payload`);
        }
        return;
      }

      case 'updateSku': {
        const parsed = parseUpdateSkuPayload(payload);
        if (controller && parsed) {
          void controller.updateSku(parsed.sku, parsed.pageType);
          return;
        }
        if (!controller) {
          queueCommand(incoming);
        } else {
          console.warn('[gengage:native-bridge] updateSku: missing sku');
        }
        return;
      }

      case 'setSession': {
        if (payload && typeof payload === 'object') {
          applyNativeSession(payload as NativeSessionPayload, { win });
        }
        return;
      }

      case 'destroy': {
        controller?.destroy();
        return;
      }

      default: {
        win.postMessage({ gengage: 'native', type, payload }, win.location.origin);
        if (options.logUnhandled) {
          console.warn('[gengage:native-bridge] Unhandled inbound type forwarded:', type);
        }
      }
    }
  };

  const bridge: NativeWebViewBridge = {
    env,
    sendToNative,
    receive,
    setController(nextController) {
      controller = nextController;
      flushQueuedCommands();
    },
    destroy() {
      win.removeEventListener('gengage:bridge:message', bridgeMessageHandler);
      for (const entry of trackedEventHandlers) {
        win.removeEventListener(entry.event, entry.handler);
      }
      queuedCommands.splice(0, queuedCommands.length);
      if (toNativeWindow(win).gengageNative === bridge) {
        delete toNativeWindow(win).gengageNative;
      }
    },
  };

  nativeWin.gengageNative = bridge;
  return bridge;
}

/**
 * Convenience helper for mobile WebViews:
 *  1) installs native bridge
 *  2) initializes overlay widgets
 *  3) sends a `ready` message to native
 */
export async function initNativeOverlayWidgets(options: NativeOverlayInitOptions): Promise<NativeOverlayInitResult> {
  const { nativeBridge, emitReadyEvent = true, ...overlayOptions } = options;
  const bridge = createNativeWebViewBridge(nativeBridge);
  const resolvedOptions: OverlayWidgetsOptions = { ...overlayOptions };

  // Mobile-app-friendly defaults:
  // 1) translate commerce callbacks to native bridge messages by default
  // 2) avoid noisy missing-mount warnings unless PDP widgets are explicitly requested
  if (!resolvedOptions.onAddToCart) {
    resolvedOptions.onAddToCart = (params) => {
      bridge.sendToNative('addToCart', {
        sku: params.sku,
        quantity: params.quantity,
        cartCode: params.cartCode,
      });
    };
  }

  if (!resolvedOptions.onProductNavigate) {
    resolvedOptions.onProductNavigate = (url, sku, sessionId) => {
      bridge.sendToNative('productNavigate', {
        url,
        sku,
        sessionId,
      });
    };
  }

  const qnaRequested = resolvedOptions.qna?.enabled === true || resolvedOptions.qna?.mountTarget !== undefined;
  if (resolvedOptions.qna?.enabled !== false) {
    if (qnaRequested) {
      const mountTarget = ensureMountTarget(
        window,
        resolvedOptions.qna?.mountTarget ?? DEFAULT_NATIVE_QNA_MOUNT,
        'gengage-qna',
      );
      resolvedOptions.qna = { ...resolvedOptions.qna, enabled: true, mountTarget };
    } else if (!hasMountTarget(window, DEFAULT_NATIVE_QNA_MOUNT)) {
      resolvedOptions.qna = { enabled: false };
    }
  }

  const simrelRequested = resolvedOptions.simrel?.enabled === true || resolvedOptions.simrel?.mountTarget !== undefined;
  if (resolvedOptions.simrel?.enabled !== false) {
    if (simrelRequested) {
      const mountTarget = ensureMountTarget(
        window,
        resolvedOptions.simrel?.mountTarget ?? DEFAULT_NATIVE_SIMREL_MOUNT,
        'gengage-simrel',
      );
      resolvedOptions.simrel = { ...resolvedOptions.simrel, enabled: true, mountTarget };
    } else if (!hasMountTarget(window, DEFAULT_NATIVE_SIMREL_MOUNT)) {
      resolvedOptions.simrel = { enabled: false };
    }
  }

  const controller = await initOverlayWidgets(resolvedOptions);
  bridge.setController(controller);

  if (emitReadyEvent) {
    bridge.sendToNative('ready', {
      sessionId: controller.session.sessionId,
      widgets: {
        chat: controller.chat !== null,
        qna: controller.qna !== null,
        simrel: controller.simrel !== null,
      },
    });
  }

  return {
    controller,
    bridge,
    destroy() {
      controller.destroy();
      bridge.destroy();
    },
  };
}
