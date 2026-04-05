import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BaseWidgetConfig, PageContext } from '../src/common/types.js';
import { BaseWidget } from '../src/common/widget-base.js';
import { dispatch } from '../src/common/events.js';
import { getGlobalErrorMessage } from '../src/common/global-error-toast.js';

class TestWidget extends BaseWidget<BaseWidgetConfig> {
  protected async onInit(_config: BaseWidgetConfig): Promise<void> {}
  protected onUpdate(_context: Partial<PageContext>): void {}
  protected onShow(): void {}
  protected onHide(): void {}
  protected onDestroy(): void {}
}

describe('global error toast', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('renders and auto-dismisses a top-right toast from global error event', async () => {
    const widget = new TestWidget();
    await widget.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
    });

    dispatch('gengage:global:error', {
      source: 'chat',
      message: 'Connection issue. Please try again.',
      durationMs: 1800,
    });

    const root = document.getElementById('gengage-global-toast-root');
    expect(root).toBeTruthy();
    expect(root?.textContent).toContain('Connection issue. Please try again.');

    vi.advanceTimersByTime(1800);
    expect(document.querySelector('.gengage-global-toast')).toBeNull();
    widget.destroy();
  });

  it('replaces current toast content when a newer global error arrives', async () => {
    const widget = new TestWidget();
    await widget.init({
      accountId: 'test-account',
      session: { sessionId: 'test-session' },
    });

    dispatch('gengage:global:error', {
      source: 'qna',
      message: 'First warning',
      durationMs: 2000,
    });
    dispatch('gengage:global:error', {
      source: 'simrel',
      message: 'Second warning',
      durationMs: 2000,
    });

    const toasts = document.querySelectorAll('.gengage-global-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.textContent).toContain('Second warning');
    widget.destroy();
  });

  it('returns a generic message for non-connectivity failures', () => {
    expect(getGlobalErrorMessage('en', new Error('HTTP 500'))).toBe('Something went wrong. Please try again.');
    expect(getGlobalErrorMessage('tr', new Error('HTTP 500'))).toBe('Bir hata oluştu. Lütfen tekrar deneyin.');
  });

  it('returns a connection warning for likely offline failures', () => {
    expect(getGlobalErrorMessage('en', new TypeError('Failed to fetch'))).toBe('Connection issue. Please try again.');
  });
});
