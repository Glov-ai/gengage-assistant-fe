/**
 * Opt-in debug logging for chat presentation (query ?chat_debug=1 or localStorage gengage_chat_debug=1).
 */

const DEBUG_QUERY_KEYS = ['chat_debug', 'presentation_debug'];
const DEBUG_STORAGE_KEYS = ['gengage_chat_debug', 'gengage_presentation_debug'];

type Entry = { seq: number; time: string; scope: string; message: string; payload?: unknown };

declare global {
  interface Window {
    __gengageChatPresentationDebugLog?: Entry[];
    __gengageChatPresentationDebugSeq?: number;
  }
}

export function isChatPresentationDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (DEBUG_QUERY_KEYS.some((k) => params.get(k) === '1')) return true;
  try {
    return DEBUG_STORAGE_KEYS.some((k) => window.localStorage.getItem(k) === '1');
  } catch {
    return false;
  }
}

export function logChatPresentation(scope: string, message: string, payload?: unknown): void {
  if (!isChatPresentationDebugEnabled()) return;
  const seq = (window.__gengageChatPresentationDebugSeq ?? 0) + 1;
  window.__gengageChatPresentationDebugSeq = seq;
  const entry: Entry = { seq, time: new Date().toISOString(), scope, message, payload };
  if (!window.__gengageChatPresentationDebugLog) window.__gengageChatPresentationDebugLog = [];
  window.__gengageChatPresentationDebugLog.push(entry);
  if (window.__gengageChatPresentationDebugLog.length > 400) window.__gengageChatPresentationDebugLog.shift();
  const prefix = `[gengage-chat-debug #${seq}][${scope}] ${message}`;
  if (payload === undefined) console.debug(prefix);
  else console.debug(prefix, payload);
}
