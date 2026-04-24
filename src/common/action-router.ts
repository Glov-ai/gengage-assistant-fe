import type { UnknownActionPolicy } from './config-schema.js';
import type { ActionPayload, AddToCartParams, StreamEventAction } from './types.js';
import { isSafeUrl } from './safe-html.js';
import { debugLog } from './debug.js';
import { navigateToUrl } from './navigation.js';

export interface HostActionHandlers {
  openChat?: (payload?: ActionPayload | unknown) => void;
  navigate?: (params: { url: string; newTab?: boolean }) => void;
  saveSession?: (params: { sessionId: string; sku: string }) => void;
  addToCart?: (params: AddToCartParams) => void;
  scriptCall?: (params: { name: string; payload?: Record<string, unknown> }) => void;
  unknown?: (action: StreamEventAction['action']) => void;
}

export interface ActionRouterOptions {
  allowScriptCall?: boolean;
  unknownActionPolicy?: UnknownActionPolicy;
  logger?: Pick<Console, 'warn' | 'error' | 'debug'>;
  defaultNavigate?: (url: string, newTab?: boolean) => void;
}

const defaultLogger: Pick<Console, 'warn' | 'error' | 'debug'> = console;

export function routeStreamAction(
  event: StreamEventAction,
  handlers: HostActionHandlers,
  options: ActionRouterOptions = {},
): void {
  const action = event.action;
  const logger = options.logger ?? defaultLogger;
  debugLog('action', `routing action: ${action.kind}`, action);

  switch (action.kind) {
    case 'open_chat': {
      handlers.openChat?.(action.payload);
      return;
    }
    case 'navigate': {
      if (typeof action.url !== 'string') {
        handleUnknownAction(action, handlers, options, logger);
        return;
      }
      if (!isSafeUrl(action.url)) {
        logger.warn('[gengage] Blocked navigation to unsafe URL:', action.url);
        return;
      }
      const newTab = typeof action.newTab === 'boolean' ? action.newTab : undefined;
      if (handlers.navigate) {
        handlers.navigate({ url: action.url, ...(newTab !== undefined && { newTab }) });
        return;
      }
      (options.defaultNavigate ?? defaultNavigate)(action.url, newTab);
      return;
    }
    case 'save_session': {
      if (typeof action.sessionId !== 'string' || typeof action.sku !== 'string') {
        handleUnknownAction(action, handlers, options, logger);
        return;
      }
      handlers.saveSession?.({ sessionId: action.sessionId, sku: action.sku });
      return;
    }
    case 'add_to_cart': {
      if (
        typeof action.sku !== 'string' ||
        typeof action.quantity !== 'number' ||
        typeof action.cartCode !== 'string'
      ) {
        handleUnknownAction(action, handlers, options, logger);
        return;
      }
      handlers.addToCart?.({
        sku: action.sku,
        quantity: action.quantity,
        cartCode: action.cartCode,
      });
      return;
    }
    case 'script_call': {
      if (options.allowScriptCall === false) {
        handleUnknownAction(action, handlers, options, logger);
        return;
      }
      if (typeof action.name !== 'string') {
        handleUnknownAction(action, handlers, options, logger);
        return;
      }
      const payload = isRecord(action.payload) ? action.payload : undefined;
      handlers.scriptCall?.({ name: action.name, ...(payload !== undefined && { payload }) });
      return;
    }
    default: {
      handleUnknownAction(action, handlers, options, logger);
    }
  }
}

function handleUnknownAction(
  action: StreamEventAction['action'],
  handlers: HostActionHandlers,
  options: ActionRouterOptions,
  logger: Pick<Console, 'warn' | 'error' | 'debug'>,
): void {
  const policy = options.unknownActionPolicy ?? 'log-and-ignore';
  if (policy === 'delegate') {
    handlers.unknown?.(action);
    if (!handlers.unknown) {
      logger.warn('[gengage] Unknown action received without delegate handler', action);
    }
    return;
  }

  if (policy === 'throw') {
    throw new Error(`[gengage] Unknown action kind: ${(action as { kind?: unknown }).kind}`);
  }

  logger.warn('[gengage] Unknown action ignored', action);
}

function defaultNavigate(url: string, newTab?: boolean): void {
  if (typeof window === 'undefined') return;
  if (!isSafeUrl(url)) {
    console.warn('[gengage] Blocked navigation to unsafe URL:', url);
    return;
  }
  navigateToUrl(url, newTab);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
