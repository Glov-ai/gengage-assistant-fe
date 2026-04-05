import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackConnectionWarningRequest } from '../src/common/connection-warning.js';

let navigatorOnLineDescriptor: PropertyDescriptor | undefined;

describe('connection warning manager', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.useFakeTimers();
    navigatorOnLineDescriptor = Object.getOwnPropertyDescriptor(window.Navigator.prototype, 'onLine');
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    if (navigatorOnLineDescriptor) {
      Object.defineProperty(window.Navigator.prototype, 'onLine', navigatorOnLineDescriptor);
    }
    document.body.innerHTML = '';
  });

  it('shows a warning only after the delayed connectivity check while a request is active', async () => {
    Object.defineProperty(window.Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const release = trackConnectionWarningRequest({ source: 'qna', locale: 'en' });

    await vi.advanceTimersByTimeAsync(7_999);
    expect(document.querySelector('.gengage-global-toast')).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    expect(document.querySelector('.gengage-global-toast')?.textContent).toContain('Connection warning');

    release();
    expect(document.querySelector('.gengage-global-toast')).toBeNull();
  });

  it('does not show a warning when the request finishes before the delay expires', async () => {
    Object.defineProperty(window.Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const release = trackConnectionWarningRequest({ source: 'qna', locale: 'en' });
    await vi.advanceTimersByTimeAsync(2_000);
    release();
    await vi.advanceTimersByTimeAsync(8_000);

    expect(document.querySelector('.gengage-global-toast')).toBeNull();
  });

  it('shows immediately on an offline event while a request is active', () => {
    Object.defineProperty(window.Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => false,
    });

    const release = trackConnectionWarningRequest({ source: 'simrel', locale: 'tr' });
    window.dispatchEvent(new Event('offline'));

    expect(document.querySelector('.gengage-global-toast')?.textContent).toContain('Connection warning');

    release();
  });
});
