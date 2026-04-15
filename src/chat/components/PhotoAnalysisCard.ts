/**
 * Structured photo analysis card — rendered inline in the chat message stream.
 *
 * The backend sends a `PhotoAnalysisCard` UISpec with skin/beauty analysis
 * findings (summary, observation clues, and an optional follow-up question).
 * This component renders them as a visually distinct card so the user can
 * see the analysis at a glance.
 */

import type { UIElement } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';

export function renderPhotoAnalysisCard(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-photo-analysis-card';

  const badge = document.createElement('div');
  badge.className = 'gengage-chat-photo-analysis-badge';
  badge.textContent = ctx.i18n?.photoAnalysisBadge ?? 'Skin Analysis';

  const body = document.createElement('div');
  body.className = 'gengage-chat-photo-analysis-body';

  const summary = element.props?.['summary'];
  if (typeof summary === 'string' && summary) {
    const p = document.createElement('p');
    p.className = 'gengage-chat-photo-analysis-summary';
    p.textContent = summary;
    body.appendChild(p);
  }

  const clues = element.props?.['clues'];
  if (Array.isArray(clues) && clues.length > 0) {
    const list = document.createElement('ul');
    list.className = 'gengage-chat-photo-analysis-points';
    for (const clue of clues) {
      if (typeof clue !== 'string') continue;
      const item = document.createElement('li');
      item.textContent = clue;
      list.appendChild(item);
    }
    body.appendChild(list);
  }

  const nextQuestion = element.props?.['next_question'];
  if (typeof nextQuestion === 'string' && nextQuestion) {
    const p = document.createElement('p');
    p.className = 'gengage-chat-photo-analysis-next';
    p.textContent = nextQuestion;
    body.appendChild(p);
  }

  card.appendChild(badge);
  card.appendChild(body);
  return card;
}
