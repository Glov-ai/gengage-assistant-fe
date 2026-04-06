import { describe, it, expect, vi } from 'vitest';

describe('ChatDrawer stop button', () => {
  it('showStopButton reuses the send button in stop mode and hideStopButton restores it', async () => {
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const container = document.createElement('div');
    const drawer = new ChatDrawer(container, {
      i18n: (await import('../src/chat/locales/en.js')).CHAT_I18N_EN,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });
    container.appendChild(drawer.getElement());

    const stopFn = vi.fn();
    drawer.showStopButton(stopFn);

    const btn = drawer.getElement().querySelector('.gengage-chat-send') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.classList.contains('gengage-chat-send--stop')).toBe(true);
    expect(btn.getAttribute('aria-label')).toContain('Stop generating');

    btn.click();
    expect(stopFn).toHaveBeenCalledOnce();

    drawer.hideStopButton();
    expect(btn.classList.contains('gengage-chat-send--stop')).toBe(false);
    expect(btn.getAttribute('aria-label')).toContain('Send');
  });

  it('removeTypingIndicator also restores send button from stop mode', async () => {
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const container = document.createElement('div');
    const drawer = new ChatDrawer(container, {
      i18n: (await import('../src/chat/locales/en.js')).CHAT_I18N_EN,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });
    container.appendChild(drawer.getElement());

    drawer.showTypingIndicator();
    drawer.showStopButton(vi.fn());
    const btn = drawer.getElement().querySelector('.gengage-chat-send') as HTMLButtonElement;
    expect(btn.classList.contains('gengage-chat-send--stop')).toBe(true);

    drawer.removeTypingIndicator();
    expect(btn.classList.contains('gengage-chat-send--stop')).toBe(false);
  });
});

describe('ChatDrawer focus trap', () => {
  it('trapFocus and releaseFocus manage keyboard handler', async () => {
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const container = document.createElement('div');
    const drawer = new ChatDrawer(container, {
      i18n: (await import('../src/chat/locales/en.js')).CHAT_I18N_EN,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });
    container.appendChild(drawer.getElement());
    document.body.appendChild(container);

    drawer.trapFocus();

    // Should be able to release without error
    drawer.releaseFocus();

    // Double release is safe
    drawer.releaseFocus();

    document.body.removeChild(container);
  });
});

describe('ChatDrawer offline bar', () => {
  it('shows offline bar when browser goes offline and hides on online', async () => {
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const container = document.createElement('div');
    const drawer = new ChatDrawer(container, {
      i18n: (await import('../src/chat/locales/en.js')).CHAT_I18N_EN,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });
    container.appendChild(drawer.getElement());

    const bar = drawer.getElement().querySelector('.gengage-chat-offline-bar') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.textContent).toContain('offline');

    // Initially online — bar should be hidden
    expect(bar.classList.contains('gengage-chat-offline-bar--visible')).toBe(false);

    // Simulate going offline
    window.dispatchEvent(new Event('offline'));
    expect(bar.classList.contains('gengage-chat-offline-bar--visible')).toBe(true);

    // Simulate reconnecting
    window.dispatchEvent(new Event('online'));
    expect(bar.classList.contains('gengage-chat-offline-bar--visible')).toBe(false);
  });

  it('destroy removes offline event listeners', async () => {
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const container = document.createElement('div');
    const drawer = new ChatDrawer(container, {
      i18n: (await import('../src/chat/locales/en.js')).CHAT_I18N_EN,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });
    container.appendChild(drawer.getElement());

    const bar = drawer.getElement().querySelector('.gengage-chat-offline-bar') as HTMLElement;
    drawer.destroy();

    // After destroy, offline event should not affect the bar
    window.dispatchEvent(new Event('offline'));
    expect(bar.classList.contains('gengage-chat-offline-bar--visible')).toBe(false);
  });
});

describe('ChatDrawer typing indicator', () => {
  it('does not show the removed "still working" hint after extended typing', async () => {
    vi.useFakeTimers();
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const container = document.createElement('div');
    const drawer = new ChatDrawer(container, {
      i18n: (await import('../src/chat/locales/en.js')).CHAT_I18N_EN,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });
    container.appendChild(drawer.getElement());

    drawer.showTypingIndicator();

    vi.advanceTimersByTime(9000);
    expect(drawer.getElement().querySelector('.gengage-chat-still-working')).toBeNull();

    vi.advanceTimersByTime(4000);
    expect(drawer.getElement().querySelector('.gengage-chat-still-working')).toBeNull();

    drawer.removeTypingIndicator();
    expect(drawer.getElement().querySelector('.gengage-chat-still-working')).toBeNull();

    vi.useRealTimers();
  });

  it('clears typing indicator cleanly if removed within 10s', async () => {
    vi.useFakeTimers();
    const { ChatDrawer } = await import('../src/chat/components/ChatDrawer.js');
    const container = document.createElement('div');
    const drawer = new ChatDrawer(container, {
      i18n: (await import('../src/chat/locales/en.js')).CHAT_I18N_EN,
      onSend: vi.fn(),
      onClose: vi.fn(),
    });
    container.appendChild(drawer.getElement());

    drawer.showTypingIndicator();
    vi.advanceTimersByTime(5000);
    drawer.removeTypingIndicator();
    vi.advanceTimersByTime(10000);

    expect(drawer.getElement().querySelector('.gengage-chat-still-working')).toBeNull();
    vi.useRealTimers();
  });
});

describe('debug mode', () => {
  it('debugLog is no-op when gengage:debug is not set', async () => {
    const { debugLog, _resetDebugCache } = await import('../src/common/debug.js');
    _resetDebugCache();
    localStorage.removeItem('gengage:debug');
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    debugLog('test', 'hello');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    _resetDebugCache();
  });

  it('debugLog logs when gengage:debug is set to 1', async () => {
    const { debugLog, _resetDebugCache } = await import('../src/common/debug.js');
    _resetDebugCache();
    localStorage.setItem('gengage:debug', '1');
    const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    debugLog('test', 'hello', { data: 1 });
    expect(spy).toHaveBeenCalledWith('[gengage:test]', 'hello', { data: 1 });
    spy.mockRestore();
    localStorage.removeItem('gengage:debug');
    _resetDebugCache();
  });
});
