/**
 * ReviewHighlights — subject-first review intelligence panel.
 *
 * Subjects are neutral topics (e.g., "Build quality").
 * Sentiment is represented by per-subject positive/negative mention counts.
 * Clicking a subject shows short snippets, not full review bodies.
 */

import type { UIElement } from '../../common/types.js';
import { createLucideIcon } from '../utils/ui.js';

type ReviewTone = 'positive' | 'negative' | 'neutral';

interface ReviewItem {
  review_class?: string;
  review_text?: string;
  review_rating?: string | number;
  review_tag?: string;
}

interface ReviewSnippet {
  text: string;
  tone: ReviewTone;
  rating?: string | number;
}

interface SubjectAggregate {
  key: string;
  label: string;
  mentions: number;
  positive: number;
  negative: number;
  neutral: number;
  snippets: ReviewSnippet[];
}

const DEFAULT_SUBJECT = 'General';
const MAX_SNIPPET_CHARS = 220;
const MAX_SNIPPETS_PER_SUBJECT = 6;

function normalizeTags(tag: unknown): string[] {
  if (typeof tag !== 'string') return [DEFAULT_SUBJECT];
  const split = tag
    .split(/[,;|/]+/)
    .map((part) => part.trim().replace(/\s+/g, ' '))
    .filter((part) => part.length > 0);
  if (split.length === 0) return [DEFAULT_SUBJECT];
  return Array.from(new Set(split.map((part) => part.toLocaleLowerCase()))).map((lowered) => {
    const original = split.find((part) => part.toLocaleLowerCase() === lowered);
    return original ?? DEFAULT_SUBJECT;
  });
}

function normalizeTone(tone: unknown): ReviewTone {
  if (tone === 'positive' || tone === 'negative' || tone === 'neutral') return tone;
  return 'neutral';
}

function normalizeSnippet(text: unknown): string {
  if (typeof text !== 'string') return '';
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length <= MAX_SNIPPET_CHARS) return normalized;
  return `${normalized.slice(0, MAX_SNIPPET_CHARS - 3).trimEnd()}...`;
}

function subjectTone(subject: SubjectAggregate): ReviewTone {
  if (subject.positive > subject.negative) return 'positive';
  if (subject.negative > subject.positive) return 'negative';
  return 'neutral';
}

function subjectToneIcon(tone: ReviewTone): SVGElement {
  if (tone === 'positive') {
    return createLucideIcon(['M7 17 17 7', 'M7 7h10v10'], 14);
  }
  if (tone === 'negative') {
    return createLucideIcon(['M7 7 17 17', 'M17 7v10H7'], 14);
  }
  return createLucideIcon(['M5 12h14'], 14);
}

function mentionText(
  count: number,
  singularLabel: string = '1 customer mentions',
  pluralLabel: string = 'customers mention',
): string {
  return count === 1 ? singularLabel : `${count} ${pluralLabel}`;
}

export function renderReviewHighlights(
  element: UIElement,
  options?: {
    emptyReviewsMessage?: string | undefined;
    reviewFilterAll?: string | undefined;
    reviewFilterPositive?: string | undefined;
    reviewFilterNegative?: string | undefined;
    reviewCustomersMentionSingular?: string | undefined;
    reviewCustomersMentionPlural?: string | undefined;
    reviewSubjectsHeading?: string | undefined;
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

  const rawItems: ReviewItem[] = reviews.filter(
    (r): r is Record<string, unknown> => r !== null && typeof r === 'object',
  ) as ReviewItem[];

  const subjectsMap = new Map<string, SubjectAggregate>();
  for (const item of rawItems) {
    const tone = normalizeTone(item.review_class);
    const snippet = normalizeSnippet(item.review_text);
    const labels = normalizeTags(item.review_tag);

    for (const label of labels) {
      const key = label.toLocaleLowerCase();
      let subject = subjectsMap.get(key);
      if (!subject) {
        subject = {
          key,
          label,
          mentions: 0,
          positive: 0,
          negative: 0,
          neutral: 0,
          snippets: [],
        };
        subjectsMap.set(key, subject);
      }

      subject.mentions += 1;
      if (tone === 'positive') subject.positive += 1;
      else if (tone === 'negative') subject.negative += 1;
      else subject.neutral += 1;

      if (snippet.length > 0 && subject.snippets.length < MAX_SNIPPETS_PER_SUBJECT) {
        const alreadyExists = subject.snippets.some((entry) => entry.text === snippet);
        if (!alreadyExists) {
          const snippetEntry: ReviewSnippet = {
            text: snippet,
            tone,
          };
          if (item.review_rating !== undefined && String(item.review_rating).length > 0) {
            snippetEntry.rating = item.review_rating;
          }
          subject.snippets.push(snippetEntry);
        }
      }
    }
  }

  const subjects = Array.from(subjectsMap.values()).sort((a, b) => {
    if (b.mentions !== a.mentions) return b.mentions - a.mentions;
    return a.label.localeCompare(b.label);
  });

  if (subjects.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'gengage-chat-review-empty';
    empty.textContent = options?.emptyReviewsMessage ?? 'No review summary found.';
    container.appendChild(empty);
    return container;
  }

  const positiveLabel = (options?.reviewFilterPositive ?? 'positive').toLowerCase();
  const negativeLabel = (options?.reviewFilterNegative ?? 'negative').toLowerCase();

  const subjectHeading = document.createElement('div');
  subjectHeading.className = 'gengage-chat-review-subjects-heading';
  subjectHeading.textContent = options?.reviewSubjectsHeading ?? 'Select to learn more';
  container.appendChild(subjectHeading);

  let activeKey = subjects[0]?.key ?? null;

  const subjectRow = document.createElement('div');
  subjectRow.className = 'gengage-chat-review-subjects gds-toolbar gds-toolbar-compact';

  const detailCard = document.createElement('section');
  detailCard.className = 'gengage-chat-review-detail gds-evidence-card';

  const renderDetail = (): void => {
    while (detailCard.firstChild) detailCard.removeChild(detailCard.firstChild);
    if (!activeKey) return;
    const active = subjects.find((subject) => subject.key === activeKey);
    if (!active) return;

    const metaRow = document.createElement('div');
    metaRow.className = 'gengage-chat-review-detail-meta';

    const mentions = document.createElement('span');
    mentions.className = 'gengage-chat-review-detail-mentions';
    mentions.textContent = `${mentionText(
      active.mentions,
      options?.reviewCustomersMentionSingular,
      options?.reviewCustomersMentionPlural,
    )} "${active.label}"`;
    metaRow.appendChild(mentions);

    if (active.positive > 0) {
      const pos = document.createElement('span');
      pos.className = 'gengage-chat-review-detail-positive';
      pos.textContent = `${active.positive} ${positiveLabel}`;
      metaRow.appendChild(pos);
    }

    if (active.negative > 0) {
      const neg = document.createElement('span');
      neg.className = 'gengage-chat-review-detail-negative';
      neg.textContent = `${active.negative} ${negativeLabel}`;
      metaRow.appendChild(neg);
    }

    detailCard.appendChild(metaRow);

    const snippets = document.createElement('div');
    snippets.className = 'gengage-chat-review-snippets';

    for (const snippet of active.snippets) {
      const line = document.createElement('article');
      line.className = 'gengage-chat-review-snippet';
      line.dataset['tone'] = snippet.tone;

      const text = document.createElement('div');
      text.className = 'gengage-chat-review-snippet-text';
      text.textContent = `"${snippet.text}"`;
      line.appendChild(text);

      if (snippet.rating !== undefined && String(snippet.rating).length > 0) {
        const rating = document.createElement('div');
        rating.className = 'gengage-chat-review-snippet-rating';
        rating.textContent = `\u2605 ${String(snippet.rating)}`;
        line.appendChild(rating);
      }

      snippets.appendChild(line);
    }

    detailCard.appendChild(snippets);
  };

  const refreshSubjectSelection = (): void => {
    for (const node of subjectRow.querySelectorAll<HTMLElement>('.gengage-chat-review-subject')) {
      const isActive = node.dataset['subjectKey'] === activeKey;
      node.classList.toggle('gengage-chat-review-subject--active', isActive);
      node.classList.toggle('gds-chip-active', isActive);
      node.setAttribute('aria-pressed', String(isActive));
    }
  };

  for (const subject of subjects) {
    const tone = subjectTone(subject);
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'gengage-chat-review-subject gds-chip';
    chip.dataset['subjectKey'] = subject.key;
    chip.dataset['tone'] = tone;

    const icon = document.createElement('span');
    icon.className = 'gengage-chat-review-subject-icon';
    icon.appendChild(subjectToneIcon(tone));
    chip.appendChild(icon);

    const label = document.createElement('span');
    label.className = 'gengage-chat-review-subject-label';
    label.textContent = subject.label;
    chip.appendChild(label);

    const count = document.createElement('span');
    count.className = 'gengage-chat-review-subject-count';
    count.textContent = `(${subject.mentions})`;
    chip.appendChild(count);

    chip.addEventListener('click', () => {
      activeKey = subject.key;
      refreshSubjectSelection();
      renderDetail();
    });

    subjectRow.appendChild(chip);
  }

  container.appendChild(subjectRow);
  refreshSubjectSelection();
  renderDetail();
  container.appendChild(detailCard);
  return container;
}
