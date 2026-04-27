/**
 * AI Grouping Cards renderer.
 *
 * Desktop: compact card with image, name, and labels.
 * Mobile: simple button list with arrow prefix (images hidden via CSS).
 *
 * Note: The media-rail layout is similar to `AISuggestedSearchCards` but with different tokens;
 * a shared primitive may be extracted later if the visual system stabilizes.
 *
 * XSS safety: All text is set via textContent. Image URLs are validated
 * for safe protocols. No innerHTML.
 */

import type { UIElement, ActionPayload } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';
import { isSafeImageUrl } from '../../common/safe-html.js';

interface GroupingEntry {
  name: string;
  image?: string;
  description?: string;
  labels?: string[];
  action: ActionPayload;
}

function normalizeGroupingAction(entry: GroupingEntry): ActionPayload {
  if (entry.action.type !== 'findSimilar') return entry.action;
  const payload =
    entry.action.payload && typeof entry.action.payload === 'object'
      ? (entry.action.payload as Record<string, unknown>)
      : null;
  const text =
    (typeof payload?.['input'] === 'string' && payload['input'].trim()) ||
    (typeof payload?.['text'] === 'string' && payload['text'].trim()) ||
    entry.name.trim();
  if (!text) return entry.action;

  const normalizedPayload: Record<string, unknown> = {
    text,
    is_suggested_text: 1,
  };
  if (typeof payload?.['sku'] === 'string' && payload['sku'].trim()) {
    normalizedPayload['sku'] = payload['sku'];
  }
  if (Array.isArray(payload?.['group_skus'])) {
    const groupSkus = payload['group_skus'].filter((sku): sku is string => typeof sku === 'string' && sku.length > 0);
    if (groupSkus.length > 0) normalizedPayload['group_skus'] = groupSkus;
  }
  return {
    title: entry.action.title,
    type: 'inputText',
    payload: normalizedPayload,
  };
}

export function renderAIGroupingCards(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-grouping-cards';
  container.dataset['gengagePart'] = 'ai-grouping-cards';

  const entries = (element.props?.['entries'] ?? []) as GroupingEntry[];
  if (entries.length === 0) return container;

  const customTitle = element.props?.['sectionTitle'];
  const sectionTitle =
    typeof customTitle === 'string' && customTitle.trim().length > 0
      ? customTitle.trim()
      : ctx.i18n?.aiBrowseCategoriesTitle;
  if (sectionTitle) {
    const heading = document.createElement('h3');
    heading.className = 'gengage-chat-grouping-section-title';
    heading.textContent = sectionTitle;
    container.appendChild(heading);
  }

  const scrollRow = document.createElement('div');
  scrollRow.className = 'gengage-chat-grouping-cards-scroll';
  scrollRow.dataset['gengagePart'] = 'ai-grouping-cards-scroll';

  for (const entry of entries) {
    const card = document.createElement('div');
    card.className = 'gengage-chat-grouping-card gds-card';
    card.dataset['gengagePart'] = 'ai-grouping-card';
    card.classList.add('gds-clickable');
    card.addEventListener('click', () => ctx.onAction(normalizeGroupingAction(entry)));

    // Image — intrinsic size; CSS sets panel vs chat dimensions
    if (entry.image && isSafeImageUrl(entry.image)) {
      const img = document.createElement('img');
      img.className = 'gengage-chat-grouping-card-img';
      img.dataset['gengagePart'] = 'ai-grouping-card-image';
      img.draggable = false;
      img.src = entry.image;
      img.alt = entry.name;
      img.width = 64;
      img.height = 64;
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'gengage-chat-grouping-card-body';
    body.dataset['gengagePart'] = 'ai-grouping-card-body';

    const nameEl = document.createElement('span');
    nameEl.className = 'gengage-chat-grouping-card-name';
    nameEl.dataset['gengagePart'] = 'ai-grouping-card-name';
    nameEl.textContent = entry.name;
    body.appendChild(nameEl);

    if (entry.labels && entry.labels.length > 0) {
      const labelsEl = document.createElement('div');
      labelsEl.className = 'gengage-chat-grouping-card-labels';
      labelsEl.dataset['gengagePart'] = 'ai-grouping-card-labels';
      for (const label of entry.labels.slice(0, 2)) {
        const chip = document.createElement('span');
        chip.className = 'gengage-chat-grouping-card-label gds-chip';
        chip.textContent = label;
        labelsEl.appendChild(chip);
      }
      body.appendChild(labelsEl);
    }

    card.appendChild(body);

    // Mobile prefix arrow (shown via CSS only on mobile)
    const arrow = document.createElement('span');
    arrow.className = 'gengage-chat-grouping-card-arrow';
    arrow.textContent = '\u21B3';
    card.insertBefore(arrow, card.firstChild);

    scrollRow.appendChild(card);
  }

  container.appendChild(scrollRow);

  return container;
}
