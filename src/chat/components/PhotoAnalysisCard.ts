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

export interface PhotoAnalysisData {
  summary: string;
  clues: string[];
  nextQuestion?: string;
}

/** Extract structured photo-analysis data from a UISpec element's props. */
export function parsePhotoAnalysisProps(props: Record<string, unknown>): PhotoAnalysisData | null {
  const summary = typeof props['summary'] === 'string' ? props['summary'] : '';
  const clues = Array.isArray(props['clues']) ? (props['clues'] as string[]).filter((c) => typeof c === 'string') : [];
  if (!summary && clues.length === 0) return null;
  const nextQuestion = typeof props['next_question'] === 'string' ? props['next_question'] : undefined;
  return nextQuestion ? { summary, clues, nextQuestion } : { summary, clues };
}

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

/**
 * Renders a photo analysis card into a chat message bubble.
 *
 * When structured data is available (from a PhotoAnalysisCard UISpec), it renders
 * the summary, clues, and next question directly. Otherwise, falls back to a
 * sentence-splitting heuristic for old backends that don't send the UISpec.
 */
export function renderPhotoAnalysisBubble(
  container: HTMLElement,
  content: string,
  badgeText: string,
  structured?: { summary: string; clues: string[]; nextQuestion?: string },
): void {
  container.innerHTML = '';

  const card = document.createElement('div');
  card.className = 'gengage-chat-photo-analysis-card';

  const badge = document.createElement('div');
  badge.className = 'gengage-chat-photo-analysis-badge';
  badge.textContent = badgeText;

  const body = document.createElement('div');
  body.className = 'gengage-chat-photo-analysis-body';

  if (structured) {
    const summaryEl = document.createElement('p');
    summaryEl.className = 'gengage-chat-photo-analysis-summary';
    summaryEl.textContent = structured.summary;
    body.appendChild(summaryEl);

    if (structured.clues.length > 0) {
      const list = document.createElement('ul');
      list.className = 'gengage-chat-photo-analysis-points';
      for (const clue of structured.clues) {
        const item = document.createElement('li');
        item.textContent = clue;
        list.appendChild(item);
      }
      body.appendChild(list);
    }

    if (structured.nextQuestion) {
      const next = document.createElement('p');
      next.className = 'gengage-chat-photo-analysis-next';
      next.textContent = structured.nextQuestion;
      body.appendChild(next);
    }
  } else {
    // Fallback: sentence-splitting heuristic for old backends without PhotoAnalysisCard UISpec.
    const parts = content
      .split(/(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(Boolean);

    const summaryEl = document.createElement('p');
    summaryEl.className = 'gengage-chat-photo-analysis-summary';
    summaryEl.textContent = parts[0] ?? content;
    body.appendChild(summaryEl);

    const clues = parts
      .slice(1)
      .filter((part) => !part.includes('?'))
      .slice(0, 4);
    if (clues.length > 0) {
      const list = document.createElement('ul');
      list.className = 'gengage-chat-photo-analysis-points';
      for (const clue of clues) {
        const item = document.createElement('li');
        item.textContent = clue;
        list.appendChild(item);
      }
      body.appendChild(list);
    }

    const question = parts.find((part) => part.includes('?'));
    if (question) {
      const next = document.createElement('p');
      next.className = 'gengage-chat-photo-analysis-next';
      next.textContent = question;
      body.appendChild(next);
    }
  }

  card.appendChild(badge);
  card.appendChild(body);
  container.appendChild(card);
}
