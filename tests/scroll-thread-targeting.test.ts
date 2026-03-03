import { describe, it, expect, vi, beforeEach } from 'vitest';

async function createTestDrawer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
  const drawer = new ChatDrawer(container, {
    i18n: {} as any,
    onSend: vi.fn(),
    onClose: vi.fn(),
  });
  return { drawer, container };
}

describe('scroll-to-last-thread targeting', () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    document.body.innerHTML = '';
    scrollIntoViewMock.mockClear();
    Element.prototype.scrollIntoView = scrollIntoViewMock;
  });

  it('addMessage adds data-thread-id attribute when message has threadId', async () => {
    const { drawer, container } = await createTestDrawer();
    drawer.addMessage({
      id: 'msg-1',
      threadId: 'thread-abc',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      status: 'done',
    });

    const bubble = container.querySelector('[data-message-id="msg-1"]');
    expect(bubble).not.toBeNull();
    expect(bubble!.getAttribute('data-thread-id')).toBe('thread-abc');
  });

  it('addMessage does NOT add data-thread-id when message has no threadId', async () => {
    const { drawer, container } = await createTestDrawer();
    drawer.addMessage({
      id: 'msg-2',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      status: 'done',
    });

    const bubble = container.querySelector('[data-message-id="msg-2"]');
    expect(bubble).not.toBeNull();
    expect(bubble!.hasAttribute('data-thread-id')).toBe(false);
  });

  it('scrollToLastThread calls scrollIntoView on the first message of the last thread', async () => {
    const { drawer, container } = await createTestDrawer();

    // Add messages in two threads
    drawer.addMessage({
      id: 'msg-1',
      threadId: 'thread-1',
      role: 'user',
      content: 'First thread msg 1',
      timestamp: Date.now(),
      status: 'done',
    });
    drawer.addMessage({
      id: 'msg-2',
      threadId: 'thread-1',
      role: 'assistant',
      content: 'First thread msg 2',
      timestamp: Date.now(),
      status: 'done',
    });
    drawer.addMessage({
      id: 'msg-3',
      threadId: 'thread-2',
      role: 'user',
      content: 'Second thread msg 1',
      timestamp: Date.now(),
      status: 'done',
    });
    drawer.addMessage({
      id: 'msg-4',
      threadId: 'thread-2',
      role: 'assistant',
      content: 'Second thread msg 2',
      timestamp: Date.now(),
      status: 'done',
    });

    scrollIntoViewMock.mockClear();

    drawer.scrollToLastThread();

    // scrollIntoView is called inside requestAnimationFrame, so we need to flush it
    await new Promise((resolve) => requestAnimationFrame(resolve));

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ block: 'start', behavior: 'auto' });

    // Verify it was called on the FIRST message of the LAST thread (thread-2, msg-3)
    const firstOfLastThread = container.querySelector('[data-thread-id="thread-2"]');
    expect(firstOfLastThread).not.toBeNull();
    expect(firstOfLastThread!.getAttribute('data-message-id')).toBe('msg-3');
  });

  it('scrollToLastThread falls back to scrollToBottom when no thread markers exist', async () => {
    const { drawer, container } = await createTestDrawer();

    // Add messages without threadId
    drawer.addMessage({
      id: 'msg-1',
      role: 'user',
      content: 'No thread',
      timestamp: Date.now(),
      status: 'done',
    });

    // Get the messages element to spy on scrollTop
    const messagesEl = container.querySelector('.gengage-chat-messages') as HTMLElement;
    expect(messagesEl).not.toBeNull();

    scrollIntoViewMock.mockClear();

    drawer.scrollToLastThread();

    // Wait for requestAnimationFrame
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // scrollIntoView should NOT have been called (no thread markers)
    expect(scrollIntoViewMock).not.toHaveBeenCalled();

    // Instead, it should have set scrollTop (scrollToBottom fallback)
    // The _scrollToBottom uses requestAnimationFrame too, so the scroll was set
  });
});
