/**
 * Structured photo analysis card — rendered inline in the chat message stream.
 *
 * The backend sends a `PhotoAnalysisCard` UISpec with skin/beauty analysis
 * findings. This component renders them as a visually distinct card so the
 * user can scan the highlights quickly.
 */

import type { UIElement } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';

export interface PhotoAnalysisData {
  summary: string;
  strengths?: string[];
  focusPoints?: string[];
  celebStyle?: string;
  celebStyleReason?: string;
  nextQuestion?: string;
}

/** Extract structured photo-analysis data from a UISpec element's props. */
export function parsePhotoAnalysisProps(props: Record<string, unknown>): PhotoAnalysisData | null {
  const summary = typeof props['summary'] === 'string' ? props['summary'] : '';
  const strengths = Array.isArray(props['strengths'])
    ? (props['strengths'] as string[]).filter((c) => typeof c === 'string')
    : [];
  const focusPoints = Array.isArray(props['focus_points'])
    ? (props['focus_points'] as string[]).filter((c) => typeof c === 'string')
    : [];
  if (!summary && strengths.length === 0 && focusPoints.length === 0) return null;

  const result: PhotoAnalysisData = { summary };
  const celebStyle = typeof props['celeb_style'] === 'string' ? props['celeb_style'] : undefined;
  const celebStyleReason = typeof props['celeb_style_reason'] === 'string' ? props['celeb_style_reason'] : undefined;
  const nextQuestion = typeof props['next_question'] === 'string' ? props['next_question'] : undefined;
  if (strengths.length > 0) result.strengths = strengths;
  if (focusPoints.length > 0) result.focusPoints = focusPoints;
  if (celebStyle) result.celebStyle = celebStyle;
  if (celebStyleReason) result.celebStyleReason = celebStyleReason;
  if (nextQuestion) result.nextQuestion = nextQuestion;
  return result;
}

function buildSection(title: string, items: string[], className: string): HTMLElement | null {
  if (items.length === 0) return null;
  const section = document.createElement('section');
  section.className = `gengage-chat-photo-analysis-section ${className}`;

  const heading = document.createElement('h4');
  heading.className = 'gengage-chat-photo-analysis-section-title';
  heading.textContent = title;

  const list = document.createElement('ul');
  list.className = 'gengage-chat-photo-analysis-section-list';
  for (const itemText of items) {
    const item = document.createElement('li');
    item.className = 'gengage-chat-photo-analysis-section-item';
    item.textContent = itemText;
    list.appendChild(item);
  }

  section.appendChild(heading);
  section.appendChild(list);
  return section;
}

/** Build the shared photo analysis card DOM from structured data. */
function buildAnalysisCardDom(
  labels: {
    badge: string;
    strengths: string;
    focus: string;
    celebStyle: string;
  },
  data: PhotoAnalysisData,
): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-photo-analysis-card';

  const badge = document.createElement('div');
  badge.className = 'gengage-chat-photo-analysis-badge';
  badge.textContent = labels.badge;

  const body = document.createElement('div');
  body.className = 'gengage-chat-photo-analysis-body';

  if (data.summary) {
    const p = document.createElement('p');
    p.className = 'gengage-chat-photo-analysis-summary';
    p.textContent = data.summary;
    body.appendChild(p);
  }

  const highlights = document.createElement('div');
  highlights.className = 'gengage-chat-photo-analysis-highlights';
  const strengthsSection = buildSection(
    labels.strengths,
    data.strengths ?? [],
    'gengage-chat-photo-analysis-section--strengths',
  );
  const focusSection = buildSection(labels.focus, data.focusPoints ?? [], 'gengage-chat-photo-analysis-section--focus');
  if (strengthsSection) highlights.appendChild(strengthsSection);
  if (focusSection) highlights.appendChild(focusSection);
  if (highlights.childElementCount > 0) {
    body.appendChild(highlights);
  }

  if (data.celebStyle) {
    const section = document.createElement('section');
    section.className = 'gengage-chat-photo-analysis-section gengage-chat-photo-analysis-section--celeb';

    const heading = document.createElement('h4');
    heading.className = 'gengage-chat-photo-analysis-section-title';
    heading.textContent = labels.celebStyle;

    const name = document.createElement('p');
    name.className = 'gengage-chat-photo-analysis-celeb-name';
    name.textContent = data.celebStyle;

    section.appendChild(heading);
    section.appendChild(name);
    if (data.celebStyleReason) {
      const reason = document.createElement('p');
      reason.className = 'gengage-chat-photo-analysis-celeb-reason';
      reason.textContent = data.celebStyleReason;
      section.appendChild(reason);
    }
    body.appendChild(section);
  }

  if (data.nextQuestion) {
    const p = document.createElement('p');
    p.className = 'gengage-chat-photo-analysis-next';
    p.textContent = data.nextQuestion;
    body.appendChild(p);
  }

  card.appendChild(badge);
  card.appendChild(body);
  return card;
}

function analysisLabels(ctx?: ChatUISpecRenderContext): {
  badge: string;
  strengths: string;
  focus: string;
  celebStyle: string;
} {
  return {
    badge: ctx?.i18n?.photoAnalysisBadge ?? 'Skin Analysis',
    strengths: ctx?.i18n?.photoAnalysisStrengthsLabel ?? 'Your strengths',
    focus: ctx?.i18n?.photoAnalysisFocusLabel ?? 'Focus points',
    celebStyle: ctx?.i18n?.photoAnalysisCelebStyleLabel ?? 'Celeb style match',
  };
}

export function renderPhotoAnalysisCard(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const parsed = parsePhotoAnalysisProps(element.props ?? {});
  const data: PhotoAnalysisData = parsed ?? { summary: '' };
  return buildAnalysisCardDom(analysisLabels(ctx), data);
}

/** Renders the structured PhotoAnalysisCard data captured from the UISpec. */
export function renderPhotoAnalysisBubble(
  container: HTMLElement,
  labels: {
    badge: string;
    strengths: string;
    focus: string;
    celebStyle: string;
  },
  structured?: PhotoAnalysisData,
): void {
  container.innerHTML = '';

  if (structured) {
    container.appendChild(buildAnalysisCardDom(labels, structured));
  }
}
