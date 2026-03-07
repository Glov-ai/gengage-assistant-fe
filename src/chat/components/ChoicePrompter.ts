/**
 * Floating card that suggests the user try comparison mode.
 *
 * Shows in the panel bottom-right when a ProductGrid is displayed and
 * comparison mode is not active.
 */

const SESSION_STORAGE_KEY = 'gengage_choice_prompter_dismissed';

export interface ChoicePrompterOptions {
  heading: string;
  suggestion: string;
  ctaLabel: string;
  onCtaClick: () => void;
  onDismiss?: () => void;
  dismissAriaLabel?: string;
}

export function createChoicePrompter(options: ChoicePrompterOptions): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-choice-prompter';

  const headingEl = document.createElement('div');
  headingEl.className = 'gengage-chat-choice-prompter-heading';
  headingEl.textContent = options.heading;
  card.appendChild(headingEl);

  const suggestionEl = document.createElement('div');
  suggestionEl.className = 'gengage-chat-choice-prompter-suggestion';
  suggestionEl.textContent = options.suggestion;
  card.appendChild(suggestionEl);

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'gengage-chat-choice-prompter-cta';
  cta.textContent = options.ctaLabel;
  cta.addEventListener('click', () => {
    markDismissed();
    card.remove();
    options.onCtaClick();
  });
  card.appendChild(cta);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'gengage-chat-choice-prompter-dismiss';
  dismiss.textContent = '\u00D7'; // × close
  dismiss.setAttribute('aria-label', options.dismissAriaLabel ?? 'Dismiss');
  dismiss.addEventListener('click', () => {
    markDismissed();
    card.remove();
    options.onDismiss?.();
  });
  card.appendChild(dismiss);

  return card;
}

export function isChoicePrompterDismissed(): boolean {
  try {
    return sessionStorage.getItem(SESSION_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissed(): void {
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '1');
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}
