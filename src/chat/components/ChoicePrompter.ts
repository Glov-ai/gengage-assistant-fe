/**
 * Floating card that suggests the user try comparison mode.
 *
 * Shows in the panel bottom-right when a ProductGrid is displayed and
 * comparison mode is not active.
 */

const SESSION_STORAGE_KEY = 'gengage_choice_prompter_dismissed';
/** Eski sürümler — clearChoicePrompterDismissState kaldırır. */
const LEGACY_GLOBAL_DISMISS_KEY = 'gengage_choice_prompter_dismissed_global';

export interface ChoicePrompterOptions {
  heading: string;
  suggestion: string;
  ctaLabel: string;
  threadId: string;
  onCtaClick: () => void;
  onDismiss?: () => void;
  dismissAriaLabel?: string;
}

export function createChoicePrompter(options: ChoicePrompterOptions): HTMLElement {
  const card = document.createElement('div');
  card.className = 'gengage-chat-choice-prompter gds-card';
  card.dataset['gengagePart'] = 'choice-prompter';

  const copy = document.createElement('div');
  copy.className = 'gengage-chat-choice-prompter-copy';

  const headingEl = document.createElement('div');
  headingEl.className = 'gengage-chat-choice-prompter-heading';
  headingEl.textContent = options.heading;
  copy.appendChild(headingEl);

  const suggestionEl = document.createElement('div');
  suggestionEl.className = 'gengage-chat-choice-prompter-suggestion';
  suggestionEl.textContent = options.suggestion;
  copy.appendChild(suggestionEl);

  card.appendChild(copy);

  const actions = document.createElement('div');
  actions.className = 'gengage-chat-choice-prompter-actions';

  const cta = document.createElement('button');
  cta.type = 'button';
  cta.className = 'gengage-chat-choice-prompter-cta gds-btn gds-btn-primary';
  cta.dataset['gengagePart'] = 'choice-prompter-cta';
  cta.textContent = options.ctaLabel;
  cta.addEventListener('click', () => {
    markDismissed(options.threadId);
    card.remove();
    options.onCtaClick();
  });
  actions.appendChild(cta);

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'gengage-chat-choice-prompter-dismiss';
  dismiss.dataset['gengagePart'] = 'choice-prompter-dismiss';
  dismiss.textContent = '\u00D7'; // × close
  dismiss.setAttribute('aria-label', options.dismissAriaLabel ?? 'Dismiss');
  dismiss.addEventListener('click', () => {
    markDismissed(options.threadId);
    card.remove();
    options.onDismiss?.();
  });
  actions.appendChild(dismiss);

  card.appendChild(actions);

  return card;
}

/** Yeni kullanıcı araması başlarken çağrılır — kart tekrar gösterilebilir. */
export function clearChoicePrompterDismissState(): void {
  try {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(LEGACY_GLOBAL_DISMISS_KEY);
  } catch {
    /* */
  }
}

export function isChoicePrompterDismissed(threadId: string): boolean {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    const dismissed: string[] = JSON.parse(raw);
    return dismissed.includes(threadId);
  } catch {
    return false;
  }
}

function markDismissed(threadId: string): void {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const dismissed: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    if (!dismissed.includes(threadId)) {
      dismissed.push(threadId);
    }
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(dismissed));
  } catch {
    // sessionStorage unavailable — silently ignore
  }
}

/** Toolbar “Karşılaştır” gibi dış aksiyonlarda CTA ile aynı dismiss kaydı. */
export function recordChoicePrompterDismissedForThread(threadId: string): void {
  if (!threadId) return;
  markDismissed(threadId);
}
