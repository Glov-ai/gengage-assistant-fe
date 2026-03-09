/**
 * ReviewHighlights — renders review summary cards with filter tabs and tag pills.
 *
 * Tag pills are clickable filters: clicking a pill shows only reviews with that tag.
 * Sentiment tabs (All/Positive/Negative) work independently alongside tag filtering.
 * By default the first tag pill is selected, showing its reviews.
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
  options?: {
    emptyReviewsMessage?: string | undefined;
    reviewFilterAll?: string | undefined;
    reviewFilterPositive?: string | undefined;
    reviewFilterNegative?: string | undefined;
  },
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-review-highlights';

  const reviews = element.props?.['reviews'];
  if (!Array.isArray(reviews) || reviews.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gengage-chat-review-empty';
    empty.textContent = options?.emptyReviewsMessage ?? 'No review summary found.';
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

  // Build unique tag list (ordered by first occurrence)
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

  const firstTag = tagCounts.size > 0 ? tagCounts.keys().next().value as string : null;

  // State
  let activeSentiment = 'all';
  let activeTag: string | null = firstTag;

  // --- Sentiment filter tabs ---
  const tabBar = document.createElement('div');
  tabBar.className = 'gengage-chat-review-tabs';

  const allLabel = options?.reviewFilterAll ?? 'All';
  const positiveLabel = options?.reviewFilterPositive ?? 'Positive';
  const negativeLabel = options?.reviewFilterNegative ?? 'Negative';

  const sentimentFilters: Array<{ label: string; filter: string }> = [
    { label: `${allLabel} (${counts.all})`, filter: 'all' },
  ];
  if (counts.positive > 0) sentimentFilters.push({ label: `${positiveLabel} (${counts.positive})`, filter: 'positive' });
  if (counts.negative > 0) sentimentFilters.push({ label: `${negativeLabel} (${counts.negative})`, filter: 'negative' });

  // --- Review items container ---
  const itemsContainer = document.createElement('div');
  itemsContainer.className = 'gengage-chat-review-items';

  function renderItems(): void {
    while (itemsContainer.firstChild) itemsContainer.removeChild(itemsContainer.firstChild);

    const filtered = items.filter((i) => {
      const sentimentOk = activeSentiment === 'all' || i.review_class === activeSentiment;
      const tagOk = activeTag === null || i.review_tag === activeTag;
      return sentimentOk && tagOk;
    });

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

  for (const f of sentimentFilters) {
    const tab = document.createElement('button');
    tab.className = 'gengage-chat-review-tab';
    tab.type = 'button';
    tab.textContent = f.label;
    if (f.filter === activeSentiment) tab.classList.add('gengage-chat-review-tab--active');

    tab.addEventListener('click', () => {
      activeSentiment = f.filter;
      for (const t of tabBar.querySelectorAll('.gengage-chat-review-tab')) {
        t.classList.toggle('gengage-chat-review-tab--active', t === tab);
      }
      renderItems();
    });
    tabBar.appendChild(tab);
  }

  container.appendChild(tabBar);

  // --- Tag pills (clickable filters) ---
  if (tagCounts.size > 0) {
    const pillsRow = document.createElement('div');
    pillsRow.className = 'gengage-chat-review-pills';

    for (const [tag, data] of tagCounts) {
      const pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'gengage-chat-review-pill';
      pill.dataset['tone'] = data.sentiment;
      if (tag === activeTag) pill.classList.add('gengage-chat-review-pill--active');

      const icon = document.createElement('span');
      icon.className = 'gengage-chat-review-pill-icon';
      icon.textContent =
        data.sentiment === 'positive' ? '\u2713' : data.sentiment === 'negative' ? '\u2715' : '\u25CF';
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

      pill.addEventListener('click', () => {
        // Toggle: clicking active tag deselects (shows all)
        activeTag = activeTag === tag ? null : tag;
        for (const p of pillsRow.querySelectorAll('.gengage-chat-review-pill')) {
          const isActive = activeTag !== null && (p as HTMLElement).querySelector('span:nth-child(2)')?.textContent === activeTag;
          p.classList.toggle('gengage-chat-review-pill--active', isActive);
        }
        renderItems();
      });

      pillsRow.appendChild(pill);
    }
    container.appendChild(pillsRow);
  }

  renderItems();
  container.appendChild(itemsContainer);

  return container;
}

