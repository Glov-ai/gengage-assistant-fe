import { describe, it, expect, vi } from 'vitest';
import { createQuantityStepper } from '../src/common/quantity-stepper.js';

describe('ATC success feedback', () => {
  it('shows checkmark and success class after submit', () => {
    vi.useFakeTimers();
    const onSubmit = vi.fn();
    const stepper = createQuantityStepper({ onSubmit, label: 'Add' });
    const submitBtn = stepper.querySelector('.gengage-qty-submit') as HTMLButtonElement;

    submitBtn.click();
    expect(onSubmit).toHaveBeenCalledWith(1);
    expect(submitBtn.textContent).toBe('\u2713');
    expect(submitBtn.classList.contains('gengage-qty-submit--success')).toBe(true);
    expect(submitBtn.disabled).toBe(true);

    vi.advanceTimersByTime(1200);
    expect(submitBtn.textContent).toBe('Add');
    expect(submitBtn.classList.contains('gengage-qty-submit--success')).toBe(false);
    expect(submitBtn.disabled).toBe(false);
    vi.useRealTimers();
  });
});

describe('ChatDrawer stop button', () => {
  it('showStopButton creates and hideStopButton removes the stop button', async () => {
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

    const btn = drawer.getElement().querySelector('.gengage-chat-stop-btn') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toContain('Stop generating');

    btn.click();
    expect(stopFn).toHaveBeenCalledOnce();

    // After click, button should be removed
    const afterClick = drawer.getElement().querySelector('.gengage-chat-stop-btn');
    expect(afterClick).toBeNull();
  });

  it('removeTypingIndicator also removes stop button', async () => {
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
    expect(drawer.getElement().querySelector('.gengage-chat-stop-btn')).not.toBeNull();

    drawer.removeTypingIndicator();
    expect(drawer.getElement().querySelector('.gengage-chat-stop-btn')).toBeNull();
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

describe('ChatDrawer still working message', () => {
  it('shows "still working" text after 10s of typing with no text chunks', async () => {
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

    // Before 10s — no hint
    vi.advanceTimersByTime(9000);
    expect(drawer.getElement().querySelector('.gengage-chat-still-working')).toBeNull();

    // After 10s — hint appears
    vi.advanceTimersByTime(1500);
    const hint = drawer.getElement().querySelector('.gengage-chat-still-working');
    expect(hint).not.toBeNull();
    expect(hint!.textContent).toContain('Still working');

    // removeTypingIndicator clears it
    drawer.removeTypingIndicator();
    expect(drawer.getElement().querySelector('.gengage-chat-still-working')).toBeNull();

    vi.useRealTimers();
  });

  it('does not show hint if typing indicator is removed within 10s', async () => {
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
