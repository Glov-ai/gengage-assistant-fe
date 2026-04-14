import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GengageChat } from '../src/chat/index.js';

describe('beauty consulting migration', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-root"></div>';
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    }
  });

  it('switches to beauty mode and calls beauty_consulting_init endpoint', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/chat/beauty_consulting_init')) {
        return new Response(JSON.stringify({ assistant_reply: 'Beauty flow started.' }), { status: 200 });
      }
      return new Response('', { status: 503 });
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    await (chat as unknown as { _handleRedirectMetadata(payload: unknown): Promise<void> })._handleRedirectMetadata({
      assistant_mode: 'beauty_consulting',
      scenario: 'shade_advisor',
    });

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes('/chat/beauty_consulting_init'))).toBe(true);

    const drawer = (chat as unknown as { _drawer?: { inputEl?: HTMLTextAreaElement } })._drawer;
    expect(drawer?.inputEl?.placeholder).toBe('Cilt tipini yaz veya bir fotoğraf yükle');
  });

  it('sends attachment as inputText in beauty mode', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/chat/beauty_consulting_init')) {
        return new Response(JSON.stringify({ assistant_reply: 'Hazırım.' }), { status: 200 });
      }
      if (url.includes('/chat/process_action')) {
        return new Response('', { status: 503 });
      }
      return new Response('', { status: 404 });
    });
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

    const chat = new GengageChat();
    await chat.init({
      accountId: 'flormarcomtr',
      middlewareUrl: 'https://api.test.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    await (chat as unknown as { _handleRedirectMetadata(payload: unknown): Promise<void> })._handleRedirectMetadata({
      assistant_mode: 'beauty_consulting',
      scenario: 'shade_advisor',
    });

    const file = new File(['img-bytes'], 'face.jpg', { type: 'image/jpeg' });
    (chat as unknown as { _sendMessage(text: string, attachment?: File): void })._sendMessage('cildim kuru', file);
    await new Promise((resolve) => setTimeout(resolve, 30));

    const processCall = fetchMock.mock.calls.find((call) => String(call[0]).includes('/chat/process_action'));
    expect(processCall).toBeDefined();
    const init = processCall?.[1] as RequestInit;
    expect(init.body).toBeInstanceOf(FormData);
    const formData = init.body as FormData;
    const requestRaw = formData.get('request');
    expect(typeof requestRaw).toBe('string');
    const request = JSON.parse(requestRaw as string) as Record<string, unknown>;
    expect(request.type).toBe('inputText');
    const payload = request.payload as Record<string, unknown>;
    expect(payload['assistant_mode']).toBe('beauty_consulting');
    expect(payload['text']).toBe('cildim kuru');
  });
});
