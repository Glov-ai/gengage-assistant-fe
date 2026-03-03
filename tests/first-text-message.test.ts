import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('isFirstTextMessage styling', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('first bot message in thread gets --first class', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const drawer = new ChatDrawer(container, {
      i18n: {} as never,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });

    drawer.markFirstBotMessage('msg-1');
    drawer.addMessage({ id: 'msg-1', role: 'assistant', content: 'Hello', timestamp: Date.now(), status: 'done' });

    const bubble = container.querySelector('[data-message-id="msg-1"]');
    expect(bubble?.classList.contains('gengage-chat-bubble--first')).toBe(true);
  });

  it('second bot message does NOT get --first class', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const drawer = new ChatDrawer(container, {
      i18n: {} as never,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });

    drawer.markFirstBotMessage('msg-1');
    drawer.addMessage({ id: 'msg-1', role: 'assistant', content: 'First', timestamp: Date.now(), status: 'done' });
    drawer.addMessage({ id: 'msg-2', role: 'assistant', content: 'Second', timestamp: Date.now(), status: 'done' });

    const bubble2 = container.querySelector('[data-message-id="msg-2"]');
    expect(bubble2?.classList.contains('gengage-chat-bubble--first')).toBe(false);
  });

  it('different threads each get their own first message', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const drawer = new ChatDrawer(container, {
      i18n: {} as never,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });

    drawer.markFirstBotMessage('msg-1');
    drawer.markFirstBotMessage('msg-3');
    drawer.addMessage({
      id: 'msg-1',
      role: 'assistant',
      content: 'Thread A first',
      timestamp: Date.now(),
      status: 'done',
      threadId: 'thread-a',
    });
    drawer.addMessage({
      id: 'msg-2',
      role: 'assistant',
      content: 'Thread A second',
      timestamp: Date.now(),
      status: 'done',
      threadId: 'thread-a',
    });
    drawer.addMessage({
      id: 'msg-3',
      role: 'assistant',
      content: 'Thread B first',
      timestamp: Date.now(),
      status: 'done',
      threadId: 'thread-b',
    });

    expect(container.querySelector('[data-message-id="msg-1"]')?.classList.contains('gengage-chat-bubble--first')).toBe(
      true,
    );
    expect(container.querySelector('[data-message-id="msg-2"]')?.classList.contains('gengage-chat-bubble--first')).toBe(
      false,
    );
    expect(container.querySelector('[data-message-id="msg-3"]')?.classList.contains('gengage-chat-bubble--first')).toBe(
      true,
    );
  });

  it('markFirstBotMessage adds class to already-rendered bubble', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const drawer = new ChatDrawer(container, {
      i18n: {} as never,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });

    // Add message first, then mark
    drawer.addMessage({ id: 'msg-1', role: 'assistant', content: 'Hello', timestamp: Date.now(), status: 'done' });
    const bubble = container.querySelector('[data-message-id="msg-1"]');
    expect(bubble?.classList.contains('gengage-chat-bubble--first')).toBe(false);

    drawer.markFirstBotMessage('msg-1');
    expect(bubble?.classList.contains('gengage-chat-bubble--first')).toBe(true);
  });
});
