import { describe, it, expect, beforeEach } from 'vitest';
import { GengageChat } from '../src/chat/index.js';

describe('Chat welcome message', () => {
  let chat: GengageChat;

  beforeEach(() => {
    document.body.innerHTML = '<div id="chat-root"></div>';
    chat = new GengageChat();
  });

  it('shows welcome message on first open with empty history', async () => {
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      session: { sessionId: 'test-session' },
      welcomeMessage: 'Hello! How can I help you today?',
    });

    chat.open();

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const botBubble = shadow?.querySelector('.gengage-chat-bubble--assistant');
    expect(botBubble).not.toBeNull();
    expect(botBubble?.textContent).toContain('Hello! How can I help you today?');
  });

  it('does not show welcome message when no welcomeMessage config', async () => {
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      session: { sessionId: 'test-session' },
    });

    chat.open();

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const botBubble = shadow?.querySelector('.gengage-chat-bubble--assistant');
    expect(botBubble).toBeNull();
  });

  it('shows welcome actions as pills', async () => {
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      session: { sessionId: 'test-session' },
      welcomeMessage: 'Hello!',
      welcomeActions: ['Find products', 'Get recommendations'],
    });

    chat.open();

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const pills = shadow?.querySelectorAll('.gengage-chat-pill');
    expect(pills?.length).toBe(2);
    expect(pills?.[0]?.textContent).toContain('Find products');
    expect(pills?.[1]?.textContent).toContain('Get recommendations');
  });

  it('does not duplicate welcome on re-open', async () => {
    await chat.init({
      accountId: 'test',
      middlewareUrl: 'https://test.example.com',
      mountTarget: '#chat-root',
      session: { sessionId: 'test-session' },
      welcomeMessage: 'Hello!',
    });

    chat.open();
    chat.close();
    chat.open();

    const shadow = (chat as unknown as Record<string, unknown>)['_shadow'] as ShadowRoot | null;
    const botBubbles = shadow?.querySelectorAll('.gengage-chat-bubble--assistant');
    // Should still only have 1 welcome message, not 2
    expect(botBubbles?.length).toBe(1);
  });
});
