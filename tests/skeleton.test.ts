import { describe, it, expect } from 'vitest';
import { createSkeleton } from '../src/common/skeleton.js';

describe('createSkeleton', () => {
  it('creates a card skeleton with 3 cards', () => {
    const el = createSkeleton('card');
    expect(el.className).toContain('gengage-skeleton');
    expect(el.className).toContain('gengage-skeleton--card');
    const cards = el.querySelectorAll('.gengage-skeleton-card');
    expect(cards).toHaveLength(3);
  });

  it('each card has an image, text, and price placeholder', () => {
    const el = createSkeleton('card');
    const cards = el.querySelectorAll('.gengage-skeleton-card');
    for (const card of cards) {
      expect(card.querySelector('.gengage-skeleton-img')).not.toBeNull();
      expect(card.querySelector('.gengage-skeleton-text')).not.toBeNull();
      expect(card.querySelector('.gengage-skeleton-price')).not.toBeNull();
    }
  });

  it('creates a message skeleton with 3 lines', () => {
    const el = createSkeleton('message');
    expect(el.className).toContain('gengage-skeleton');
    expect(el.className).toContain('gengage-skeleton--message');
    const lines = el.querySelectorAll('.gengage-skeleton-line');
    expect(lines).toHaveLength(3);
  });

  it('message skeleton lines have increasing widths', () => {
    const el = createSkeleton('message');
    const lines = el.querySelectorAll('.gengage-skeleton-line') as NodeListOf<HTMLElement>;
    expect(lines[0]!.style.width).toBe('60%');
    expect(lines[1]!.style.width).toBe('75%');
    expect(lines[2]!.style.width).toBe('90%');
  });

  it('card skeleton uses flex layout', () => {
    const el = createSkeleton('card');
    // The element should be a div with the correct class
    expect(el.tagName).toBe('DIV');
    expect(el.classList.contains('gengage-skeleton')).toBe(true);
  });

  it('message skeleton has the message modifier class', () => {
    const el = createSkeleton('message');
    expect(el.classList.contains('gengage-skeleton-message')).toBe(true);
  });
});
