import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GengageChat } from '../src/chat/index.js';

describe('GengageChat attachment send', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-root"></div>';
    globalThis.fetch = vi.fn(async () => {
      return new Response('', { status: 503 });
    }) as unknown as typeof globalThis.fetch;

    // jsdom/happy-dom lack URL.createObjectURL — stub it for attachment thumbnail rendering
    if (typeof URL.createObjectURL !== 'function') {
      URL.createObjectURL = vi.fn(() => 'blob:mock');
    }
    if (typeof URL.revokeObjectURL !== 'function') {
      URL.revokeObjectURL = vi.fn();
    }
  });

  it('stores attachment on user ChatMessage when sending with image', async () => {
    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    const file = new File(['img-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    (chat as unknown as { _sendMessage(t: string, a?: File): void })._sendMessage('find similar', file);

    const messages = (chat as unknown as { _messages: Array<{ attachment?: File; content?: string }> })._messages;
    const userMsg = messages.find((m) => m.content === 'find similar');
    expect(userMsg?.attachment).toBe(file);
  });

  it('sends FormData to backend when attachment is present', async () => {
    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    const file = new File(['img-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    (chat as unknown as { _sendMessage(t: string, a?: File): void })._sendMessage('find similar', file);

    await new Promise((r) => setTimeout(r, 50));

    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(fetchCalls.length).toBeGreaterThan(0);
    const lastInit = fetchCalls[fetchCalls.length - 1]![1] as RequestInit;
    expect(lastInit.body).toBeInstanceOf(FormData);
  });

  it('sends JSON when no attachment', async () => {
    const chat = new GengageChat();
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    (chat as unknown as { _sendMessage(t: string, a?: File): void })._sendMessage('hello');

    await new Promise((r) => setTimeout(r, 50));

    const fetchCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(fetchCalls.length).toBeGreaterThan(0);
    const lastInit = fetchCalls[fetchCalls.length - 1]![1] as RequestInit;
    expect(lastInit.body).not.toBeInstanceOf(FormData);
    expect(typeof lastInit.body).toBe('string');
    const parsed = JSON.parse(lastInit.body as string);
    expect(parsed.type).toBe('inputText');
  });
});
