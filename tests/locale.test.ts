import { describe, it, expect } from 'vitest';
import { resolveLocaleTag } from '../src/common/locale.js';

describe('resolveLocaleTag', () => {
  it('falls back to Turkish for missing or blank locales', () => {
    expect(resolveLocaleTag(undefined)).toBe('tr');
    expect(resolveLocaleTag(null)).toBe('tr');
    expect(resolveLocaleTag('')).toBe('tr');
    expect(resolveLocaleTag('   ')).toBe('tr');
  });

  it('preserves a provided locale tag after trimming', () => {
    expect(resolveLocaleTag('en-US')).toBe('en-US');
    expect(resolveLocaleTag(' tr-TR ')).toBe('tr-TR');
  });
});
