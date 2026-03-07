import type { ActionPayload } from '../../common/types.js';

export interface ButtonRowOptions {
  actions: Array<{ title: string; type: string; payload?: unknown }>;
  onAction: (action: ActionPayload) => void;
  ctaText?: string;
  defaultCtaText?: string;
  onOpenChat?: () => void;
  orientation?: 'horizontal' | 'vertical';
  quickQuestionsAriaLabel?: string;
}

export function renderButtonRow(options: ButtonRowOptions): HTMLElement {
  const container = document.createElement('div');
  container.className = 'gengage-qna-buttons';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', options.quickQuestionsAriaLabel ?? 'Quick questions');

  if (options.orientation === 'vertical') {
    container.style.flexDirection = 'column';
  }

  for (const action of options.actions) {
    const button = document.createElement('button');
    button.className = 'gengage-qna-button';
    button.textContent = action.title;
    button.type = 'button';
    button.addEventListener('click', () => {
      const actionPayload: ActionPayload = {
        title: action.title,
        type: action.type,
      };
      if (action.payload !== undefined) actionPayload.payload = action.payload;
      options.onAction(actionPayload);
    });
    container.appendChild(button);
  }

  if (options.ctaText || options.onOpenChat) {
    const cta = document.createElement('button');
    cta.className = 'gengage-qna-cta';
    cta.textContent = options.ctaText ?? options.defaultCtaText ?? 'Ask something else';
    cta.type = 'button';
    cta.addEventListener('click', () => {
      options.onOpenChat?.();
    });
    container.appendChild(cta);
  }

  return container;
}
