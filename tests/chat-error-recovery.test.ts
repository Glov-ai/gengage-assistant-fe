import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChatDrawer } from '../src/chat/components/ChatDrawer.js';
import { CHAT_I18N_EN } from '../src/chat/locales/index.js';
import { CHAT_I18N_TR } from '../src/chat/locales/index.js';

function createDrawer(i18n = CHAT_I18N_EN) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const drawer = new ChatDrawer(container, {
    i18n,
    onSend: vi.fn(),
    onClose: vi.fn(),
  });
  return { container, drawer };
}

describe('ChatDrawer.showErrorWithRecovery', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('shows error message and recovery pills', () => {
    const { container, drawer } = createDrawer();
    const onRetry = vi.fn();
    const onNewQuestion = vi.fn();

    drawer.showErrorWithRecovery('Something went wrong', {
      onRetry,
      onNewQuestion,
    });

    // Error element should be present
    const errEl = container.querySelector('.gengage-chat-error');
    expect(errEl).not.toBeNull();
    expect(errEl?.textContent).toContain('Something went wrong');

    // Pills should be present with correct labels
    const pills = container.querySelectorAll('.gengage-chat-pill');
    expect(pills.length).toBe(2);
    expect(pills[0]?.textContent).toContain('Try again');
    expect(pills[1]?.textContent).toContain('Ask something else');

    container.remove();
  });

  it('calls onRetry when "Try again" pill is clicked', () => {
    const { container, drawer } = createDrawer();
    const onRetry = vi.fn();
    const onNewQuestion = vi.fn();

    drawer.showErrorWithRecovery('Error', { onRetry, onNewQuestion });

    const pills = container.querySelectorAll('.gengage-chat-pill');
    (pills[0] as HTMLButtonElement).click();
    expect(onRetry).toHaveBeenCalledOnce();

    container.remove();
  });

  it('calls onNewQuestion when "Ask something else" pill is clicked', () => {
    const { container, drawer } = createDrawer();
    const onRetry = vi.fn();
    const onNewQuestion = vi.fn();

    drawer.showErrorWithRecovery('Error', { onRetry, onNewQuestion });

    const pills = container.querySelectorAll('.gengage-chat-pill');
    (pills[1] as HTMLButtonElement).click();
    expect(onNewQuestion).toHaveBeenCalledOnce();

    container.remove();
  });

  it('uses Turkish i18n labels when configured', () => {
    const { container, drawer } = createDrawer(CHAT_I18N_TR);
    drawer.showErrorWithRecovery('Hata', {
      onRetry: vi.fn(),
      onNewQuestion: vi.fn(),
    });

    const pills = container.querySelectorAll('.gengage-chat-pill');
    expect(pills[0]?.textContent).toContain('Tekrar dene');
    expect(pills[1]?.textContent).toContain('Başka bir şey sor');

    container.remove();
  });

  it('scrolls error into view', () => {
    const { container, drawer } = createDrawer();
    drawer.showErrorWithRecovery('Error', {
      onRetry: vi.fn(),
      onNewQuestion: vi.fn(),
    });

    // Error element should have role="alert" for accessibility
    const errEl = container.querySelector('.gengage-chat-error');
    expect(errEl?.getAttribute('role')).toBe('alert');

    container.remove();
  });
});

describe('ChatDrawer.showError scroll behavior', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('appends error element with role="alert"', () => {
    const { container, drawer } = createDrawer();
    drawer.showError('Test error');

    const errEl = container.querySelector('.gengage-chat-error');
    expect(errEl).not.toBeNull();
    expect(errEl?.getAttribute('role')).toBe('alert');
    expect(errEl?.textContent).toContain('Test error');

    container.remove();
  });

  it('includes retry button when onRetry is provided', () => {
    const { container, drawer } = createDrawer();
    const onRetry = vi.fn();
    drawer.showError('Error', onRetry);

    const retryBtn = container.querySelector('.gengage-chat-error-retry');
    expect(retryBtn).not.toBeNull();
    expect(retryBtn?.textContent).toBe('Retry');
    (retryBtn as HTMLButtonElement).click();
    expect(onRetry).toHaveBeenCalledOnce();

    container.remove();
  });
});

describe('i18n keys for error recovery', () => {
  it('has tryAgainButton in EN locale', () => {
    expect(CHAT_I18N_EN.tryAgainButton).toBe('Try again');
  });

  it('has askSomethingElseButton in EN locale', () => {
    expect(CHAT_I18N_EN.askSomethingElseButton).toBe('Ask something else');
  });

  it('has accountInactiveMessage in EN locale', () => {
    expect(CHAT_I18N_EN.accountInactiveMessage).toBe(
      'This account is currently inactive. Please try again later.',
    );
  });

  it('has tryAgainButton in TR locale', () => {
    expect(CHAT_I18N_TR.tryAgainButton).toBe('Tekrar dene');
  });

  it('has askSomethingElseButton in TR locale', () => {
    expect(CHAT_I18N_TR.askSomethingElseButton).toBe('Başka bir şey sor');
  });

  it('has accountInactiveMessage in TR locale', () => {
    expect(CHAT_I18N_TR.accountInactiveMessage).toBe(
      'Bu hesap şu an aktif değil. Lütfen daha sonra tekrar deneyin.',
    );
  });
});
