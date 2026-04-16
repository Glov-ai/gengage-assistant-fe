/**
 * Structured photo analysis card — rendered inline in the chat message stream.
 *
 * The backend sends a `PhotoAnalysisCard` UISpec with skin/beauty analysis
 * findings. This component renders them as a visually distinct card so the
 * user can scan the highlights quickly and expand the longer analysis only if
 * they want more detail.
 */

import type { UIElement } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';

export interface PhotoAnalysisData {
  summary: string;
  strengths?: string[];
  focusPoints?: string[];
  celebStyle?: string;
  celebStyleReason?: string;
  details: string[];
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
  const details = Array.isArray(props['details'])
    ? (props['details'] as string[]).filter((c) => typeof c === 'string')
    : [];
  if (!summary && strengths.length === 0 && focusPoints.length === 0 && details.length === 0) return null;

  const result: PhotoAnalysisData = { summary, details };
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

function deriveFallbackStructuredData(data: PhotoAnalysisData): PhotoAnalysisData {
  const details = data.details;
  if ((data.strengths && data.strengths.length > 0) || (data.focusPoints && data.focusPoints.length > 0)) {
    return {
      ...data,
      details,
    };
  }
  // Need at least 3 items to split meaningfully into two sections;
  // otherwise just show the collapsible details to avoid redundancy.
  if (details.length < 3) {
    return { ...data, details };
  }
  return {
    ...data,
    strengths: details.slice(0, 2),
    focusPoints: details.slice(2, 4),
    details,
  };
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
    seeMore: string;
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

  const detailItems = data.details.filter(Boolean);
  if (detailItems.length > 0) {
    const details = document.createElement('details');
    details.className = 'gengage-chat-photo-analysis-details';

    const summary = document.createElement('summary');
    summary.className = 'gengage-chat-photo-analysis-details-summary';
    summary.textContent = labels.seeMore;

    const detailList = document.createElement('ul');
    detailList.className = 'gengage-chat-photo-analysis-points';
    for (const clue of detailItems) {
      const item = document.createElement('li');
      item.textContent = clue;
      detailList.appendChild(item);
    }

    details.appendChild(summary);
    details.appendChild(detailList);
    body.appendChild(details);
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
  seeMore: string;
} {
  return {
    badge: ctx?.i18n?.photoAnalysisBadge ?? 'Skin Analysis',
    strengths: ctx?.i18n?.photoAnalysisStrengthsLabel ?? 'Your strengths',
    focus: ctx?.i18n?.photoAnalysisFocusLabel ?? 'Focus points',
    celebStyle: ctx?.i18n?.photoAnalysisCelebStyleLabel ?? 'Celeb style match',
    seeMore: ctx?.i18n?.photoAnalysisSeeMoreLabel ?? 'See detailed analysis',
  };
}

export function renderPhotoAnalysisCard(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const parsed = parsePhotoAnalysisProps(element.props ?? {});
  const data: PhotoAnalysisData = deriveFallbackStructuredData(parsed ?? { summary: '', details: [] });
  return buildAnalysisCardDom(analysisLabels(ctx), data);
}

/**
 * Renders a photo analysis card into a chat message bubble.
 *
 * When structured data is available (from a PhotoAnalysisCard UISpec), it renders
 * the summary, sections, and follow-up question directly. Otherwise, falls back
 * to a sentence-splitting heuristic for old backends that don't send the UISpec.
 */
export function renderPhotoAnalysisBubble(
  container: HTMLElement,
  content: string,
  labels: {
    badge: string;
    strengths: string;
    focus: string;
    celebStyle: string;
    seeMore: string;
  },
  structured?: PhotoAnalysisData,
): void {
  container.innerHTML = '';

  if (structured) {
    container.appendChild(buildAnalysisCardDom(labels, deriveFallbackStructuredData(structured)));
    return;
  }

  // Fallback: sentence-splitting heuristic for old backends without PhotoAnalysisCard UISpec.
  const parts = content
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const summaryText = parts[0] ?? content;
  const details = parts
    .slice(1)
    .filter((part) => !part.includes('?'))
    .slice(0, 4);
  const question = parts.find((part) => part.includes('?'));

  const data: PhotoAnalysisData = deriveFallbackStructuredData({
    summary: summaryText,
    details,
    ...(question ? { nextQuestion: question } : {}),
  });
  container.appendChild(buildAnalysisCardDom(labels, data));
}
