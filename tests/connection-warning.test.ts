import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureConnectionWarning, trackConnectionWarningRequest } from '../src/common/connection-warning.js';

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

  it('probes the default Google favicon URL when configureConnectionWarning is not called', async () => {
    // navigator.onLine must be true so checkConnectivity does not short-circuit at the
    // first guard; the localhost bypass would also short-circuit, so we override
    // window.location to use a non-localhost hostname.
    Object.defineProperty(window.Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname: 'example-store.com' },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    try {
      const release = trackConnectionWarningRequest({ source: 'qna', locale: 'en' });
      // Advance past the 8-second delay so checkConnectivity() is invoked
      await vi.advanceTimersByTimeAsync(8_000);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://www.google.com/favicon.ico',
        expect.objectContaining({ method: 'HEAD', mode: 'no-cors' }),
      );

      release();
    } finally {
      fetchSpy.mockRestore();
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
    }
  });

  it('probes the configured URL when configureConnectionWarning is called with a custom probeUrl', async () => {
    configureConnectionWarning({ probeUrl: 'https://example.com/probe' });

    Object.defineProperty(window.Navigator.prototype, 'onLine', {
      configurable: true,
      get: () => true,
    });

    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, hostname: 'example-store.com' },
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));

    try {
      const release = trackConnectionWarningRequest({ source: 'simrel', locale: 'en' });
      await vi.advanceTimersByTimeAsync(8_000);

      expect(fetchSpy).toHaveBeenCalledWith(
        'https://example.com/probe',
        expect.objectContaining({ method: 'HEAD', mode: 'no-cors' }),
      );
      expect(fetchSpy).not.toHaveBeenCalledWith('https://www.google.com/favicon.ico', expect.anything());

      release();
    } finally {
      fetchSpy.mockRestore();
      Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
      // Reset probe URL to default so later tests are not polluted
      configureConnectionWarning({ probeUrl: 'https://www.google.com/favicon.ico' });
    }
  });
});
