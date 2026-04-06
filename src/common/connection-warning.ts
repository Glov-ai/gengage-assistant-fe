// Chat widget is intentionally not tracked here. It has its own offline bar
// (ChatDrawer.ts) driven by window online/offline events, and suppresses
// duplicate global toasts for offline errors (chat/index.ts). Adding
// trackConnectionWarningRequest to chat would double-report connectivity issues
// to users who are already seeing the inline offline bar.

import { dismissGlobalErrorToast, showGlobalErrorToast } from './global-error-toast.js';

const CONNECTION_CHECK_DELAY_MS = 8_000;
const CONNECTIVITY_RECHECK_INTERVAL_MS = 5_000;

let probeUrl = 'https://www.google.com/favicon.ico';

export function configureConnectionWarning(options: { probeUrl?: string }): void {
  if (options.probeUrl) probeUrl = options.probeUrl;
}

export interface ConnectionWarningRequestOptions {
  source: 'chat' | 'qna' | 'simrel';
  locale?: string | undefined;
}

const activeRequests = new Map<symbol, string | undefined>();
let listenersRegistered = false;
let delayTimer: ReturnType<typeof setTimeout> | null = null;
let recheckTimer: ReturnType<typeof setInterval> | null = null;
let warningVisible = false;

function isTurkishLocale(locale?: string): boolean {
  return typeof locale === 'string' && locale.toLowerCase().startsWith('tr');
}

function getConnectionWarningMessage(locale?: string): string {
  if (isTurkishLocale(locale)) {
    return 'İnternet bağlantısında sorun var gibi görünüyor. İstek sürerken yeniden deneyeceğiz.';
  }
  return "Your internet connection looks unstable. We'll keep retrying while this request is active.";
}

function getLatestLocale(): string | undefined {
  let locale: string | undefined;
  for (const requestLocale of activeRequests.values()) {
    locale = requestLocale;
  }
  return locale;
}

function clearDelayTimer(): void {
  if (delayTimer) {
    clearTimeout(delayTimer);
    delayTimer = null;
  }
}

function clearRecheckTimer(): void {
  if (recheckTimer) {
    clearInterval(recheckTimer);
    recheckTimer = null;
  }
}

async function checkConnectivity(): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return false;
    }

    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        return navigator.onLine;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3_000);
    try {
      await fetch(probeUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache',
        signal: controller.signal,
      });
      return true;
    } catch {
      return navigator.onLine;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }
}

function dismissWarning(): void {
  warningVisible = false;
  clearRecheckTimer();
  dismissGlobalErrorToast();
}

function scheduleDelayedCheck(): void {
  if (delayTimer || warningVisible || activeRequests.size === 0) return;

  delayTimer = setTimeout(async () => {
    delayTimer = null;
    if (warningVisible || activeRequests.size === 0) return;

    const isConnected = await checkConnectivity();
    if (!isConnected && activeRequests.size > 0) {
      warningVisible = true;
      showGlobalErrorToast({
        source: 'sdk',
        message: getConnectionWarningMessage(getLatestLocale()),
        sticky: true,
      });

      if (!recheckTimer) {
        recheckTimer = setInterval(async () => {
          if (activeRequests.size === 0) {
            dismissWarning();
            return;
          }

          const connected = await checkConnectivity();
          if (connected) {
            dismissWarning();
            scheduleDelayedCheck();
          }
        }, CONNECTIVITY_RECHECK_INTERVAL_MS);
      }
    }
  }, CONNECTION_CHECK_DELAY_MS);
}

function ensureListeners(): void {
  if (listenersRegistered || typeof window === 'undefined') return;

  listenersRegistered = true;
  window.addEventListener('online', () => {
    dismissWarning();
    scheduleDelayedCheck();
  });
  window.addEventListener('offline', () => {
    if (activeRequests.size === 0 || warningVisible) return;
    warningVisible = true;
    clearDelayTimer();
    showGlobalErrorToast({
      source: 'sdk',
      message: getConnectionWarningMessage(getLatestLocale()),
      sticky: true,
    });
  });
}

export function trackConnectionWarningRequest(options: ConnectionWarningRequestOptions): () => void {
  ensureListeners();

  const id = Symbol(options.source);
  activeRequests.set(id, options.locale);
  scheduleDelayedCheck();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeRequests.delete(id);

    if (activeRequests.size === 0) {
      clearDelayTimer();
      dismissWarning();
      return;
    }

    if (!warningVisible) {
      clearDelayTimer();
      scheduleDelayedCheck();
    }
  };
}
