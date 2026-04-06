/**
 * Renders a handoff notice when the backend escalates to a human agent.
 *
 * XSS safety: All text is set via textContent. No innerHTML.
 */

import type { ChatUISpecRenderContext } from '../types.js';

export function renderHandoffNotice(
  element: { props?: Record<string, unknown> },
  context: ChatUISpecRenderContext,
): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-chat-handoff-notice gds-evidence-card gds-evidence-card-warning';
  container.dataset['gengagePart'] = 'handoff-notice';
  container.setAttribute('role', 'alert');

  const icon = document.createElement('span');
  icon.className = 'gengage-chat-handoff-notice-icon';
  icon.textContent = '\u{1F464}'; // 👤
  icon.setAttribute('aria-hidden', 'true');
  container.appendChild(icon);

  const heading = document.createElement('h4');
  heading.className = 'gengage-chat-handoff-notice-heading';
  heading.textContent = context.i18n?.handoffHeading ?? 'Transferring to a support agent';
  container.appendChild(heading);

  const summary = element.props?.['summary'] as string | undefined;
  if (summary) {
    const summaryEl = document.createElement('p');
    summaryEl.className = 'gengage-chat-handoff-notice-summary';
    summaryEl.textContent = summary;
    container.appendChild(summaryEl);
  }

  return container;
}
