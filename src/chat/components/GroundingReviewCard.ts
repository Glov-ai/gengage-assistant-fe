/**
 * Grounding Review Card renderer.
 *
 * Renders a clickable card for review grounding data with title,
 * review count, and a CTA arrow. The entire card is clickable.
 *
 * XSS safety: All text is set via textContent. No innerHTML.
 */

import type { UIElement, ActionPayload } from '../../common/types.js';
import type { ChatUISpecRenderContext } from '../types.js';

import { createLucideIcon } from '../utils/ui.js';

export function renderGroundingReviewCard(element: UIElement, ctx: ChatUISpecRenderContext): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-grounding-review gds-evidence-card';
  container.dataset['gengagePart'] = 'grounding-review-card';

  const props = element.props ?? {};
  const title = props['title'] as string | undefined;
  const reviewCount = props['reviewCount'] as string | undefined;
  const action = props['action'] as ActionPayload | undefined;
  const ctaLabel = ctx.i18n?.groundingReviewCta ?? 'Read Reviews';

  // Icon
  const icon = document.createElement('span');
  icon.className = 'gengage-chat-grounding-review-icon';
  icon.appendChild(
    createLucideIcon(['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M8 9h8', 'M8 13h6']),
  );
  container.appendChild(icon);

  const body = document.createElement('div');
  body.className = 'gengage-chat-grounding-review-body';
  body.dataset['gengagePart'] = 'grounding-review-body';

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'gengage-chat-grounding-review-title';
  titleEl.dataset['gengagePart'] = 'grounding-review-title';
  titleEl.textContent = title ?? ctx.i18n?.customerReviewsTitle ?? 'Customer Reviews';
  body.appendChild(titleEl);

  // Subtitle (review count)
  if (reviewCount) {
    const subtitle = document.createElement('div');
    subtitle.className = 'gengage-chat-grounding-review-subtitle';
    subtitle.dataset['gengagePart'] = 'grounding-review-subtitle';
    const template = ctx.i18n?.groundingReviewSubtitle ?? '{count} yorum mevcut';
    subtitle.textContent = template.replace('{count}', reviewCount);
    body.appendChild(subtitle);
  }

  container.appendChild(body);

  // CTA arrow
  const cta = document.createElement('span');
  cta.className = 'gengage-chat-grounding-review-cta';
  cta.dataset['gengagePart'] = 'grounding-review-cta';
  const ctaLabelEl = document.createElement('span');
  ctaLabelEl.textContent = ctaLabel;
  cta.appendChild(ctaLabelEl);
  const ctaIcon = document.createElement('span');
  ctaIcon.className = 'gengage-chat-grounding-review-cta-icon';
  ctaIcon.appendChild(createLucideIcon(['M5 12h14', 'M15 8l4 4-4 4'], 14));
  cta.appendChild(ctaIcon);
  container.appendChild(cta);

  // Make entire card clickable
  if (action) {
    container.classList.add('gds-clickable');
    container.setAttribute('role', 'button');
    container.setAttribute('tabindex', '0');
    container.addEventListener('click', () => ctx.onAction(action));
    container.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ctx.onAction(action);
      }
    });
  }

  return container;
}
