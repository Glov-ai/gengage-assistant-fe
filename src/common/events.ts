/**
 * Cross-widget event bus utilities.
 *
 * All Gengage widgets communicate through window CustomEvents following
 * the naming convention:  gengage:<widget>:<action>
 *
 * This creates a loosely-coupled event bus — widgets don't import each other,
 * host pages can intercept any event, and third-party analytics can hook in.
 */

import type { GengageEventDetailMap, GengageEventName } from './types.js';
import type { ActionPayload } from './types.js';
import { isSafeUrl } from './safe-html.js';

/**
 * Dispatch a typed Gengage event on window.
 *
 * @example
 * dispatch('gengage:qna:action', { title: 'About shipping', type: 'query', payload: 'shipping' });
 */
export function dispatch<K extends GengageEventName>(name: K, detail: GengageEventDetailMap[K]): void {
  window.dispatchEvent(new CustomEvent(name, { detail, bubbles: false }));
}

/**
 * Listen for a typed Gengage event on window.
 * Returns an unsubscribe function.
 *
 * @example
 * const off = listen('gengage:qna:action', (detail) => {
 *   window.gengage?.chat?.openWithAction(detail);
 * });
 * // Later:
 * off();
 */
export function listen<K extends GengageEventName>(
  name: K,
  handler: (detail: GengageEventDetailMap[K]) => void,
): () => void {
  const listener = (e: Event) => {
    handler((e as CustomEvent<GengageEventDetailMap[K]>).detail);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

export interface WireQNAToChatOptions {
  onChatUnavailable?: () => void;
}

interface WireableChatAPI {
  open?: (options?: { state?: 'full' | 'half'; initialMessage?: string }) => void;
  openWithAction?: (action: ActionPayload) => void;
  sendMessage?: (text: string) => void;
}

function extractFreeTextActionMessage(action: ActionPayload): string | null {
  if (action.type !== 'user_message' && action.type !== 'inputText') return null;

  if (typeof action.payload === 'string' && action.payload.trim().length > 0) {
    return action.payload.trim();
  }

  if (typeof action.payload === 'object' && action.payload !== null) {
    const payloadObj = action.payload as Record<string, unknown>;
    if (typeof payloadObj.text === 'string') {
      const text = payloadObj.text.trim();
      if (text.length > 0) return text;
    }
  }

  if (typeof action.title === 'string' && action.title.trim().length > 0) {
    return action.title.trim();
  }

  return null;
}

/**
 * Convenience: wire QNA → Chat automatically.
 * Call this once after both widgets are initialised.
 *
 * Listens for 'gengage:qna:action' and forwards to window.gengage.chat.openWithAction().
 * Listens for 'gengage:qna:open-chat' and forwards to window.gengage.chat.open().
 *
 * If chat is not available at dispatch time, emits a one-time console.warn and
 * calls options.onChatUnavailable (every time) if provided.
 *
 * @returns unsubscribe function that removes both listeners.
 */
export function wireQNAToChat(options?: WireQNAToChatOptions): () => void {
  let warnedOnce = false;
  const pendingActions: ActionPayload[] = [];
  let pendingOpenCount = 0;
  let pollTimer: number | null = null;
  let pollStartedAt = 0;
  const pollIntervalMs = 100;
  const pollTimeoutMs = 5000;

  function getChat(): WireableChatAPI | null {
    return (window.gengage?.chat as WireableChatAPI | undefined) ?? null;
  }

  function notifyUnavailable(): void {
    if (!warnedOnce) {
      console.warn(
        '[gengage] QNA tried to open chat, but chat widget is not initialized. ' +
          'Ensure GengageChat is initialized before calling wireQNAToChat().',
      );
      warnedOnce = true;
    }
    options?.onChatUnavailable?.();
  }

  function routeActionToChat(chat: WireableChatAPI, action: ActionPayload): void {
    const freeText = extractFreeTextActionMessage(action);
    if (freeText && chat.sendMessage) {
      chat.open?.();
      chat.sendMessage(freeText);
      return;
    }
    chat.openWithAction?.(action);
  }

  function clearPollTimer(): void {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function flushPendingToChat(): boolean {
    const chat = getChat();
    if (!chat) return false;

    if (pendingOpenCount > 0) {
      chat.open?.();
      pendingOpenCount = 0;
    }

    if (pendingActions.length > 0) {
      const queued = pendingActions.splice(0, pendingActions.length);
      for (const action of queued) {
        routeActionToChat(chat, action);
      }
    }

    clearPollTimer();
    return true;
  }

  function ensurePollTimer(): void {
    if (pollTimer !== null) return;
    pollStartedAt = Date.now();
    pollTimer = window.setInterval(() => {
      if (flushPendingToChat()) return;
      if (Date.now() - pollStartedAt >= pollTimeoutMs) {
        pendingActions.length = 0;
        pendingOpenCount = 0;
        clearPollTimer();
      }
    }, pollIntervalMs);
  }

  const offAction = listen('gengage:qna:action', (action) => {
    const chat = getChat();
    if (chat) {
      routeActionToChat(chat, action);
      return;
    }

    notifyUnavailable();
    if (pendingActions.length >= 20) pendingActions.shift();
    pendingActions.push(action);
    ensurePollTimer();
  });

  const offOpen = listen('gengage:qna:open-chat', () => {
    const chat = getChat();
    if (chat) {
      chat.open?.();
      return;
    }

    notifyUnavailable();
    pendingOpenCount += 1;
    ensurePollTimer();
  });

  return () => {
    offAction();
    offOpen();
    pendingActions.length = 0;
    pendingOpenCount = 0;
    clearPollTimer();
  };
}

/**
 * Convenience: wire Similar Products → Chat for cross-page session continuity.
 * Call this once after both widgets are initialised.
 *
 * When the user navigates to a product page, the chat widget can restore
 * the conversation where it left off using saveSession().
 *
 * @returns unsubscribe function.
 */
export function wireSimilarToChat(): () => void {
  return listen('gengage:similar:product-click', ({ sku, url, sessionId }) => {
    if (sessionId) {
      window.gengage?.chat?.saveSession(sessionId, sku);
    }
    if (isSafeUrl(url)) {
      window.location.href = url;
    }
  });
}
