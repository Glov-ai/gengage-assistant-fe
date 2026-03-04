/**
 * AI Grouping Cards renderer.
 *
 * Desktop: compact card with image, name, and labels.
 * Mobile: simple button list with arrow prefix (images hidden via CSS).
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

  const entries = (element.props?.['entries'] ?? []) as GroupingEntry[];
  if (entries.length === 0) return container;

  for (const entry of entries) {
    const card = document.createElement('div');
    card.className = 'gengage-chat-grouping-card';
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => ctx.onAction(normalizeGroupingAction(entry)));

    // Image (20x20 on desktop, hidden on mobile via CSS)
    if (entry.image && isSafeImageUrl(entry.image)) {
      const img = document.createElement('img');
      img.className = 'gengage-chat-grouping-card-img';
      img.src = entry.image;
      img.alt = entry.name;
      img.width = 20;
      img.height = 20;
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'gengage-chat-grouping-card-body';

    const nameEl = document.createElement('span');
    nameEl.className = 'gengage-chat-grouping-card-name';
    nameEl.textContent = entry.name;
    body.appendChild(nameEl);

    if (entry.description) {
      const desc = document.createElement('span');
      desc.className = 'gengage-chat-grouping-card-desc';
      desc.textContent = entry.description;
      body.appendChild(desc);
    }

    if (entry.labels && entry.labels.length > 0) {
      const labelsEl = document.createElement('span');
      labelsEl.className = 'gengage-chat-grouping-card-labels';
      labelsEl.textContent = entry.labels.slice(0, 3).join(' \u00B7 ');
      body.appendChild(labelsEl);
    }

    card.appendChild(body);

    // Mobile prefix arrow (shown via CSS only on mobile)
    const arrow = document.createElement('span');
    arrow.className = 'gengage-chat-grouping-card-arrow';
    arrow.textContent = '\u21B3';
    card.insertBefore(arrow, card.firstChild);

    container.appendChild(card);
  }

  return container;
}
