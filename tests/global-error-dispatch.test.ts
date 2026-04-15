import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GengageChat } from '../src/chat/index.js';
import { sendChatMessage } from '../src/chat/api.js';
import { GengageQNA } from '../src/qna/index.js';
import { fetchLauncherActions } from '../src/qna/api.js';
import { GengageSimRel } from '../src/simrel/index.js';
import { fetchSimilarProducts } from '../src/simrel/api.js';

vi.mock('../src/chat/api.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/chat/api.js')>();
  return {
    ...actual,
    sendChatMessage: vi.fn(),
  };
});

vi.mock('../src/qna/api.js', () => ({
  fetchLauncherActions: vi.fn(),
}));

vi.mock('../src/simrel/api.js', () => ({
  fetchSimilarProducts: vi.fn(),
  fetchProductGroupings: vi.fn(),
}));

const mockedSendChatMessage = sendChatMessage as unknown as ReturnType<typeof vi.fn>;
const mockedFetchLauncherActions = fetchLauncherActions as unknown as ReturnType<typeof vi.fn>;
const mockedFetchSimilarProducts = fetchSimilarProducts as unknown as ReturnType<typeof vi.fn>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let navigatorOnLineDescriptor: PropertyDescriptor | undefined;

type GlobalErrorDetail = {
  source: 'chat' | 'qna' | 'simrel' | 'sdk';
  message: string;
  code?: string;
  durationMs?: number;
};

function collectGlobalErrors(): { events: GlobalErrorDetail[]; stop: () => void } {
  const events: GlobalErrorDetail[] = [];
  const handler = (event: Event) => {
    events.push((event as CustomEvent<GlobalErrorDetail>).detail);
  };
  window.addEventListener('gengage:global:error', handler);
  return {
    events,
    stop: () => window.removeEventListener('gengage:global:error', handler),
  };
}

describe('global error event dispatch', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    navigatorOnLineDescriptor = Object.getOwnPropertyDescriptor(window.Navigator.prototype, 'onLine');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    if (navigatorOnLineDescriptor) {
      Object.defineProperty(window.Navigator.prototype, 'onLine', navigatorOnLineDescriptor);
    }
    document.body.innerHTML = '';
  });

  it('shows error inline in chat drawer on stream failure (no global toast)', async () => {
    mockedSendChatMessage.mockImplementation((_request, callbacks) => {
      callbacks.onError(new Error('HTTP 500'));
      return new AbortController();
    });

    const collector = collectGlobalErrors();
    const errors: Error[] = [];
    const chat = new GengageChat();
    chat.on('error', (err) => errors.push(err as Error));
    await chat.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
      locale: 'en',
    });

    chat.openWithAction({
      title: 'Ask',
      type: 'user_message',
      payload: 'hello',
    });

    // Chat stream errors now render inline — no global toast dispatch
    expect(collector.events).toHaveLength(0);
    // Widget emits 'error' event for programmatic consumers
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toBe('HTTP 500');

    collector.stop();
    chat.destroy();
  });

  it('does not append a generic inline error when chat fails while offline', async () => {
    mockedSendChatMessage.mockImplementation((_request, callbacks) => {
      callbacks.onError(new TypeError('Failed to fetch'));
      return new AbortController();
    });
    Object.defineProperty(window.Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const collector = collectGlobalErrors();
    const chat = new GengageChat();
    await chat.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
      locale: 'tr',
    });

    chat.openWithAction({
      title: 'Sor',
      type: 'user_message',
      payload: 'merhaba',
    });

    const shadow = (chat as any)._shadow as ShadowRoot | null;
    expect(shadow?.querySelector('.gengage-chat-offline-bar--visible')).not.toBeNull();
    expect(shadow?.querySelector('.gengage-chat-error')).toBeNull();
    expect(collector.events).toHaveLength(0);

    collector.stop();
    chat.destroy();
  });

  it('short-circuits free-text messages when PDP context is unavailable', async () => {
    const chat = new GengageChat();
    await chat.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
      pageContext: { pageType: 'pdp', sku: 'BAD-SKU' },
      locale: 'tr',
    });

    (chat as any)._pdpLaunched = true;
    (chat as any)._productContextUnavailableSku = 'BAD-SKU';
    (chat as any)._assistantMode = 'shopping';

    chat.open();
    chat.sendMessage('bu urun nedir');

    // Message should NOT reach the backend — frontend short-circuits with fallback
    expect(mockedSendChatMessage).not.toHaveBeenCalled();

    chat.destroy();
  });

  it('dispatches gengage:global:error on qna fetch failure', async () => {
    mockedFetchLauncherActions.mockRejectedValue(new Error('launcher failed'));

    const host = document.createElement('div');
    host.id = 'qna-mount';
    document.body.appendChild(host);

    const collector = collectGlobalErrors();
    const qna = new GengageQNA();
    await qna.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
      mountTarget: '#qna-mount',
      pageContext: { pageType: 'pdp', sku: 'SKU-1' },
      locale: 'en',
    });

    expect(collector.events).toHaveLength(1);
    expect(collector.events[0]).toMatchObject({
      source: 'qna',
      code: 'FETCH_ERROR',
      message: 'Something went wrong. Please try again.',
    });

    // QNA should remain usable even when launcher fetch fails.
    const input = host.querySelector('.gengage-qna-input');
    const send = host.querySelector('.gengage-qna-send');
    expect(input).toBeTruthy();
    expect(send).toBeTruthy();

    collector.stop();
    qna.destroy();
  });

  it('dispatches gengage:global:error on simrel fetch failure', async () => {
    mockedFetchSimilarProducts.mockRejectedValue(new Error('simrel failed'));

    const host = document.createElement('div');
    host.id = 'simrel-mount';
    document.body.appendChild(host);

    const collector = collectGlobalErrors();
    const simrel = new GengageSimRel();
    await simrel.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
      sku: 'SKU-1',
      mountTarget: '#simrel-mount',
      locale: 'en',
    });

    expect(collector.events).toHaveLength(1);
    expect(collector.events[0]).toMatchObject({
      source: 'simrel',
      code: 'FETCH_ERROR',
      message: 'Something went wrong. Please try again.',
    });

    collector.stop();
    simrel.destroy();
  });

  it('uses a connection warning when qna fetch fails while offline', async () => {
    mockedFetchLauncherActions.mockRejectedValue(new TypeError('Failed to fetch'));
    Object.defineProperty(window.Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const host = document.createElement('div');
    host.id = 'qna-offline-mount';
    document.body.appendChild(host);

    const collector = collectGlobalErrors();
    const qna = new GengageQNA();
    await qna.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
      mountTarget: '#qna-offline-mount',
      pageContext: { pageType: 'pdp', sku: 'SKU-1' },
      locale: 'en',
    });

    expect(collector.events).toHaveLength(1);
    expect(collector.events[0]).toMatchObject({
      source: 'qna',
      code: 'FETCH_ERROR',
      message: 'Connection issue. Please try again.',
    });

    collector.stop();
    qna.destroy();
  });
});
