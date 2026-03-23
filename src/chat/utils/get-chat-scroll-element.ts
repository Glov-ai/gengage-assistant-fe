/**
 * Resolves the chat transcript scroll container (messages pane).
 * Prefers a widget-registered element (Shadow DOM–safe); falls back to #gengage-chat-scroll in light DOM.
 */

import { logChatPresentation } from './chat-presentation-debug.js';

/** DOM id on the transcript scroller — stable for host tooling */
export const CHAT_SCROLL_ELEMENT_ID = 'gengage-chat-scroll';

let registered: HTMLElement | null = null;

/** Called when the chat drawer mounts / updates its messages scroller */
export function registerChatScrollElement(el: HTMLElement | null): void {
  registered = el;
}

export function getChatScrollElement(): HTMLElement | null {
  if (registered && registered.isConnected) {
    return registered;
  }
  registered = null;

  const light = document.getElementById(CHAT_SCROLL_ELEMENT_ID);
  if (light) {
    return light;
  }

  logChatPresentation('chat-scroll', 'failed to resolve scroll container (not registered)', {
    id: CHAT_SCROLL_ELEMENT_ID,
  });
  return null;
}

export function invalidateChatScrollCache(): void {
  registered = null;
}
