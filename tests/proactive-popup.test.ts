import { describe, it, expect, vi } from 'vitest';
import { createProactivePopup } from '../src/chat/components/ProactivePopup.js';

describe('createProactivePopup', () => {
  it('renders message text', () => {
    const popup = createProactivePopup({
      message: 'Yardıma ihtiyacın var mı?',
      onAccept: () => {},
      onDismiss: () => {},
    });
    const msg = popup.querySelector('.gengage-chat-proactive-message');
    expect(msg).not.toBeNull();
    expect(msg!.textContent).toBe('Yardıma ihtiyacın var mı?');
  });

  it('renders default accept button label', () => {
    const popup = createProactivePopup({
      message: 'Test',
      onAccept: () => {},
      onDismiss: () => {},
    });
    const btn = popup.querySelector('.gengage-chat-proactive-accept') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('Sohbete Başla');
  });

  it('renders custom accept button label', () => {
    const popup = createProactivePopup({
      message: 'Test',
      acceptLabel: 'Start Chat',
      onAccept: () => {},
      onDismiss: () => {},
    });
    const btn = popup.querySelector('.gengage-chat-proactive-accept') as HTMLButtonElement;
    expect(btn.textContent).toBe('Start Chat');
  });

  it('renders dismiss button', () => {
    const popup = createProactivePopup({
      message: 'Test',
      onAccept: () => {},
      onDismiss: () => {},
    });
    const btn = popup.querySelector('.gengage-chat-proactive-dismiss') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    expect(btn.textContent).toBe('\u00D7');
  });

  it('calls onAccept and removes popup when accept clicked', () => {
    const onAccept = vi.fn();
    const popup = createProactivePopup({
      message: 'Test',
      onAccept,
      onDismiss: () => {},
    });
    // Attach to DOM so .remove() works
    document.body.appendChild(popup);

    const btn = popup.querySelector('.gengage-chat-proactive-accept') as HTMLButtonElement;
    btn.click();
    expect(onAccept).toHaveBeenCalledOnce();
    expect(popup.parentElement).toBeNull();
  });

  it('calls onDismiss and removes popup when dismiss clicked', () => {
    const onDismiss = vi.fn();
    const popup = createProactivePopup({
      message: 'Test',
      onAccept: () => {},
      onDismiss,
    });
    document.body.appendChild(popup);

    const btn = popup.querySelector('.gengage-chat-proactive-dismiss') as HTMLButtonElement;
    btn.click();
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(popup.parentElement).toBeNull();
  });

  it('auto-dismisses after timeout', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const popup = createProactivePopup({
      message: 'Test',
      onAccept: () => {},
      onDismiss,
      autoDismissMs: 5000,
    });
    document.body.appendChild(popup);

    vi.advanceTimersByTime(4999);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(popup.parentElement).toBeNull();

    vi.useRealTimers();
  });

  it('cancels auto-dismiss timer when accept is clicked', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const onAccept = vi.fn();
    const popup = createProactivePopup({
      message: 'Test',
      onAccept,
      onDismiss,
      autoDismissMs: 5000,
    });
    document.body.appendChild(popup);

    const btn = popup.querySelector('.gengage-chat-proactive-accept') as HTMLButtonElement;
    btn.click();
    expect(onAccept).toHaveBeenCalledOnce();

    // Timer should have been cancelled; advancing time should NOT fire onDismiss
    vi.advanceTimersByTime(10000);
    expect(onDismiss).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('cancels auto-dismiss timer when dismiss is clicked', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const popup = createProactivePopup({
      message: 'Test',
      onAccept: () => {},
      onDismiss,
      autoDismissMs: 5000,
    });
    document.body.appendChild(popup);

    const btn = popup.querySelector('.gengage-chat-proactive-dismiss') as HTMLButtonElement;
    btn.click();
    expect(onDismiss).toHaveBeenCalledOnce();

    // Timer should have been cancelled; advancing time should NOT fire onDismiss again
    vi.advanceTimersByTime(10000);
    expect(onDismiss).toHaveBeenCalledOnce();

    vi.useRealTimers();
  });

  it('does not auto-dismiss when autoDismissMs is 0', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const popup = createProactivePopup({
      message: 'Test',
      onAccept: () => {},
      onDismiss,
      autoDismissMs: 0,
    });
    document.body.appendChild(popup);

    vi.advanceTimersByTime(60000);
    expect(onDismiss).not.toHaveBeenCalled();
    popup.remove();

    vi.useRealTimers();
  });
});
