import { describe, it, expect } from 'vitest';
import { shouldShowStreamErrorAsRedStrip } from '../src/chat/stream-error-display.js';

function err(message: string): Error {
  return new Error(message);
}

describe('shouldShowStreamErrorAsRedStrip', () => {
  it('returns true for HTTP status style messages', () => {
    expect(shouldShowStreamErrorAsRedStrip(err('HTTP 503: Service Unavailable'), 'HTTP 503: Service Unavailable')).toBe(
      true,
    );
  });

  it('returns true for connectivity-style errors', () => {
    expect(shouldShowStreamErrorAsRedStrip(err('Failed to fetch'), 'Failed to fetch')).toBe(true);
  });

  it('returns true for long or stack-like text', () => {
    const dump = 'x'.repeat(800);
    expect(shouldShowStreamErrorAsRedStrip(err('x'), dump)).toBe(true);
    expect(
      shouldShowStreamErrorAsRedStrip(
        err('x'),
        'Traceback (most recent call last):\n  File "a.py", line 1\n  File "b.py", line 2',
      ),
    ).toBe(true);
  });

  it('returns false for short user-facing backend messages', () => {
    expect(
      shouldShowStreamErrorAsRedStrip(
        err('Üzgünüm, bu ürün için stok bilgisine ulaşılamadı.'),
        'Üzgünüm, bu ürün için stok bilgisine ulaşılamadı.',
      ),
    ).toBe(false);
  });
});
