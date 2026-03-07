import { describe, it, expect } from 'vitest';
import { formatPrice } from '../src/common/price-formatter.js';

describe('formatPrice', () => {
  describe('Turkish defaults', () => {
    it('formats whole number with dot thousands separator', () => {
      expect(formatPrice('17990')).toBe('17.990 TL');
    });

    it('formats number with decimal part using comma', () => {
      expect(formatPrice('17990.5')).toBe('17.990,50 TL');
    });

    it('formats small number without separator', () => {
      expect(formatPrice('999')).toBe('999 TL');
    });

    it('formats zero', () => {
      expect(formatPrice('0')).toBe('0 TL');
    });

    it('formats number with two decimals', () => {
      expect(formatPrice('49.99')).toBe('49,99 TL');
    });

    it('formats large number with multiple separators', () => {
      expect(formatPrice('1234567')).toBe('1.234.567 TL');
    });

    it('pads single decimal to two places', () => {
      expect(formatPrice('100.5')).toBe('100,50 TL');
    });
  });

  describe('custom config', () => {
    const gbpConfig = {
      currencySymbol: '£',
      currencyPosition: 'prefix' as const,
      thousandsSeparator: ',',
      decimalSeparator: '.',
    };

    it('formats with prefix currency symbol', () => {
      expect(formatPrice('17990', gbpConfig)).toBe('£17,990');
    });

    it('formats with prefix and decimals', () => {
      expect(formatPrice('17990.5', gbpConfig)).toBe('£17,990.50');
    });

    it('always shows decimals when configured', () => {
      expect(formatPrice('100', { alwaysShowDecimals: true })).toBe('100,00 TL');
    });

    it('formats without currency symbol', () => {
      expect(formatPrice('1000', { currencySymbol: '' })).toBe('1.000');
    });
  });

  describe('edge cases', () => {
    it('returns non-numeric input as-is', () => {
      expect(formatPrice('abc')).toBe('abc');
    });

    it('formats empty string as zero', () => {
      // Number('') === 0, which is valid
      expect(formatPrice('')).toBe('0 TL');
    });

    it('returns NaN as-is', () => {
      expect(formatPrice('NaN')).toBe('NaN');
    });

    it('returns Infinity as-is', () => {
      expect(formatPrice('Infinity')).toBe('Infinity');
    });

    it('returns negative numbers as-is', () => {
      expect(formatPrice('-100')).toBe('-100');
    });
  });
});
