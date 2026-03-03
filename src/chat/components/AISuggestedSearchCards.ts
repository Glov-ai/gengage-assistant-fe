/**
 * AI Suggested Search Cards renderer.
 *
 * Cards with image, short_name, detailed_user_message, and why_different.
 * Clicking a card dispatches the associated action.
 *
 * XSS safety: All text is set via textContent. Image URLs are validated
 * for safe protocols. No innerHTML.
 */

import type { UIElement, ActionPayload } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';
import { isSafeImageUrl } from '../../common/safe-html.js';

interface SuggestedSearchEntry {
  shortName: string;
  detailedMessage?: string;
  whyDifferent?: string;
  image?: string;
  action: ActionPayload;
}

export function renderAISuggestedSearchCards(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-suggested-search-cards';

  const entries = (element.props?.['entries'] ?? []) as SuggestedSearchEntry[];
  if (entries.length === 0) return container;

  for (const entry of entries) {
    const card = document.createElement('div');
    card.className = 'gengage-chat-suggested-search-card';
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => ctx.onAction(entry.action));

    // Image (40x40)
    if (entry.image && isSafeImageUrl(entry.image)) {
      const img = document.createElement('img');
      img.className = 'gengage-chat-suggested-search-card-img';
      img.src = entry.image;
      img.alt = entry.shortName;
      img.width = 40;
      img.height = 40;
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'gengage-chat-suggested-search-card-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-suggested-search-card-name';
    nameEl.textContent = entry.shortName;
    body.appendChild(nameEl);

    if (entry.detailedMessage) {
      const desc = document.createElement('div');
      desc.className = 'gengage-chat-suggested-search-card-desc';
      desc.textContent = entry.detailedMessage;
      body.appendChild(desc);
    }

    if (entry.whyDifferent) {
      const diff = document.createElement('div');
      diff.className = 'gengage-chat-suggested-search-card-diff';
      diff.textContent = entry.whyDifferent;
      body.appendChild(diff);
    }

    card.appendChild(body);
    container.appendChild(card);
  }

  return container;
}
