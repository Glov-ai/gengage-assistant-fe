import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { wireQNAToChat, dispatch } from '../src/common/events.js';

describe('wireQNAToChat', () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    (window as unknown as Record<string, unknown>).gengage = undefined;
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('calls chat.open when chat is available', () => {
    const open = vi.fn();
    (window as unknown as Record<string, unknown>).gengage = {
      chat: { open, openWithAction: vi.fn(), sendMessage: vi.fn() },
    };

    cleanup = wireQNAToChat();
    dispatch('gengage:qna:open-chat', {});

    expect(open).toHaveBeenCalledOnce();
  });

  it('calls chat.openWithAction when chat is available', () => {
    const openWithAction = vi.fn();
    (window as unknown as Record<string, unknown>).gengage = {
      chat: { open: vi.fn(), openWithAction, sendMessage: vi.fn() },
    };

    cleanup = wireQNAToChat();
    const action = { title: 'Test', type: 'query' as const, payload: 'test' };
    dispatch('gengage:qna:action', action);

    expect(openWithAction).toHaveBeenCalledWith(action);
  });

  it('routes user_message action to chat.sendMessage', () => {
    const open = vi.fn();
    const sendMessage = vi.fn();
    const openWithAction = vi.fn();
    (window as unknown as Record<string, unknown>).gengage = {
      chat: { open, openWithAction, sendMessage },
    };

    cleanup = wireQNAToChat();
    dispatch('gengage:qna:action', {
      title: 'Bir soru',
      type: 'user_message',
      payload: 'Bu urun nefes alabilir mi?',
    });

    expect(open).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith('Bu urun nefes alabilir mi?');
    expect(openWithAction).not.toHaveBeenCalled();
  });

  it('routes inputText action with payload.text to chat.sendMessage', () => {
    const open = vi.fn();
    const sendMessage = vi.fn();
    const openWithAction = vi.fn();
    (window as unknown as Record<string, unknown>).gengage = {
      chat: { open, openWithAction, sendMessage },
    };

    cleanup = wireQNAToChat();
    dispatch('gengage:qna:action', {
      title: 'Baslik',
      type: 'inputText',
      payload: { text: 'Metin from payload' },
    });

    expect(open).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith('Metin from payload');
    expect(openWithAction).not.toHaveBeenCalled();
  });

  it('emits console.warn once when chat is not available', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    cleanup = wireQNAToChat();
    dispatch('gengage:qna:open-chat', {});
    dispatch('gengage:qna:open-chat', {});

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toMatch(/chat widget is not initialized/);
    warnSpy.mockRestore();
  });

  it('calls onChatUnavailable callback every time when chat is not available', () => {
    const onChatUnavailable = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    cleanup = wireQNAToChat({ onChatUnavailable });
    dispatch('gengage:qna:open-chat', {});
    dispatch('gengage:qna:open-chat', {});

    expect(onChatUnavailable).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });

  it('does not warn or call callback when chat becomes available', () => {
    const onChatUnavailable = vi.fn();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    cleanup = wireQNAToChat({ onChatUnavailable });

    // First dispatch — no chat
    dispatch('gengage:qna:open-chat', {});
    expect(onChatUnavailable).toHaveBeenCalledOnce();

    // Chat becomes available
    const open = vi.fn();
    (window as unknown as Record<string, unknown>).gengage = {
      chat: { open, openWithAction: vi.fn(), sendMessage: vi.fn() },
    };
    dispatch('gengage:qna:open-chat', {});

    // Should call open, not onChatUnavailable
    expect(open).toHaveBeenCalledOnce();
    expect(onChatUnavailable).toHaveBeenCalledOnce(); // still 1, not 2
    vi.restoreAllMocks();
  });

  it('queues qna action until chat becomes available', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    cleanup = wireQNAToChat();
    const action = { title: 'Test', type: 'query' as const, payload: 'test' };
    dispatch('gengage:qna:action', action);

    const openWithAction = vi.fn();
    (window as unknown as Record<string, unknown>).gengage = {
      chat: { open: vi.fn(), openWithAction, sendMessage: vi.fn() },
    };

    vi.advanceTimersByTime(150);
    expect(openWithAction).toHaveBeenCalledWith(action);

    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('queues open-chat until chat becomes available', () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    cleanup = wireQNAToChat();
    dispatch('gengage:qna:open-chat', {});

    const open = vi.fn();
    (window as unknown as Record<string, unknown>).gengage = {
      chat: { open, openWithAction: vi.fn(), sendMessage: vi.fn() },
    };

    vi.advanceTimersByTime(150);
    expect(open).toHaveBeenCalledOnce();

    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
