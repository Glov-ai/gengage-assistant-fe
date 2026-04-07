/**
 * Tests for ReviewHighlights — subject chips, mention counts, and snippets.
 */

import { describe, it, expect } from 'vitest';
import { renderReviewHighlights } from '../src/chat/components/ReviewHighlights.js';
import type { UIElement } from '../src/common/types.js';

function makeElement(reviews: Array<Record<string, unknown>>): UIElement {
  return { type: 'ReviewHighlights', props: { reviews } };
}

describe('ReviewHighlights', () => {
  it('renders subject chips with mention counts', () => {
    const el = renderReviewHighlights(
      makeElement([
        { review_class: 'positive', review_text: 'Great build quality', review_tag: 'Build quality' },
        { review_class: 'negative', review_text: 'Too expensive for me', review_tag: 'Value' },
        { review_class: 'positive', review_text: 'Feels solid', review_tag: 'Build quality' },
      ]),
    );
    const subjects = el.querySelectorAll('.gengage-chat-review-subject');
    expect(subjects.length).toBe(2);
    expect(subjects[0]?.textContent).toContain('Build quality');
    expect(subjects[0]?.textContent).toContain('(2)');
    expect(subjects[1]?.textContent).toContain('Value');
    expect(subjects[1]?.textContent).toContain('(1)');
  });

  it('switches snippets when a different subject is clicked', () => {
    const el = renderReviewHighlights(
      makeElement([
        { review_class: 'positive', review_text: 'Fast startup and smooth use', review_tag: 'Performance' },
        { review_class: 'negative', review_text: 'Battery drains quickly', review_tag: 'Battery' },
        { review_class: 'positive', review_text: 'Runs games well', review_tag: 'Performance' },
      ]),
    );
    const subjects = el.querySelectorAll('.gengage-chat-review-subject');
    const performanceSnippets = el.querySelectorAll('.gengage-chat-review-snippet');
    expect(performanceSnippets.length).toBe(2);

    const battery = subjects[1] as HTMLButtonElement;
    battery.click();
    const batterySnippets = el.querySelectorAll('.gengage-chat-review-snippet');
    expect(batterySnippets.length).toBe(1);
    expect(el.textContent).toContain('Battery');
  });

  it('shows positive and negative mention counts for active subject', () => {
    const el = renderReviewHighlights(
      makeElement([
        { review_class: 'positive', review_tag: 'Hardware', review_text: 'Powerful CPU' },
        { review_class: 'positive', review_tag: 'Hardware', review_text: 'Strong GPU' },
        { review_class: 'negative', review_tag: 'Hardware', review_text: 'Fan got noisy once' },
      ]),
    );
    const meta = el.querySelector('.gengage-chat-review-detail-meta');
    expect(meta?.textContent).toContain('3 customers mention "Hardware"');
    expect(meta?.textContent).toContain('2 positive');
    expect(meta?.textContent).toContain('1 negative');
  });

  it('splits comma-joined tags and groups them as separate subjects', () => {
    const el = renderReviewHighlights(
      makeElement([
        { review_class: 'positive', review_tag: 'Watt değeri, Şarj hızı', review_text: 'Hızlı ve güçlü' },
        { review_class: 'negative', review_tag: 'Şarj hızı', review_text: 'Bazen yavaşlıyor' },
      ]),
    );
    const subjects = Array.from(el.querySelectorAll('.gengage-chat-review-subject')).map((n) => n.textContent ?? '');
    expect(subjects.some((s) => s.includes('Watt değeri'))).toBe(true);
    expect(subjects.some((s) => s.includes('Şarj hızı'))).toBe(true);

    // Şarj hızı should aggregate both rows (2 mentions)
    const chargeSubject = subjects.find((s) => s.includes('Şarj hızı'));
    expect(chargeSubject).toContain('(2)');
  });

  it('shows empty state when no reviews', () => {
    const el = renderReviewHighlights({ type: 'ReviewHighlights', props: { reviews: [] } });
    expect(el.querySelector('.gengage-chat-review-empty')).not.toBeNull();
    expect(el.querySelectorAll('.gengage-chat-review-subject').length).toBe(0);
  });

  it('renders snippets with tone data attribute', () => {
    const el = renderReviewHighlights(
      makeElement([{ review_class: 'positive', review_text: 'Good stuff', review_tag: 'Value' }]),
    );
    const item = el.querySelector('.gengage-chat-review-snippet');
    expect(item?.getAttribute('data-tone')).toBe('positive');
  });
});
