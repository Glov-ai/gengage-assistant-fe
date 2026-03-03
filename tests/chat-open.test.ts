import { describe, it, expect, beforeEach } from 'vitest';
import { GengageChat } from '../src/chat/index.js';

describe('GengageChat.open', () => {
  let chat: GengageChat;

  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-root"></div>';
    chat = new GengageChat();
  });

  it('opens without initialMessage (existing behavior)', async () => {
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    chat.open();
    expect(chat.isOpen).toBe(true);
  });

  it('opens with initialMessage and renders user bubble', async () => {
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    chat.open({ initialMessage: 'Help me find a faucet' });
    expect(chat.isOpen).toBe(true);

    // The user message should be rendered in the messages area inside shadow DOM
    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const userBubble = shadow?.querySelector('.gengage-chat-bubble--user');
    expect(userBubble).not.toBeNull();
    expect(userBubble?.textContent).toContain('Help me find a faucet');
  });

  it('accepts initialMessage via window.gengage public API', async () => {
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      variant: 'inline',
      session: { sessionId: 'test-session' },
    });

    window.gengage?.chat?.open({ initialMessage: 'Test message' });
    expect(chat.isOpen).toBe(true);

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const userBubble = shadow?.querySelector('.gengage-chat-bubble--user');
    expect(userBubble).not.toBeNull();
    expect(userBubble?.textContent).toContain('Test message');
  });
});
