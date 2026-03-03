/**
 * ReviewHighlights — renders review summary cards with filter tabs and sentiment tag pills.
 *
 * Production parity: filter tabs (Tümü/Olumlu/Olumsuz), sentiment pill summary,
 * and the existing per-review cards with tone coloring.
 *
 * All text is set via textContent — no innerHTML, no XSS surface.
 */

import type { UIElement } from '../../common/types.js';

interface ReviewItem {
  review_class?: string;
  review_text?: string;
  review_rating?: string | number;
  review_tag?: string;
}

export function renderReviewHighlights(
  element: UIElement,
  options?: { emptyReviewsMessage?: string | undefined },
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-review-highlights';

  const reviews = element.props?.['reviews'];
  if (!Array.isArray(reviews) || reviews.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gengage-chat-review-empty';
    empty.textContent = options?.emptyReviewsMessage ?? 'Yorum özeti bulunamadı.';
    container.appendChild(empty);
    return container;
  }

  const items: ReviewItem[] = reviews.filter(
    (r): r is Record<string, unknown> => r !== null && typeof r === 'object',
  ) as ReviewItem[];

  // Count sentiments
  const counts = { all: items.length, positive: 0, negative: 0, neutral: 0 };
  for (const item of items) {
    if (item.review_class === 'positive') counts.positive++;
    else if (item.review_class === 'negative') counts.negative++;
    else counts.neutral++;
  }

  // Filter tabs
  const tabBar = document.createElement('div');
  tabBar.className = 'gengage-chat-review-tabs';

  const filters: Array<{ label: string; filter: string }> = [{ label: `Tümü (${counts.all})`, filter: 'all' }];
  if (counts.positive > 0) filters.push({ label: `Olumlu (${counts.positive})`, filter: 'positive' });
  if (counts.negative > 0) filters.push({ label: `Olumsuz (${counts.negative})`, filter: 'negative' });

  let activeFilter = 'all';

  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'gengage-chat-review-items';

  function renderItems(): void {
    while (itemsContainer.firstChild) itemsContainer.removeChild(itemsContainer.firstChild);
    const filtered = activeFilter === 'all' ? items : items.filter((i) => i.review_class === activeFilter);
    for (const review of filtered) {
      const item = document.createElement('article');
      item.className = 'gengage-chat-review-item';
      const cls = review.review_class;
      if (cls === 'positive' || cls === 'negative' || cls === 'neutral') {
        item.dataset['tone'] = cls;
      }

      if (typeof review.review_tag === 'string' && review.review_tag.length > 0) {
        const tagEl = document.createElement('div');
        tagEl.className = 'gengage-chat-review-tag';
        tagEl.textContent = review.review_tag;
        item.appendChild(tagEl);
      }

      if (typeof review.review_text === 'string' && review.review_text.length > 0) {
        const textEl = document.createElement('div');
        textEl.className = 'gengage-chat-review-text';
        textEl.textContent = review.review_text;
        item.appendChild(textEl);
      }

      if (review.review_rating !== undefined && String(review.review_rating).length > 0) {
        const ratingEl = document.createElement('div');
        ratingEl.className = 'gengage-chat-review-rating';
        ratingEl.textContent = String(review.review_rating);
        item.appendChild(ratingEl);
      }

      itemsContainer.appendChild(item);
    }
  }

  for (const f of filters) {
    const tab = document.createElement('button');
    tab.className = 'gengage-chat-review-tab';
    tab.type = 'button';
    tab.textContent = f.label;
    if (f.filter === activeFilter) tab.classList.add('gengage-chat-review-tab--active');

    tab.addEventListener('click', () => {
      activeFilter = f.filter;
      for (const t of tabBar.querySelectorAll('.gengage-chat-review-tab')) {
        t.classList.toggle('gengage-chat-review-tab--active', t === tab);
      }
      renderItems();
    });
    tabBar.appendChild(tab);
  }

  container.appendChild(tabBar);

  // Sentiment tag pills (summary of unique tags with counts)
  const tagCounts = new Map<string, { count: number; sentiment: string }>();
  for (const item of items) {
    if (typeof item.review_tag === 'string' && item.review_tag.length > 0) {
      const existing = tagCounts.get(item.review_tag);
      if (existing) {
        existing.count++;
      } else {
        tagCounts.set(item.review_tag, { count: 1, sentiment: item.review_class ?? 'neutral' });
      }
    }
  }

  if (tagCounts.size > 0) {
    const pillsRow = document.createElement('div');
    pillsRow.className = 'gengage-chat-review-pills';
    for (const [tag, data] of tagCounts) {
      const pill = document.createElement('span');
      pill.className = 'gengage-chat-review-pill';
      pill.dataset['tone'] = data.sentiment;

      const icon = document.createElement('span');
      icon.className = 'gengage-chat-review-pill-icon';
      icon.textContent = data.sentiment === 'positive' ? '\u2713' : data.sentiment === 'negative' ? '\u2715' : '\u25CF';
      pill.appendChild(icon);

      const tagText = document.createElement('span');
      tagText.textContent = tag;
      pill.appendChild(tagText);

      if (data.count > 1) {
        const badge = document.createElement('span');
        badge.className = 'gengage-chat-review-pill-count';
        badge.textContent = String(data.count);
        pill.appendChild(badge);
      }

      pillsRow.appendChild(pill);
    }
    container.appendChild(pillsRow);
  }

  renderItems();
  container.appendChild(itemsContainer);

  return container;
}
