/**
 * Tests for ReviewHighlights — filter tabs, sentiment pills, and review items.
 */

import { describe, it, expect } from 'vitest';
import { renderReviewHighlights } from '../src/chat/components/ReviewHighlights.js';
import type { UIElement } from '../src/common/types.js';

function makeElement(reviews: Array<Record<string, unknown>>): UIElement {
  return { type: 'ReviewHighlights', props: { reviews } };
}

describe('ReviewHighlights', () => {
  it('renders filter tabs with counts', () => {
    const el = renderReviewHighlights(
      makeElement([
        { review_class: 'positive', review_text: 'Great', review_tag: 'quality' },
        { review_class: 'negative', review_text: 'Bad', review_tag: 'price' },
      ]),
    );
    const tabs = el.querySelectorAll('.gengage-chat-review-tab');
    expect(tabs.length).toBe(3); // All, Positive, Negative
    expect(tabs[0]?.textContent).toContain('All (2)');
    expect(tabs[1]?.textContent).toContain('Positive (1)');
    expect(tabs[2]?.textContent).toContain('Negative (1)');
  });

  it('filters items when tab is clicked', () => {
    const el = renderReviewHighlights(
      makeElement([
        { review_class: 'positive', review_text: 'Great' },
        { review_class: 'negative', review_text: 'Bad' },
        { review_class: 'positive', review_text: 'Awesome' },
      ]),
    );
    // Initially all items
    expect(el.querySelectorAll('.gengage-chat-review-item').length).toBe(3);
    // Click "Olumlu" tab
    const olumluTab = el.querySelectorAll('.gengage-chat-review-tab')[1] as HTMLButtonElement;
    olumluTab?.click();
    expect(el.querySelectorAll('.gengage-chat-review-item').length).toBe(2);
  });

  it('renders sentiment tag pills', () => {
    const el = renderReviewHighlights(
      makeElement([
        { review_class: 'positive', review_tag: 'quality', review_text: 'A' },
        { review_class: 'positive', review_tag: 'quality', review_text: 'B' },
        { review_class: 'negative', review_tag: 'price', review_text: 'C' },
      ]),
    );
    const pills = el.querySelectorAll('.gengage-chat-review-pill');
    expect(pills.length).toBe(2); // quality and price
    const countBadge = el.querySelector('.gengage-chat-review-pill-count');
    expect(countBadge?.textContent).toBe('2'); // quality appears twice
  });

  it('shows empty state when no reviews', () => {
    const el = renderReviewHighlights({ type: 'ReviewHighlights', props: { reviews: [] } });
    expect(el.querySelector('.gengage-chat-review-empty')).not.toBeNull();
    expect(el.querySelectorAll('.gengage-chat-review-tab').length).toBe(0);
  });

  it('renders review items with tone data attribute', () => {
    const el = renderReviewHighlights(
      makeElement([{ review_class: 'positive', review_text: 'Good stuff', review_tag: 'value' }]),
    );
    const item = el.querySelector('.gengage-chat-review-item');
    expect(item?.getAttribute('data-tone')).toBe('positive');
  });
});
