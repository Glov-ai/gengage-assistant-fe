/**
 * AI Suggested Search Cards renderer.
 *
 * Cards with a larger image and a single clear title line.
 * Secondary / tertiary supporting lines are intentionally omitted in chat so
 * the module reads as a compact, visual category chooser.
 *
 * XSS safety: All text is set via textContent. Image URLs are validated
 * for safe protocols. No innerHTML.
 */

import type { UIElement, ActionPayload } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';
import { isSafeImageUrl } from '../../common/safe-html.js';

interface SuggestedSearchEntry {
  shortName: string;
  image?: string;
  action: ActionPayload;
}

export function renderAISuggestedSearchCards(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-suggested-search-cards';
  container.dataset['gengagePart'] = 'ai-suggested-search-cards';

  const entries = (element.props?.['entries'] ?? []) as SuggestedSearchEntry[];
  if (entries.length === 0) return container;

  for (const entry of entries) {
    const card = document.createElement('div');
    card.className = 'gengage-chat-suggested-search-card gds-card';
    card.dataset['gengagePart'] = 'ai-suggested-search-card';
    card.classList.add('gds-clickable');
    card.addEventListener('click', () => ctx.onAction(entry.action));

    // Image
    if (entry.image && isSafeImageUrl(entry.image)) {
      const img = document.createElement('img');
      img.className = 'gengage-chat-suggested-search-card-img';
      img.dataset['gengagePart'] = 'ai-suggested-search-card-image';
      img.src = entry.image;
      img.alt = entry.shortName;
      img.width = 64;
      img.height = 64;
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'gengage-chat-suggested-search-card-body';
    body.dataset['gengagePart'] = 'ai-suggested-search-card-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'gengage-chat-suggested-search-card-name';
    nameEl.dataset['gengagePart'] = 'ai-suggested-search-card-name';
    nameEl.textContent = entry.shortName;
    body.appendChild(nameEl);

    card.appendChild(body);
    container.appendChild(card);
  }

  return container;
}
