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

  function guardChat(): boolean {
    if (window.gengage?.chat !== undefined) return true;
    if (!warnedOnce) {
      console.warn(
        '[gengage] QNA tried to open chat, but chat widget is not initialized. ' +
          'Ensure GengageChat is initialized before calling wireQNAToChat().',
      );
      warnedOnce = true;
    }
    options?.onChatUnavailable?.();
    return false;
  }

  const offAction = listen('gengage:qna:action', (action) => {
    if (guardChat()) {
      window.gengage?.chat?.openWithAction(action);
    }
  });

  const offOpen = listen('gengage:qna:open-chat', () => {
    if (guardChat()) {
      window.gengage?.chat?.open();
    }
  });

  return () => {
    offAction();
    offOpen();
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
    window.location.href = url;
  });
}
