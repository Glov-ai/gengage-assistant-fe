import { describe, it, expect } from 'vitest';
import { clampRating, clampDiscount, renderStarRating, createStarRatingElement } from '../src/common/product-utils.js';

// ---------------------------------------------------------------------------
// clampRating
// ---------------------------------------------------------------------------

describe('clampRating', () => {
  it('clamps values above 5 to 5', () => {
    expect(clampRating(10)).toBe(5);
    expect(clampRating(5.5)).toBe(5);
  });

  it('clamps negative values to 0', () => {
    expect(clampRating(-1)).toBe(0);
    expect(clampRating(-100)).toBe(0);
  });

  it('passes through values in 0–5 range', () => {
    expect(clampRating(0)).toBe(0);
    expect(clampRating(3)).toBe(3);
    expect(clampRating(4.7)).toBe(4.7);
    expect(clampRating(5)).toBe(5);
  });

  it('returns 0 for NaN', () => {
    expect(clampRating(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(clampRating(Infinity)).toBe(0);
    expect(clampRating(-Infinity)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clampDiscount
// ---------------------------------------------------------------------------

describe('clampDiscount', () => {
  it('clamps values above 100 to 100', () => {
    expect(clampDiscount(150)).toBe(100);
  });

  it('clamps negative values to 0', () => {
    expect(clampDiscount(-10)).toBe(0);
  });

  it('rounds to integer', () => {
    expect(clampDiscount(33.3)).toBe(33);
    expect(clampDiscount(33.7)).toBe(34);
  });

  it('passes through valid values', () => {
    expect(clampDiscount(0)).toBe(0);
    expect(clampDiscount(50)).toBe(50);
    expect(clampDiscount(100)).toBe(100);
  });

  it('returns 0 for NaN', () => {
    expect(clampDiscount(NaN)).toBe(0);
  });

  it('returns 0 for Infinity', () => {
    expect(clampDiscount(Infinity)).toBe(0);
    expect(clampDiscount(-Infinity)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// renderStarRating
// ---------------------------------------------------------------------------

describe('renderStarRating', () => {
  it('renders 5 full stars for rating 5', () => {
    expect(renderStarRating(5)).toBe('★★★★★');
  });

  it('renders 0 stars for rating 0', () => {
    expect(renderStarRating(0)).toBe('☆☆☆☆☆');
  });

  it('renders half star for 3.5', () => {
    expect(renderStarRating(3.5)).toBe('★★★½☆');
  });

  it('renders half star for 4.7 (floor=4, remainder=0.7≥0.5)', () => {
    expect(renderStarRating(4.7)).toBe('★★★★½');
  });

  it('no half star for 4.3 (floor=4, remainder=0.3<0.5)', () => {
    expect(renderStarRating(4.3)).toBe('★★★★☆');
  });

  it('disables half stars when halfStars=false', () => {
    expect(renderStarRating(3.5, false)).toBe('★★★★☆'); // rounds to 4
    expect(renderStarRating(3.4, false)).toBe('★★★☆☆'); // rounds to 3
  });

  it('does not crash on NaN (via clampRating guard)', () => {
    expect(() => renderStarRating(NaN)).not.toThrow();
    expect(renderStarRating(NaN)).toBe('☆☆☆☆☆');
  });

  it('does not crash on Infinity', () => {
    expect(() => renderStarRating(Infinity)).not.toThrow();
    expect(renderStarRating(Infinity)).toBe('☆☆☆☆☆');
  });

  it('clamps above-5 rating', () => {
    expect(renderStarRating(10)).toBe('★★★★★');
  });

  it('clamps negative rating', () => {
    expect(renderStarRating(-3)).toBe('☆☆☆☆☆');
  });
});

// ---------------------------------------------------------------------------
// createStarRatingElement — a11y attributes
// ---------------------------------------------------------------------------

describe('createStarRatingElement', () => {
  it('returns a span with role="img"', () => {
    const el = createStarRatingElement(3.5);
    expect(el.getAttribute('role')).toBe('img');
  });

  it('has aria-label with clamped rating out of 5', () => {
    const el = createStarRatingElement(3.5);
    expect(el.getAttribute('aria-label')).toBe('3.5 out of 5 stars');
  });

  it('formats zero rating as "0.0 out of 5 stars"', () => {
    const el = createStarRatingElement(0);
    expect(el.getAttribute('aria-label')).toBe('0.0 out of 5 stars');
  });

  it('clamps and formats above-5 rating in aria-label', () => {
    const el = createStarRatingElement(10);
    expect(el.getAttribute('aria-label')).toBe('5.0 out of 5 stars');
  });

  it('formats fractional rating with one decimal', () => {
    const el = createStarRatingElement(4.3);
    expect(el.getAttribute('aria-label')).toBe('4.3 out of 5 stars');
  });
});
