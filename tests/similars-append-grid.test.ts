import { describe, expect, it } from 'vitest';
import { isSimilarsAppendGrid } from '../src/chat/index.js';
import type { UIElement } from '../src/common/types.js';

describe('isSimilarsAppendGrid', () => {
  it('returns true for ProductGrid with similarsAppend=true', () => {
    const el: UIElement = { type: 'ProductGrid', props: { similarsAppend: true } };
    expect(isSimilarsAppendGrid(el)).toBe(true);
  });

  it('returns false for ProductGrid without similarsAppend', () => {
    expect(isSimilarsAppendGrid({ type: 'ProductGrid', props: {} })).toBe(false);
    expect(isSimilarsAppendGrid({ type: 'ProductGrid' })).toBe(false);
  });

  it('returns false when similarsAppend is falsy or non-true', () => {
    expect(isSimilarsAppendGrid({ type: 'ProductGrid', props: { similarsAppend: false } })).toBe(false);
    expect(isSimilarsAppendGrid({ type: 'ProductGrid', props: { similarsAppend: 'true' } })).toBe(false);
    expect(isSimilarsAppendGrid({ type: 'ProductGrid', props: { similarsAppend: 1 } })).toBe(false);
  });

  it('returns false for other component types even with similarsAppend=true', () => {
    expect(isSimilarsAppendGrid({ type: 'ProductCard', props: { similarsAppend: true } })).toBe(false);
    expect(isSimilarsAppendGrid({ type: 'ComparisonTable', props: { similarsAppend: true } })).toBe(false);
  });

  it('returns false for undefined element', () => {
    expect(isSimilarsAppendGrid(undefined)).toBe(false);
  });
});
